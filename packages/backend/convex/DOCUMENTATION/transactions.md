# Transaction Ledger Module Documentation

## Overview

**File**: `/packages/backend/convex/transactions.ts`

The transaction ledger module is the core financial processing system for the savings platform, handling all monetary movements with comprehensive audit trails and real-time balance updates.

---

## Key Responsibilities

### 1. **Transaction Processing**

- Posts new transactions (contributions, withdrawals, accruals, bonuses)
- Processes reversals to undo previous transactions
- Maintains idempotency via reference tracking
- Validates transaction integrity before posting

### 2. **Balance Management**

- Updates user total balances in real-time
- Updates user savings balances separately
- Updates individual savings plan balances
- Prevents negative balances through validation

### 3. **Audit & Compliance**

- Logs all admin and system transactions
- Tracks transaction source (USER, ADMIN, SYSTEM)
- Maintains complete metadata for each transaction
- Supports reconciliation and issue detection

### 4. **Aggregate Synchronization**

- Syncs with `@convex-dev/aggregate` tables
- Enables O(log n) analytics queries
- Maintains counts by user, type, and global totals

---

## Transaction Types

### CONTRIBUTION

**Purpose**: User deposits money into their savings account  
**Amount**: Positive (increases balance)  
**Metadata Required**:

- `channel`: Origin channel (e.g., "mobile_app", "web")
- `origin_reference`: External payment reference
- `note`: Optional memo

### WITHDRAWAL

**Purpose**: User withdraws money from savings  
**Amount**: Negative (decreases balance)  
**Metadata Required**:

- `method`: "bank_transfer" or "cash"
- `withdrawal_status`: Current status
- `bank_account`: For bank transfers
- `cash_details`: For cash withdrawals

### INTEREST_ACCRUAL / INVESTMENT_YIELD

**Purpose**: Periodic interest or investment returns credited  
**Amount**: Positive  
**Metadata Required**:

- `period_start`: Accrual period start (ISO string)
- `period_end`: Accrual period end (ISO string)
- `rate`: Applied rate
- `run_id`: Batch processing identifier

### REFERRAL_BONUS

**Purpose**: Reward for referring new users  
**Amount**: Positive  
**Metadata Required**:

- `referrer_user_id`: User who made referral
- `referred_user_id`: New user ID
- `trigger_transaction_reference`: Triggering transaction

### REVERSAL

**Purpose**: Undo a previous transaction  
**Amount**: Inverse of original (positive ↔ negative)  
**Metadata Required**:

- `original_transaction_id`: ID being reversed
- `original_reference`: Original transaction reference
- `original_type`: Type of original transaction
- `reason`: Business justification

---

## Core Functions

### Transaction Posting Flow

#### `postTransactionEntry()`

**Purpose**: Main entry point for creating transactions

**Process**:

1. Validate arguments and normalize metadata
2. Check idempotency (reference already exists?)
3. Verify reversal constraints (if applicable)
4. Calculate balance delta
5. Update user and plan balances
6. Insert transaction record
7. **Sync with aggregate tables** ← Critical for analytics
8. Audit log (for ADMIN/SYSTEM sources)

**Idempotency Guarantee**:

- Same reference + same payload = Returns existing transaction
- Same reference + different payload = Throws error
- Prevents accidental duplicate transactions

```typescript
const result = await postTransactionEntry(ctx, {
  userId: user._id,
  type: TxnType.CONTRIBUTION,
  amountKobo: 10000n, // ₦100.00
  reference: "contrib_123456",
  metadata: { channel: "mobile_app", origin_reference: "pay_ref_789" },
  source: TransactionSource.USER,
  actorId: user._id,
});

// Returns: { transaction: {...}, idempotent: false }
```

#### `reverseTransactionEntry()`

**Purpose**: Safely undo a transaction by creating an offsetting reversal

**Process**:

1. Validate original transaction exists
2. Create REVERSAL transaction with inverse amount
3. Link to original via metadata
4. Call `postTransactionEntry()` internally

