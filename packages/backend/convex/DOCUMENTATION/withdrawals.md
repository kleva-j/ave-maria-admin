# Withdrawal Feature Behavior

## Overview

**Primary module**: `packages/backend/convex/withdrawals.ts`

The withdrawal feature is a reservation-based payout workflow.

The current behavior is:

1. A user requests a withdrawal.
2. The system validates balance, risk rules, and payout details.
3. The system creates a withdrawal record and a reservation record.
4. No ledger deduction happens yet.
5. An admin approves or rejects the request.
6. If approved, an admin processes the payout.
7. Only at `process` time does the system post the negative withdrawal transaction to the ledger.

This is an intentional change from the older "deduct on request, reverse on reject" model.

---

## Why This Design Exists

The feature now separates three concerns cleanly:

1. **Intent**
   - The user wants to withdraw money.
   - Stored as a `withdrawals` row.

2. **Capacity reservation**
   - The system must prevent over-withdrawal while the request is under review.
   - Stored as a `withdrawal_reservations` row.

3. **Final financial settlement**
   - The ledger should only reflect money leaving the system after payout processing succeeds.
   - Stored as a `transactions` row of type `withdrawal`.

That separation reduces reversal complexity, keeps the ledger cleaner, and makes payout-provider integration easier.

---

## Core Modules

### API / Orchestration
- `packages/backend/convex/withdrawals.ts`

### Domain rules
- `packages/domain/src/services/withdrawalLifecycle.ts`
- `packages/domain/src/services/withdrawalPolicy.ts`

### Application use cases
- `packages/application/src/use-cases/index.ts`

### Backend adapters
- `packages/backend/convex/adapters/withdrawalAdapter.ts`
- `packages/backend/convex/adapters/withdrawalReservationAdapter.ts`
- `packages/backend/convex/adapters/bankAccountAdapter.ts`
- `packages/backend/convex/adapters/withdrawalPayoutAdapter.ts`

### Ledger integration
- `packages/backend/convex/transactions.ts`

### Risk integration
- `packages/backend/convex/risk.ts`
- `packages/backend/convex/withdrawalPolicy.ts`

---

## Persistence Model

### `withdrawals`

A withdrawal row is the workflow record.

Important fields:

- `reference`
- `requested_by`
- `requested_amount_kobo`
- `method`
- `status`
- `requested_at`
- `approved_by`
- `approved_at`
- `processed_by`
- `processed_at`
- `transaction_id` (optional until processing succeeds)
- `reservation_id` (optional during creation, then linked)
- `payout_provider`
- `payout_reference`
- `last_processing_error`
- `bank_account_details`
- `cash_details`
- `rejection_reason`

### `withdrawal_reservations`

A reservation row prevents the same balance from being used by multiple pending withdrawals.

Important fields:

- `withdrawal_id`
- `user_id`
- `amount_kobo`
- `reference`
- `status`
- `created_at`
- `released_at`
- `consumed_at`

Reservation statuses:

- `active`
- `released`
- `consumed`

### `transactions`

The actual ledger entry for a withdrawal is created only during successful processing.

Important implication:

- `pending` and `approved` withdrawals may have no `transaction_id`.
- `processed` withdrawals should have a linked `transaction_id`.

---

## Workflow State Machine

```text
request
  -> withdrawal.status = pending
  -> reservation.status = active
  -> no transaction posted

approve
  -> withdrawal.status = approved
  -> reservation.status = active
  -> no transaction posted

reject
  -> withdrawal.status = rejected
  -> reservation.status = released
  -> no transaction posted

process
  -> payout executed
  -> withdrawal ledger transaction posted
  -> withdrawal.status = processed
  -> reservation.status = consumed
```

### Withdrawal statuses

- `pending`
  - user has requested the withdrawal
  - admin review is still pending
  - reservation is active
  - no ledger deduction yet

- `approved`
  - admin has approved the withdrawal
  - reservation is still active
  - still no ledger deduction yet
  - ready for payout execution

