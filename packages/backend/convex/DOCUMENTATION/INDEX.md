# Financial Operations Documentation Index

## 📚 Module Overview

This directory contains comprehensive documentation for the financial operations modules in the Convex backend.

---

## Core Modules

### 1. [Transaction Ledger](./transactions.md)

**File**: `convex/transactions.ts`  
**Purpose**: Core financial transaction processing

**Key Features**:

- Idempotent transaction posting
- Automatic balance updates
- Reversal mechanism
- Real-time reconciliation
- Aggregate table sync

**Read This To Understand**:

- How transactions are created and validated
- Balance projection logic
- Metadata normalization
- Idempotency guarantees
- Reconciliation process

[📖 Full Documentation →](./transactions.md)

---

### 2. [Withdrawal Processing](./withdrawals.md)

**File**: `convex/withdrawals.ts`  
**Purpose**: Withdrawal request lifecycle management

**Key Features**:

- Multi-step approval workflow
- Risk controls and limits
- Role-based permissions
- Bank transfer & cash methods
- Aggregate analytics

**Read This To Understand**:

- Withdrawal status flow (PENDING → APPROVED → PROCESSED)
- Admin review process
- Payment method handling
- Reservation release and process-time ledger deduction
- Reservation-based request/approval/process behavior

[📖 Full Documentation →](./withdrawals.md)

---

### 3. [Withdrawal Policy Engine](./withdrawalPolicy.md)

**File**: `convex/withdrawalPolicy.ts`  
**Purpose**: Action capability computation and authorization

**Key Features**:

- Role-based action authorization
- Status-based workflow validation
- Risk-aware decision making
- Cash withdrawal restrictions
- Capability matrix generation

**Read This To Understand**:

- How admin permissions are calculated
- Cash withdrawal role restrictions
- Status transition rules
- Risk hold integration
- UI button enablement logic

[📖 Full Documentation →](./withdrawalPolicy.md)

---

## Risk & Compliance Modules

### 4. [Risk Assessment System](./risk.md)

**File**: `convex/risk.ts`  
**Purpose**: Fraud prevention and real-time risk evaluation

**Key Features**:

- Real-time withdrawal risk scoring
- Automated fraud detection rules
- Manual user holds by administrators
- Velocity checking and limit enforcement
- Risk event logging and audit trails

**Read This To Understand**:

- Risk decision evaluation logic
- Daily/velocity limit enforcement
- Bank account cooldown period
- Manual hold placement and release
- Risk event tracking

**Risk Rules**:

- Manual hold check (highest priority)
- Bank account cooldown (24 hours)
- Daily amount limit (₦500,000)
- Daily count limit (3 per day)
- Velocity limit (2 per 15 minutes)

[📖 Full Documentation →](./risk.md)

---

### 5. [KYC Document Management](./kycDocuments.md)

**File**: `convex/kycDocuments.ts`  
**Purpose**: Document upload, storage, and retrieval

**Key Features**:

- Secure upload workflow with pre-signed URLs
- File type and size validation
- Access control enforcement
- Document lifecycle management
- Audit trail maintenance

**Read This To Understand**:

- Direct-to-storage upload pattern
- File validation rules
- Document access permissions
- Document deletion policies
- Admin review access

**Document Requirements**:

- Required: Government ID, Selfie with ID
- Optional: Proof of Address, Bank Statement
- Max file size: 5MB
- Allowed formats: JPG, PNG, PDF

[📖 Full Documentation →](./kycDocuments.md)

---

### 6. [KYC Verification Pipeline](./kyc.md)

**File**: `convex/kyc.ts`  
**Purpose**: Identity verification and status transitions

**Key Features**:

- Automated verification via external provider simulation
- Manual admin review workflow
- User status transitions (pending_kyc → active or retryable pending_kyc)
- Aggregate synchronization
- Comprehensive audit logging

**Read This To Understand**:

- Automated KYC verification flow
- Admin manual review process
- Document requirement validation
- Status change aggregation
- Rejection handling

**Verification Flow**:

1. User uploads required documents
2. Automated provider verification (80% auto-approval)
3. If approved → active status
4. If rejected → pending_kyc with rejected docs retained
5. Admin review uses the same decision path

[📖 Full Documentation →](./kyc.md)

---