**Important**: Reversals don't delete the original transaction - they create a new opposing entry to maintain audit trail.

```typescript
await reverseTransactionEntry(ctx, {
  originalTransactionId: "txn_123",
  reference: "rev_456",
  reason: "User requested cancellation",
  source: TransactionSource.ADMIN,
  actorId: admin._id,
});
```

---

### Balance Projection Functions

#### `computeProjectionDelta()`

**Purpose**: Calculate how a transaction affects balances

**Logic**:

- CONTRIBUTION → Increases all balances
- WITHDRAWAL → Decreases all balances
- ACCRUAL/YIELD → Increases total & savings, not plan-specific
- REFERRAL → Increases total & savings, not plan-specific
- REVERSAL → Not allowed as effective type (must resolve to original)

**Returns**: `ProjectionDelta` with three fields:

- `totalBalanceKobo`: Impact on user's total balance
- `savingsBalanceKobo`: Impact on user's savings balance
- `planAmountKobo`: Impact on specific plan balance (if linked)

#### `applyProjectionDelta()`

**Purpose**: Actually update the denormalized balance fields

**Safety Checks**:

- Prevents negative total balance
- Prevents negative savings balance
- Prevents negative plan balance

**Updates**:

1. Patch user's `total_balance_kobo`
2. Patch user's `savings_balance_kobo`
3. Patch plan's `current_amount_kobo` (if applicable)
4. Update timestamps

---

### Reconciliation System

#### `runReconciliation()`

**Purpose**: Comprehensive audit that verifies ledger integrity

**What It Does**:

1. Re-sums ALL transactions for each user
2. Compares calculated vs stored balances
3. Detects anomalies:
   - User total balance mismatches
   - User savings balance mismatches
   - Plan current amount mismatches
   - Orphaned reversals (missing original)
   - Double reversals (multiple reversals of same txn)
4. Creates reconciliation issues for review
5. Marks previous open issues as resolved

**When to Run**:

- Scheduled jobs (daily/weekly)
- After system incidents
- Manual admin trigger

**Performance**: O(n) operation - expensive but thorough

---

### Aggregate Integration

All transaction mutations now sync with `@convex-dev/aggregate`:

```typescript
// In postTransactionEntry():
const transaction = await ctx.db.get(transactionId);
await syncTransactionInsert(ctx, transaction); // ← Sync aggregates

// Enables instant queries like:
const count = await totalTransactions.count(ctx); // O(log n)
const userCount = await transactionsByUser.count(ctx, {
  bounds: { prefix: [userId] },
}); // O(log n)
```

**Aggregates Updated**:

- `totalTransactions` - Global count
- `transactionsByUser` - Count per user
- `transactionsByType` - Count by transaction type

---

## Metadata Normalization

Each transaction type has specific metadata requirements:

### Contribution Metadata

```typescript
{
  source: "USER",
  actor_id: "user_123",
  channel: "mobile_app",           // Required
  origin_reference: "pay_ref_456",  // Required
  note: "Monthly savings"           // Optional
}
```

### Withdrawal Metadata

```typescript
{
  source: "USER",
  actor_id: "user_123",
  method: "bank_transfer",              // Required
  withdrawal_status: "pending",          // Required
  bank_account: {                        // Required for bank transfer
    account_id: "ba_123",
    bank_name: "Chase",
    account_number_last4: "1234"
  },
  note: "Emergency fund access"         // Optional
}
```

### Reversal Metadata

```typescript
{
  source: "ADMIN",
  actor_id: "admin_456",
  original_transaction_id: "txn_789",   // Required
  original_reference: "contrib_123",     // Required
  original_type: "CONTRIBUTION",         // Required
  reason: "Duplicate entry"              // Required
}
```

---

## Error Handling

### Common Errors

**"Transaction would result in a negative balance"**

- User doesn't have sufficient funds
- Check balances before attempting withdrawal

**"Original transaction has already been reversed"**

- Attempting to reverse a transaction twice
- Use existing reversal instead

**"Reversal must target the original transaction user"**