- `rejected`
  - admin rejected the withdrawal
  - reservation is released
  - no ledger reversal exists because no withdrawal transaction was ever posted
  - terminal state

- `processed`
  - payout has been executed successfully
  - reservation is consumed
  - negative transaction has been posted to the ledger
  - terminal state

---

## Request Behavior

## Entry point

- `withdrawals.request`

## Preconditions

1. User must be authenticated.
2. User must be `active`.
3. Amount must be greater than zero.
4. Available balance must be sufficient after subtracting active reservations.
5. Request must pass withdrawal risk checks.
6. If method is `bank_transfer`, the user must have a verified bank account.
7. If method is `cash`, a bank account must not be supplied.

## Available balance rule

The system does not look only at `total_balance_kobo`.
It uses:

- current total balance
- current savings balance
- sum of all **active** withdrawal reservations

Effective available amount is:

```text
available = balance - active_reservations
```

A new request is rejected if either effective total balance or effective savings balance would fall below the requested amount.

## What gets written

1. A new `withdrawals` row is created with:
   - `status = pending`
   - method-specific details
   - stable `reference`

2. A new `withdrawal_reservations` row is created with:
   - `status = active`
   - `reference = wres_<withdrawal_reference>`

3. The withdrawal is patched with `reservation_id`.

## What does **not** happen

- No `transactions` withdrawal entry is created.
- No user balance field is decreased.
- No reversal is needed later if the request is rejected.

---

## Approval Behavior

## Entry point

- `withdrawals.approve`

## Preconditions

1. Caller must be an authenticated admin.
2. Withdrawal must currently be `pending`.
3. Admin role must be allowed for the action.
4. For cash withdrawals, role gating is stricter.
5. Existing admin risk checks still apply where configured.

## What gets written

The withdrawal is updated with:

- `status = approved`
- `approved_by`
- `approved_at`
- `rejection_reason = undefined`
- `last_processing_error = undefined`

## What does **not** happen

- Reservation remains `active`.
- No transaction is posted.
- No payout provider is called.

---

## Rejection Behavior

## Entry point

- `withdrawals.reject`

## Preconditions

1. Caller must be an authenticated admin.
2. Withdrawal may be `pending` or `approved`.
3. Rejection reason is required.
4. Admin role must be allowed for the action.
5. For cash withdrawals, the same role gating used for approve/process also applies.

## What gets written

1. Reservation is updated to:
   - `status = released`
   - `released_at = now`

2. Withdrawal is updated to:
   - `status = rejected`
   - `rejection_reason`
   - `last_processing_error = undefined`

## What does **not** happen

- No reversal transaction is posted.
- No balance update is needed, because nothing was deducted earlier.

This is one of the most important behavior changes in the current design.

---

## Processing Behavior

## Entry point

- `withdrawals.process`

## Preconditions

1. Caller must be an authenticated admin.
2. Withdrawal must be `approved`.
3. Reservation must exist and still be `active`.
4. Admin role must be allowed for the action.
5. For cash withdrawals, restricted cash roles still apply.
6. Admin hold/risk checks still run where configured.

## Processing sequence

The order matters:

1. Load the approved withdrawal.
2. Load the active reservation.
3. Execute payout through the payout service.
4. If payout succeeds, post the negative withdrawal ledger transaction.
5. Mark the reservation `consumed`.
6. Mark the withdrawal `processed` and attach payout + transaction metadata.

## Payout service behavior

Current implementation uses a stub provider:

- adapter: `packages/backend/convex/adapters/withdrawalPayoutAdapter.ts`
- provider name: `manual_ops`

This is provider-ready by design. A real payout adapter can later replace the stub without changing the domain workflow.

## Ledger posting behavior

After payout success, the system posts a transaction with:

- `type = withdrawal`
- `amount_kobo = -requested_amount_kobo`
- `reference = withdrawal.reference`
- metadata including:
  - `source = admin`
  - `actor_id`
  - `withdrawal_status = processed`
  - `method`
  - bank or cash details
  - payout provider/reference

## Failure behavior

If payout execution throws:

1. No withdrawal transaction is posted.
2. Reservation remains active.
3. Withdrawal remains in its prior workflow state.
4. `last_processing_error` is updated.
5. A processing failure audit log is written.

This makes failed processing retryable.

---

## Withdrawal Methods

## Bank transfer

### Requirements

- User must have a verified bank account.
- If a `bank_account_id` is supplied, it must belong to the user and be verified.
- If none is supplied, the system falls back to the user's primary verified bank account.

### Stored details

`bank_account_details` contains:

- `account_id`
- `bank_name`
- `account_name`
- `account_number_last4`

## Cash withdrawal

### Requirements

- No bank account is required.
- The request derives recipient details from the user profile and optional pickup note.
- Cash actions are subject to stricter admin-role gating.

### Stored details

`cash_details` contains:

- `recipient_name`
- `recipient_phone`
- `pickup_note`

---

## Role Gating

Cash withdrawals have stricter action permissions.

Current allowed roles for cash `approve`, `reject`, and `process` are:

- `super_admin`
- `operations`
- `finance`

Blocked roles receive structured forbidden error payloads, and review queries expose server-computed action capabilities.

This logic is driven by:

- `packages/domain/src/services/withdrawalPolicy.ts`
- `packages/backend/convex/withdrawalPolicy.ts`

---

## Risk Integration

Withdrawal request flow is integrated with the risk engine.

Risk checks may block a request for reasons such as:

- manual withdrawal hold
- bank account cooldown after recent change
- daily amount limit
- daily count limit
- short-window velocity limit

Admin action flows also preserve the existing hold/risk checks where already configured.

Related modules:

- `packages/backend/convex/risk.ts`
- `packages/application/src/use-cases/index.ts`

---

## Read APIs

## `withdrawals.listMine`

Returns the authenticated user's withdrawals.

Returned summary includes:

- `_id`
- `reference`
- `transaction_id` (optional)
- `transaction_reference` (optional)
- `requested_amount_kobo`
- `method`
- `status`
- `requested_at`
- `approved_at`
- `processed_at`
- `rejection_reason`
- `payout_provider`
- `payout_reference`
- `last_processing_error`
- `bank_account` or `cash_details`

## `withdrawals.listForReview`

Returns admin review rows with:

- normalized withdrawal summary
- requesting user summary
- risk summary
- server-computed `capabilities`

`capabilities` is authoritative for UI state and should be used to disable blocked admin actions.

---

## Audit and Aggregate Behavior

Each workflow step writes audit information.

Expected actions include:

- `withdrawal.requested`
- `withdrawal.approved`
- `withdrawal.rejected`
- `withdrawal.processing_failed`
- `withdrawal.processed`

Aggregate synchronization is also triggered on insert/update so analytics tables stay aligned with workflow state.

---

## Invariants

These are the important invariants to preserve in future changes:

1. A request creates a reservation before any payout is processed.
2. Balances are not deducted on request or approval.
3. Only processing posts the negative withdrawal transaction.
4. Rejection never posts a reversal in the current design.
5. Only active reservations count against available balance.
6. `processed` withdrawals should have a ledger transaction.
7. `pending` and `approved` withdrawals may legitimately have no `transaction_id`.
8. Cash role gating must stay server-side.

---

## Operational Notes

1. A stuck `approved` withdrawal with an active reservation means payout has not succeeded yet.
2. A `last_processing_error` indicates the payout phase failed after approval and can usually be retried.
3. A `rejected` withdrawal should not be expected to have a reversal transaction in this model.
4. Reconciliation should consider only posted ledger transactions, not workflow rows or reservations.

---

## Related Documentation

- `./transactions.md`
- `./risk.md`
- `./withdrawalPolicy.md`
