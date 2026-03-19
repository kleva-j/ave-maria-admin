# Withdrawal Processing Module Documentation

## Overview

**File**: `/packages/backend/convex/withdrawals.ts`

The withdrawal processing module manages the complete lifecycle of user withdrawal requests, from initiation through admin review to final payout processing. It implements a multi-step approval workflow with built-in risk controls and role-based permissions.

---

## Key Responsibilities

### 1. **Withdrawal Lifecycle Management**

- Request initiation by users
- Admin review and approval/rejection
- Final processing and payout confirmation
- Status tracking throughout the workflow

### 2. **Risk Control & Compliance**

- Automated risk assessment (velocity checks, limits)
- Role-based admin permissions
- Cash withdrawal restrictions
- Audit logging for all actions

### 3. **Financial Operations**

- Creates PENDING transactions (holds funds)
- Processes reversals on rejection
- Maintains ledger integrity
- Syncs with aggregate tables for analytics

### 4. **Payment Method Support**

- Bank transfer withdrawals
- Cash pickup withdrawals
- Bank account verification requirements
- Recipient details management

---

## Withdrawal Workflow

```
┌─────────────┐
│   REQUEST   │ ← User initiates withdrawal
│  (PENDING)  │
└──────┬──────┘
       │
       ├────────────────┐
       │                │
  ┌────▼─────┐    ┌─────▼──────┐
  │ APPROVE  │    │   REJECT   │ ← Admin reviews
  │(APPROVED)│    │ (REJECTED) │
  └────┬─────┘    └──────┬─────┘
       │                 │
  ┌────▼──────┐          │
  │  PROCESS  │          │ ← Finance processes
  │(PROCESSED)│          │
  └───────────┘          │
                         │
                 ┌───────▼────────┐
                 │ Auto-reversal  │ ← Refunds user
                 └────────────────┘
```

---

## Withdrawal Methods

### Bank Transfer

**Characteristics**:

- Requires verified bank account
- Standard processing time: 1-3 business days
- Lower risk profile
- Default method

**Requirements**:

- User must have `VERIFIED` bank account
- Account details stored in `bank_account_details`

**Metadata Structure**:

```typescript
{
  method: "bank_transfer",
  bank_account: {
    account_id: "ba_123",
    bank_name: "Chase Bank",
    account_name: "John Doe",
    account_number_last4: "1234"
  }
}
```

### Cash Pickup

**Characteristics**:

- No bank account required
- Immediate availability at pickup location
- Higher scrutiny (role restrictions)
- Special handling required

**Requirements**:

- Only certain admin roles can approve/process
- Recipient details captured
- Pickup note optional

**Metadata Structure**:

```typescript
{
  method: "cash",
  cash_details: {
    recipient_name: "John Doe",
    recipient_phone: "+1234567890",
    pickup_note: "Pickup at main branch"
  }
}
```

---

## Status Flow

### PENDING

**When**: User submits withdrawal request  
**Transaction State**: Funds held (negative entry posted)  
**Allowed Actions**:

- Approve → moves to APPROVED
- Reject → moves to REJECTED (funds refunded)

**Business Rules**:

- Validates sufficient balance
- Checks velocity limits
- Verifies bank account (if applicable)
- Risk assessment performed

### APPROVED

**When**: Admin reviews and approves  
**Transaction State**: Funds still held, ready for payout  
**Allowed Actions**:

- Process → moves to PROCESSED

**Business Rules**:

- Role-based permissions apply
- Cash withdrawals require Finance/Operations role
- Manual risk review recommended

### REJECTED

**When**: Admin denies the request  
**Transaction State**: Reversal posted (funds refunded)  
**Allowed Actions**: None (terminal state)

**Business Rules**:

- Rejection reason required
- Automatic reversal created
- User notified

### PROCESSED

**When**: Payout completed (money sent)  
**Transaction State**: Final (no further changes)  
**Allowed Actions**: None (terminal state)

**Business Rules**:

- Confirmation of external payout
- Transaction complete

---

## Core Functions

### User-Facing Operations

#### `request()`