- Can't reverse another user's transaction
- Verify ownership before reversing

**"Multiple transactions share the same reference"**

- Reference collision detected
- Use unique references for each transaction

**"Reference already exists with different payload"**

- Idempotency violation - same reference, different details
- Investigate potential fraud or bug

---

## Query Endpoints

### `listMine`

**Purpose**: Get current user's transactions with pagination

**Filters**:

- `type`: Filter by transaction type
- `planId`: Filter by specific savings plan
- `dateFrom` / `dateTo`: Date range filter

**Returns**: Paginated list sorted by creation date (newest first)

### `listForAdmin`

**Purpose**: Admin view of all transactions across users

**Filters**:

- `userId`: Filter to specific user
- `type`: Filter by transaction type
- `reference`: Search by exact reference
- `planId`: Filter by savings plan
- `dateFrom` / `dateTo`: Date range

**Optimization**: Uses different indexes based on filters for performance

### `getByReference`

**Purpose**: Find a transaction by its reference

**Use Cases**:

- Verify transaction existence
- Debug idempotency issues
- Customer support inquiries

---

## Best Practices

### 1. Always Use References

Every transaction MUST have a unique reference. This enables:

- Idempotency (prevents duplicates)
- Easy lookup and debugging
- External system reconciliation

### 2. Validate Before Posting

Check business rules BEFORE calling `postTransactionEntry`:

- Sufficient balance for withdrawals
- Correct amount signs
- Valid metadata structure

### 3. Handle Reversals Carefully

- Never reverse a reversal
- Always provide clear reason
- Log admin actions for compliance

### 4. Test with Realistic Data

Transaction logic is complex - test with:

- Multiple concurrent transactions
- Edge cases (zero balance, large amounts)
- Reversal scenarios
- Idempotency cases

### 5. Monitor Aggregates

After deployment, verify:

- Aggregate counts match actual counts
- Queries return quickly (<10ms)
- No drift over time

---

## Performance Considerations

### Fast Paths (O(1) or O(log n))

- Single transaction lookup by ID
- Aggregate queries (count, sum)
- Index-based lookups

### Slow Paths (O(n))

- `runReconciliation()` - scans all transactions
- `buildProjectedUserBalances()` - re-sums history
- `buildProjectedPlanAmount()` - re-sums plan history

**Optimization Strategy**:

- Use aggregates for dashboard metrics
- Use projection rebuilds only for reconciliation
- Cache frequently accessed summaries

---

## Security & Compliance

### Audit Logging

Transactions are logged when:

- Source is ADMIN or SYSTEM
- Action is REVERSAL
- Part of compliance workflow

**Logged Metadata**:

- Actor ID (who performed action)
- Resource ID (transaction ID)
- Amount and type
- Source system

### Access Control

- Users can only see their own transactions (`listMine`)
- Admins can see all transactions (`listForAdmin`)
- No public endpoints - authentication required

### Data Integrity

- Immutable transaction records (never UPDATE, only INSERT or REVERSE)
- Referential integrity via IDs
- Type-safe validators prevent invalid states

---

## Testing Checklist

- [ ] Post contribution → verify balance increases
- [ ] Post withdrawal → verify balance decreases
- [ ] Attempt withdrawal > balance → verify rejection
- [ ] Reverse transaction → verify original unchanged, reversal created
- [ ] Duplicate reference (same payload) → verify idempotent response
- [ ] Duplicate reference (different payload) → verify error
- [ ] Run reconciliation → verify issues detected for anomalies
- [ ] Aggregate queries → verify counts match reality
- [ ] Metadata validation → verify required fields enforced

---

## Related Files

- [`aggregateHelpers.ts`](./aggregateHelpers.ts) - Sync helpers
- [`aggregates.ts`](./aggregates.ts) - Aggregate definitions
- [`schema.ts`](./schema.ts) - Database schema
- [`shared.ts`](./shared.ts) - Shared types and constants
- [`auditLog.ts`](./auditLog.ts) - Audit logging