## Supporting Modules

### 7. [Aggregate System](./AGGREGATES_GUIDE.md)

**File**: `convex/aggregates.ts`  
**Purpose**: High-performance analytics (O(log n) queries)

**What It Provides**:

- Denormalized counts and sums
- Real-time metrics
- Dashboard-ready data
- Grouped analytics

**Key Aggregates**:

- Transaction counts (total, by user, by type)
- Withdrawal counts (by status)
- User counts (by status)
- Savings plan metrics
- Reconciliation issue tracking

[📖 Setup Guide →](./AGGREGATES_GUIDE.md)  
[📖 Integration Summary →](./AGGREGATE_INTEGRATION_SUMMARY.md)

---

### 8. [Aggregate Helpers](./aggregateHelpers.ts)

**File**: `convex/aggregateHelpers.ts`  
**Purpose**: Sync helpers for keeping aggregates up-to-date

**Provides Functions For**:

- Transaction insert/update/delete
- Savings plan changes
- User status changes
- Withdrawal lifecycle events
- Reconciliation issue tracking

**Usage Pattern**:

```typescript
// After inserting a record
const doc = await ctx.db.get(id);
await syncTransactionInsert(ctx, doc);

// After updating a record
const oldDoc = await ctx.db.get(id);
await ctx.db.patch(id, updates);
const newDoc = await ctx.db.get(id);
await syncUpdate(ctx, oldDoc, newDoc);
```

---

## Quick Reference

### Transaction Types

| Type             | Purpose            | Amount Sign  | Example          |
| ---------------- | ------------------ | ------------ | ---------------- |
| CONTRIBUTION     | User deposits      | Positive (+) | ₦1,000 savings   |
| WITHDRAWAL       | User withdrawals   | Negative (-) | ₦500 payout      |
| INTEREST_ACCRUAL | Interest earned    | Positive (+) | Monthly interest |
| INVESTMENT_YIELD | Investment returns | Positive (+) | Quarterly yield  |
| REFERRAL_BONUS   | Referral reward    | Positive (+) | ₦2,000 bonus     |
| REVERSAL         | Undo transaction   | Inverse      | Cancel mistake   |

---

### Withdrawal Statuses

| Status    | Meaning          | Next Actions       |
| --------- | ---------------- | ------------------ |
| PENDING   | Awaiting review  | Approve or Reject  |
| APPROVED  | Ready for payout | Process            |
| REJECTED  | Denied           | Auto-refund issued |
| PROCESSED | Payout complete  | None (terminal)    |

---

### Common Workflows

#### User Makes Contribution

```
1. POST /contributions
   ↓
2. transactions.post()
   ↓
3. Create CONTRIBUTION transaction
   ↓
4. Update user balances
   ↓
5. Sync aggregates
```

#### User Requests Withdrawal

```
1. POST /withdrawals
   ↓
2. withdrawals.request()
   ↓
3. Validate balance & risk
   ↓
4. Create WITHDRAWAL transaction (hold funds)
   ↓
5. Create withdrawal record (PENDING)
   ↓
6. Sync aggregates
```

#### Admin Reviews Withdrawal

```
1. GET /withdrawals/for-review
   ↓
2. Review details & risk
   ↓
3a. APPROVE path:
    - withdrawals.approve()
    - Status: PENDING → APPROVED
    - Sync aggregates

3b. REJECT path:
    - withdrawals.reject()
    - Create REVERSAL transaction
    - Status: PENDING → REJECTED
    - Sync aggregates
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                 Frontend Apps                       │
│  (Expo Mobile, TanStack Web)                        │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│              Convex Backend                         │
│                                                     │
│  ┌────────────────────────────────────────────┐     │
│  │  transactions.ts                           │     │
│  │  - post()                                  │     │
│  │  - reverse()                               │     │
│  │  - runReconciliation()                     │     │
│  └────────────────┬───────────────────────────┘     │
│                   │                                 │
│  ┌────────────────▼───────────────────────────┐     │
│  │  withdrawals.ts                            │     │
│  │  - request()                               │     │
│  │  - approve()                               │     │
│  │  - reject()                                │     │
│  │  - process()                               │     │
│  └────────────────┬───────────────────────────┘     │
│                   │                                 │
│  ┌────────────────▼───────────────────────────┐     │
│  │  aggregateHelpers.ts                       │     │
│  │  - syncTransactionInsert()                 │     │
│  │  - syncWithdrawalUpdate()                  │     │
│  │  - syncUserUpdate()                        │     │
│  └────────────────┬───────────────────────────┘     │
│                   │                                 │
│  ┌────────────────▼───────────────────────────┐     │
│  │  aggregates.ts (@convex-dev/aggregate)     │     │
│  │  - totalTransactions                       │     │
│  │  - withdrawalsByStatus                     │     │
│  │  - usersByStatus                           │     │
│  └────────────────────────────────────────────┘     │
│                                                     │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│            Convex Database                          │
│  - transactions                                     │
│  - withdrawals                                      │
│  - users                                            │
│  - user_savings_plans                               │
│  - aggregate_btree_* (internal tables)              │
└─────────────────────────────────────────────────────┘
```

