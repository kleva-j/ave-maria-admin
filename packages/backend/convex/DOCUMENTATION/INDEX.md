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
- Rejection and refund logic
- Queue management

[📖 Full Documentation →](./withdrawals.md)

---

## Supporting Modules

### 3. [Aggregate System](./AGGREGATES_GUIDE.md)
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

### 4. [Aggregate Helpers](./aggregateHelpers.ts)
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
| Type | Purpose | Amount Sign | Example |
|------|---------|-------------|---------|
| CONTRIBUTION | User deposits | Positive (+) | ₦1,000 savings |
| WITHDRAWAL | User withdrawals | Negative (-) | ₦500 payout |
| INTEREST_ACCRUAL | Interest earned | Positive (+) | Monthly interest |
| INVESTMENT_YIELD | Investment returns | Positive (+) | Quarterly yield |
| REFERRAL_BONUS | Referral reward | Positive (+) | ₦2,000 bonus |
| REVERSAL | Undo transaction | Inverse | Cancel mistake |

---

### Withdrawal Statuses
| Status | Meaning | Next Actions |
|--------|---------|--------------|
| PENDING | Awaiting review | Approve or Reject |
| APPROVED | Ready for payout | Process |
| REJECTED | Denied | Auto-refund issued |
| PROCESSED | Payout complete | None (terminal) |

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
│                 Frontend Apps                        │
│  (Expo Mobile, TanStack Web)                         │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│              Convex Backend                          │
│                                                      │
│  ┌────────────────────────────────────────────┐     │
│  │  transactions.ts                            │     │
│  │  - post()                                   │     │
│  │  - reverse()                                │     │
│  │  - runReconciliation()                      │     │
│  └────────────────┬───────────────────────────┘     │
│                   │                                  │
│  ┌────────────────▼───────────────────────────┐     │
│  │  withdrawals.ts                             │     │
│  │  - request()                                │     │
│  │  - approve()                                │     │
│  │  - reject()                                 │     │
│  │  - process()                                │     │
│  └────────────────┬───────────────────────────┘     │
│                   │                                  │
│  ┌────────────────▼───────────────────────────┐     │
│  │  aggregateHelpers.ts                        │     │
│  │  - syncTransactionInsert()                  │     │
│  │  - syncWithdrawalUpdate()                   │     │
│  │  - syncUserUpdate()                         │     │
│  └────────────────┬───────────────────────────┘     │
│                   │                                  │
│  ┌────────────────▼───────────────────────────┐     │
│  │  aggregates.ts (@convex-dev/aggregate)      │     │
│  │  - totalTransactions                        │     │
│  │  - withdrawalsByStatus                      │     │
│  │  - usersByStatus                            │     │
│  └────────────────────────────────────────────┘     │
│                                                      │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│            Convex Database                           │
│  - transactions                                      │
│  - withdrawals                                       │
│  - users                                             │
│  - user_savings_plans                                │
│  - aggregate_btree_* (internal tables)               │
└─────────────────────────────────────────────────────┘
```

---

## Error Codes Quick Reference

### Transaction Errors
| Error | Cause | Solution |
|-------|-------|----------|
| "reference is required" | Missing reference field | Provide unique reference |
| "Transaction would result in negative balance" | Insufficient funds | Check balance first |
| "Original transaction has already been reversed" | Double reversal attempt | Verify not already reversed |
| "Multiple transactions share the same reference" | Reference collision | Use unique references |

### Withdrawal Errors
| Error | Cause | Solution |
|-------|-------|----------|
| "Only active users can request withdrawals" | User not ACTIVE status | Complete KYC first |
| "Insufficient balance" | Amount > available balance | Reduce amount |
| "Add and verify a bank account" | No verified account | Add bank account |
| "Only pending withdrawals can be approved" | Wrong status | Check status before acting |

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

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-03-13 | Initial comprehensive documentation |
| | | - Transactions module docs |
| | | - Withdrawals module docs |
| | | - Aggregate integration guide |

---

**Last Updated**: March 13, 2026  
**Maintained By**: Backend Team