**Purpose**: Initiate a new withdrawal request

**Process**:

1. Validate user status (must be ACTIVE)
2. Check amount > 0 and within balance limits
3. Resolve/validate bank account (for bank transfers)
4. Run risk checks (velocity, daily limits, holds)
5. Create PENDING transaction (holds funds)
6. Insert withdrawal record
7. **Sync with aggregate tables**
8. Audit log the request

**Risk Checks**:

```typescript
await assertWithdrawalRequestAllowed(ctx, {
  user,
  method,
  amountKobo: args.amount_kobo,
  now,
});
```

**Example Usage**:

```typescript
const withdrawal = await request(ctx, {
  amount_kobo: 50000n, // ₦500.00
  method: WithdrawalMethod.BANK_TRANSFER,
  bank_account_id: "ba_123", // Optional - uses primary verified if not provided
});

// Returns withdrawal summary with status "pending"
```

**Error Scenarios**:

- "Only active users can request withdrawals"
- "Insufficient balance"
- "Add and verify a bank account before withdrawing"
- "Cash withdrawals do not require a bank account"
- Risk check failures (velocity, limits, etc.)

---

### Admin Operations

#### `listForReview()`

**Purpose**: Administrative view of withdrawal requests

**Features**:

- Optional status filter
- Includes user details
- Includes risk summary
- Includes capability flags (what actions are allowed)

**Response Structure**:

```typescript
{
  withdrawal: { /* withdrawal details */ },
  user: {
    _id: "user_123",
    first_name: "John",
    last_name: "Doe",
    email: "john@example.com",
    phone: "+1234567890",
    status: "active"
  },
  risk: {
    /* velocity, history, flags */
  },
  capabilities: {
    approve: { allowed: true },
    reject: { allowed: true },
    process: { allowed: false, reason: "..." }
  }
}
```

#### `approve()`

**Purpose**: Authorize a pending withdrawal

**Process**:

1. Verify admin authentication
2. Check withdrawal is PENDING
3. Validate admin role permissions (especially for cash)
4. Patch status to APPROVED with timestamp
5. **Sync aggregates after status change**
6. Audit log the approval

**Role-Based Permissions**:

```typescript
assertAdminCanHandleCashWithdrawal(
  admin.role,
  withdrawal,
  WithdrawalAction.APPROVE,
);
```

**Cash Withdrawal Allowed Roles**:

- SUPER_ADMIN
- OPERATIONS
- FINANCE

**Example**:

```typescript
await approve(ctx, { withdrawal_id: "wd_123" });
// Returns updated withdrawal with status "approved"
```

#### `reject()`

**Purpose**: Deny a pending withdrawal and refund the user

**Process**:

1. Verify admin authentication
2. Check withdrawal is PENDING
3. Validate admin role permissions
4. **Create REVERSAL transaction** (refunds user)
5. Patch status to REJECTED with reason
6. **Sync aggregates after status change**
7. Audit log with reversal reference

**Critical**: The reversal automatically refunds the user's balance, undoing the hold.

**Example**:

```typescript
await reject(ctx, {
  withdrawal_id: "wd_123",
  reason: "Suspicious activity detected",
});
// Returns updated withdrawal with status "rejected"
```

#### `process()`

**Purpose**: Confirm payout completion

**Process**:

1. Verify admin authentication
2. Check withdrawal is APPROVED (can't process unapproved)
3. Validate admin role permissions
4. Patch status to PROCESSED
5. Audit log the completion

**Note**: This is a status update only - actual payout happens externally.

**Example**:

```typescript
await process(ctx, { withdrawal_id: "wd_123" });
// Returns updated withdrawal with status "processed"
```

---

## Risk Controls

### Velocity Checks

Prevents rapid successive withdrawals that might indicate fraud:

- Maximum withdrawals per hour/day/week
- Cooling-off periods between withdrawals
- Unusual pattern detection

### Daily Limits

Enforces maximum withdrawal amounts:

- Per-user daily caps
- Tiered limits based on KYC status
- Cumulative amount tracking

### Active Holds

Detects other pending withdrawals to prevent overdrafts:

- Checks for existing PENDING withdrawals
- Ensures total holds ≤ available balance

### Role-Based Permissions

Restricts who can approve/process different withdrawal types:

- Cash withdrawals → Finance/Operations only
- Large amounts → Senior admin only
- High-risk users → Enhanced review required

---

## Aggregate Integration

All withdrawal mutations sync with `@convex-dev/aggregate`:

```typescript
// In request():
const withdrawal = await ctx.db.get(withdrawalId);
await syncWithdrawalInsert(ctx, withdrawal);

// In approve()/reject():
await syncWithdrawalUpdate(ctx, withdrawal, updated);
```

**Aggregates Updated**:

- `totalWithdrawals` - Global count
- `withdrawalsByStatus` - Count by status (pending, approved, rejected, processed)

**Enables Queries Like**:

```typescript
// Dashboard metrics
const pending = await withdrawalsByStatus.count(ctx, {
  bounds: { prefix: ["pending"] },
});

const approved = await withdrawalsByStatus.count(ctx, {
  bounds: { prefix: ["approved"] },
});

// Queue stats
const total = await totalWithdrawals.count(ctx);
```

---

## Helper Functions

### Bank Account Resolution

#### `resolveWithdrawalBankAccount()`

**Purpose**: Determine which bank account to use for withdrawal

**Logic**:

1. If `bankAccountId` provided → validate it exists and is verified
2. If not provided → find user's primary verified account
3. Fallback → any verified account
4. Error if no verified account found

**Validation**:

- Account must belong to user
- Account must be VERIFIED status
- Primary account preferred

### Data Normalization

#### `maskBankAccount()`

**Purpose**: Strip sensitive data from bank account details

**What It Keeps**:

- Bank name
- Last 4 digits of account number
- Account name (optional)

**What It Removes**:

- Full account number
- Routing numbers
- Other sensitive details

#### `normalizeBankAccountDetails()`

**Purpose**: Safely parse stored bank account data

**Handles**:

- Missing or malformed data
- Legacy formats
- Null/undefined values

**Returns**: Safe default if parsing fails:

```typescript
{
  bank_name: "Unknown bank",
  account_name: undefined,
  account_number_last4: "----"
}
```

#### `buildCashDetails()`

**Purpose**: Format recipient information for cash withdrawals

**Fields**:

- `recipient_name`: Full name from user profile
- `recipient_phone`: Phone number from profile
- `pickup_note`: Optional instructions

---

## Transaction Linkage

Every withdrawal creates a linked transaction:

```typescript
// Withdrawal creation flow:
const postedTransaction = await postTransactionEntry(ctx, {
  userId: user._id,
  type: TxnType.WITHDRAWAL,
  amountKobo: -args.amount_kobo, // Negative = money leaving
  reference: `wdr_${Date.now()}_abc123`,
  metadata: {
    withdrawal_status: "pending",
    method,
    bank_account: bankAccountDetails,
    cash_details: cashDetails,
  },
  source: TransactionSource.USER,
  actorId: user._id,
});

const withdrawalId = await ctx.db.insert(TABLE_NAMES.WITHDRAWALS, {
  transaction_id: postedTransaction.transaction._id, // ← Linkage
  // ... other fields
});
```

**Why Link?**:

- Transaction holds the financial entry
- Withdrawal holds the operational workflow
- Separation of concerns
- Enables reversal tracking

---

## Error Handling

### User Errors

**"Only active users can request withdrawals"**

- User status is not ACTIVE (pending_kyc, suspended, closed)
- Solution: Complete KYC or resolve suspension

**"Insufficient balance"**

- Withdrawal amount > total_balance_kobo OR > savings_balance_kobo
- Both balances must cover the withdrawal
- Solution: Reduce amount or wait for more deposits

**"Add and verify a bank account before withdrawing"**

- No verified bank account on file
- Solution: Add and verify bank account first

### Admin Errors

**"Only pending withdrawals can be approved"**

- Withdrawal already approved/rejected/processed
- Solution: Check current status before acting

**"Cash withdrawal must be handled by authorized roles"**

- Admin lacks Finance/Operations role
- Solution: Escalate to authorized admin

**"Linked transaction not found"**

- Data integrity issue - transaction missing
- Solution: Investigate data corruption

---

## Query Endpoints

### `listMine()`

**Purpose**: Get current user's withdrawal history

**Features**:

- Filter to authenticated user only
- Sorted by requested_at (newest first)
- Includes full transaction references

**Use Case**: User dashboard showing withdrawal history

### `listForReview(status?)`

**Purpose**: Admin withdrawal queue

**Optional Filter**:

- `status`: Filter to specific status (e.g., "pending")

**Includes**:

- Withdrawal details
- User profile summary
- Risk assessment
- Action capabilities

**Use Case**: Admin review interface

---

## Best Practices

### 1. Always Check Status Before Acting

```typescript
const withdrawal = await ctx.db.get(args.withdrawal_id);
if (withdrawal.status !== WithdrawalStatus.PENDING) {
  throw new ConvexError("Invalid status for this action");
}
```

### 2. Capture Old State for Aggregates

```typescript
const oldWithdrawal = withdrawal;
await ctx.db.patch(withdrawal._id, updates);
const updated = await ctx.db.get(withdrawal._id);
await syncWithdrawalUpdate(ctx, oldWithdrawal, updated);
```

### 3. Handle Cash Withdrawals Carefully

```typescript
assertAdminCanHandleCashWithdrawal(
  admin.role,
  withdrawal,
  WithdrawalAction.APPROVE,
);
```

### 4. Always Provide Rejection Reasons

```typescript
if (!args.approved && (!args.reason || args.reason.trim().length === 0)) {
  throw new ConvexError("Rejection reasons is required");
}
```

### 5. Link Transactions Properly

```typescript
metadata: {
  withdrawal_status: WithdrawalStatus.PENDING,
  method,
  bank_account: bankAccountDetails,
  cash_details: cashDetails,
}
```

---

## Testing Checklist

- [ ] Request withdrawal with sufficient balance → Success
- [ ] Request withdrawal exceeding balance → Rejected
- [ ] Request bank transfer without verified account → Error
- [ ] Request cash withdrawal → Success
- [ ] Approve pending withdrawal → Status = APPROVED
- [ ] Reject pending withdrawal → Status = REJECTED + reversal created
- [ ] Process approved withdrawal → Status = PROCESSED
- [ ] Attempt to approve non-pending withdrawal → Error
- [ ] Cash withdrawal approval by unauthorized role → Error
- [ ] Duplicate withdrawal request (same amount/time) → Risk check triggered
- [ ] Aggregate counts match reality
- [ ] User balance refunded on rejection

---

## Security Considerations

### Authentication Required

All endpoints require authentication:

- Users → Own withdrawals only
- Admins → All withdrawals (with role restrictions)

### Audit Logging

Every action logged:

- Who performed it
- What changed
- When it happened
- Why (for rejections)

### Data Protection

- Bank account numbers masked
- Sensitive details stripped
- Only last 4 digits stored/displayed

### Role-Based Access Control

- Cash withdrawals → Finance/Operations only
- Large amounts → Enhanced permissions
- High-risk users → Additional review

---

## Performance Optimization

### Fast Queries (O(log n))

- Aggregate counts via `@convex-dev/aggregate`
- Index-based lookups

### Slower Queries (O(n))

- `listForReview()` without status filter → collects all withdrawals
- Risk assessment → scans user history

**Optimization Tips**:

- Always filter by status in production
- Paginate large result sets
- Cache risk summaries

---

## Related Files

- [`transactions.ts`](./transactions.ts) - Transaction processing
- [`aggregateHelpers.ts`](./aggregateHelpers.ts) - Aggregate sync helpers
- [`risk.ts`](./risk.ts) - Risk assessment logic
- [`withdrawalPolicy.ts`](./withdrawalPolicy.ts) - Policy enforcement
- [`shared.ts`](./shared.ts) - Types and constants