---

## Error Codes Quick Reference

### Transaction Errors

| Error                                            | Cause                   | Solution                    |
| ------------------------------------------------ | ----------------------- | --------------------------- |
| "reference is required"                          | Missing reference field | Provide unique reference    |
| "Transaction would result in negative balance"   | Insufficient funds      | Check balance first         |
| "Original transaction has already been reversed" | Double reversal attempt | Verify not already reversed |
| "Multiple transactions share the same reference" | Reference collision     | Use unique references       |

### Withdrawal Errors

| Error                                       | Cause                      | Solution                   |
| ------------------------------------------- | -------------------------- | -------------------------- |
| "Only active users can request withdrawals" | User not ACTIVE status     | Complete KYC first         |
| "Insufficient balance"                      | Amount > available balance | Reduce amount              |
| "Add and verify a bank account"             | No verified account        | Add bank account           |
| "Only pending withdrawals can be approved"  | Wrong status               | Check status before acting |

---

## Testing Commands

### Manual Testing via Convex CLI

```bash
# Test transaction posting
pnpm convex run transactions.post --args '{
  "userId": "user_123",
  "type": "CONTRIBUTION",
  "amountKobo": 10000,
  "reference": "test_contrib_1",
  "metadata": {
    "channel": "web",
    "origin_reference": "pay_123"
  },
  "source": "USER",
  "actorId": "user_123"
}'

# Test withdrawal request
pnpm convex run withdrawals.request --args '{
  "amount_kobo": 5000,
  "method": "bank_transfer"
}'

# Test admin withdrawal review
pnpm convex run withdrawals.approve --args '{
  "withdrawal_id": "wd_123"
}'

# Query aggregates
pnpm convex run myAggregateQuery
```

---

## Monitoring Checklist

### Daily Checks

- [ ] Transaction count matches expectations
- [ ] Withdrawal queue depth reasonable
- [ ] No stuck PENDING withdrawals > 48hrs
- [ ] Aggregate counts accurate
- [ ] No reconciliation issues

### Weekly Checks

- [ ] Run full reconciliation (`runReconciliation`)
- [ ] Review rejection reasons patterns
- [ ] Analyze velocity/risk triggers
- [ ] Audit log review for anomalies

### Monthly Checks

- [ ] Performance metrics (query latency)
- [ ] Aggregate drift analysis
- [ ] Capacity planning review
- [ ] Security audit of permissions

---

## Related Documentation

- [Convex Documentation](https://docs.convex.dev/)
- [@convex-dev/aggregate](https://www.convex.dev/components/aggregate)
- [Audit Log Integration](./auditLog.md)
- [KYC Verification Flow](./kyc.md)
- [Bank Account Verification](./bankAccounts.md)

---

## Version History

| Version | Date       | Changes                             |
| ------- | ---------- | ----------------------------------- |
| 1.1.0   | 2026-03-13 | Expanded documentation coverage     |
|         |            | - Risk assessment system docs       |
|         |            | - KYC document management docs      |
|         |            | - KYC verification pipeline docs    |
|         |            | - Withdrawal policy engine docs     |
| 1.0.0   | 2026-03-13 | Initial comprehensive documentation |
|         |            | - Transactions module docs          |
|         |            | - Withdrawals module docs           |
|         |            | - Aggregate integration guide       |

---

**Last Updated**: March 13, 2026  
**Maintained By**: Backend Team
