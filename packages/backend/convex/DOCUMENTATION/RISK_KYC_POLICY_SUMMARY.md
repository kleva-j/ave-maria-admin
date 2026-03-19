# Risk, KYC & Withdrawal Policy Documentation

## Overview

This documentation set covers four critical modules in the financial operations backend:

1. **Risk Assessment System** (`risk.ts`) - Fraud prevention and real-time risk evaluation
2. **Withdrawal Policy Engine** (`withdrawalPolicy.ts`) - Action capability computation and authorization
3. **KYC Document Management** (`kycDocuments.ts`) - Secure document upload and retrieval
4. **KYC Verification Pipeline** (`kyc.ts`) - Identity verification and status transitions

---

## Module Relationships

```
┌─────────────────────────────────────────────────────┐
│              User Uploads Documents                 │
│                 (kycDocuments.ts)                   │
└─────────────────────────┬───────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│           KYC Verification Process                  │
│                      (kyc.ts)                       │
│  ─────────────────────────────────────────────────  │
│  • Automated provider verification                  │
│  • Manual admin review                              │
│  • Status transitions (PENDING_KYC → ACTIVE/CLOSED) │
│  • Aggregate sync                                   │
└─────────────────────────┬───────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│              User Requests Withdrawal               │
│                 (withdrawals.ts)                    │
└─────────────────────────┬───────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│           Risk Assessment Evaluation                │
│                    (risk.ts)                        │
│  ─────────────────────────────────────────────────  │
│  • Check manual holds                               │
│  • Validate bank account cooldown                   │
│  • Enforce daily/velocity limits                    │
│  • Log risk events                                  │
└─────────────────────────┬───────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│         Policy Capability Calculation               │
│               (withdrawalPolicy.ts)                 │
│  ─────────────────────────────────────────────────  │
│  • Status-based action validation                   │
│  • Role permission checks                           │
│  • Cash withdrawal restrictions                     │
│  • Build capability matrix                          │
└─────────────────────────┬───────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│            Admin Review & Decision                  │
│  ─────────────────────────────────────────────────  │
│  • View capabilities (approve/reject/process)       │
│  • Take action based on permissions                 │
│  • Audit trail logged                               │
└─────────────────────────────────────────────────────┘
```

---

## Key Features by Module

### 1. Risk Assessment System (`risk.ts`)

**Core Capabilities**:

- ✅ Real-time risk scoring for withdrawal requests
- ✅ Automated fraud detection with 5 rule types
- ✅ Manual user holds placed by administrators
- ✅ Velocity checking (2 per 15 minutes)
- ✅ Daily limits (₦500,000, 3 withdrawals)
- ✅ Bank account cooldown (24 hours)
- ✅ Comprehensive risk event logging

**Key Functions**:

- `evaluateWithdrawalRiskDecision()` - Pure risk evaluation function
- `assertWithdrawalRequestAllowed()` - Pre-withdrawal validation
- `placeUserHold()` / `releaseUserHold()` - Manual controls
- `buildWithdrawalRiskSummary()` - UI-ready risk data

**Integration Points**:

- Called by `withdrawals.requestWithdrawal()` mutation
- Integrates with `auditLog.ts` for event tracking
- Provides data to `withdrawalPolicy.ts` for capability checks

[📖 Full Documentation →](./risk.md)

---

### 2. Withdrawal Policy Engine (`withdrawalPolicy.ts`)

**Core Capabilities**:

- ✅ Role-based action authorization
- ✅ Status transition enforcement
- ✅ Cash withdrawal restrictions (FINANCE/OPERATIONS/SUPER_ADMIN only)
- ✅ Risk-aware decision making
- ✅ Capability matrix generation for UI

**Key Types**:

```typescript
type WithdrawalActionCapabilities = {
  approve: { allowed: boolean; reason?: string };
  reject: { allowed: boolean; reason?: string };
  process: { allowed: boolean; reason?: string };
};
```

**Authorization Rules**:
| Action | PENDING | APPROVED | PROCESSED | REJECTED |
|--------|---------|----------|-----------|----------|
| APPROVE | ✅ | ❌ | ❌ | ❌ |
| REJECT | ✅ | ❌ | ❌ | ❌ |
| PROCESS | ❌ | ✅\* | ❌ | ❌ |

\*Cash withdrawals require FINANCE, OPERATIONS, or SUPER_ADMIN role

**Key Functions**:

- `buildWithdrawalCapabilities()` - Complete capability matrix
- `buildWithdrawalActionCapability()` - Single action evaluation
- `getCashWithdrawalRoleBlockedReason()` - Cash restriction check

**Integration Points**:

- Used in admin dashboard UI for button enablement
- Validates mutations before processing
- Integrates with risk assessment results

[📖 Full Documentation →](./withdrawalPolicy.md)

---

### 3. KYC Document Management (`kycDocuments.ts`)

**Core Capabilities**:

- ✅ Secure upload workflow with pre-signed URLs
- ✅ Direct-to-storage uploads (bypasses backend)
- ✅ File type and size validation
- ✅ Access control enforcement (owner/admin only)
- ✅ Document lifecycle management
- ✅ Comprehensive audit trail

**Document Requirements**:
| Type | Required? | Description |
|------|-----------|-------------|
| GOVERNMENT_ID | ✅ Yes | National ID, Passport, Driver's License |
| SELFIE_WITH_ID | ✅ Yes | Photo holding government ID |
| PROOF_OF_ADDRESS | ❌ Optional | Utility bill, bank statement |
| BANK_STATEMENT | ❌ Optional | Financial institution statement |

**File Restrictions**:

- Max size: 10MB
- Formats: JPG, PNG, PDF
- MIME types: image/jpeg, image/png, application/pdf

**Upload Workflow**:

```
1. getUploadUrl() → Pre-signed URL
2. Client uploads directly to Convex Storage
3. uploadDocument() → Create DB record + Link storage ID
4. Document available for review
```

**Key Functions**:

- `getUploadUrl()` - Generate pre-signed upload URL
- `uploadDocument()` - Confirm upload and create record
- `getDocumentUrl()` - Generate download URL
- `listMyDocuments()` - User's document list
- `deleteDocument()` - Delete pending documents

**Integration Points**:

- Used by `kyc.verifyIdentity()` for document validation
- Admin review via `kyc.adminListPendingKyc()`
- Integrates with `auditLog.ts` for all operations

[📖 Full Documentation →](./kycDocuments.md)

---

### 4. KYC Verification Pipeline (`kyc.ts`)

**Core Capabilities**:

- ✅ Automated verification via simulated provider
- ✅ Manual admin review workflow
- ✅ User status transitions (PENDING_KYC → ACTIVE/CLOSED)
- ✅ Document requirement validation
- ✅ Aggregate synchronization
- ✅ Comprehensive audit logging

**Verification Flow**:

```
1. User uploads required documents (kycDocuments.ts)
   ↓
2. verifyIdentity() action called
   ↓
3. Validate document requirements
   ↓
4. Call external provider (simulateKycProvider)
   - 80% auto-approval rate
   - 2-second simulated delay
   - Random rejection reasons
   ↓
5. processKycResult() mutation
   - Update user status
   - Mark documents as reviewed
   - Sync aggregates
   ↓
6. Result:
   - APPROVED → ACTIVE status
   - REJECTED → CLOSED status
```

**Admin Review Flow**:

```
1. adminListPendingKyc() → Queue of pending users
   ↓
2. Admin reviews documents (via kycDocuments.getDocumentUrl)
   ↓
3. adminReviewKyc({ approved, reason })
   - Updates user status
   - Marks documents reviewed
   - Syncs aggregates
   - Logs comprehensive audit trail
```

**Key Functions**:

- `verifyIdentity()` - Main verification action
- `simulateKycProvider()` - External provider mock
- `adminListPendingKyc()` - Pending review queue
- `adminReviewKyc()` - Manual approval/rejection

**Status Transitions**:

```
PENDING_KYC
   ├─[APPROVED]→ ACTIVE (full platform access)
   └─[REJECTED]→ CLOSED (restricted, can reapply)
```

**Integration Points**:

- Depends on `kycDocuments.ts` for document uploads
- Calls `users.processKycResult()` internal mutation
- Syncs with aggregates via `syncUserUpdate()`
- Logs to `auditLog.ts`

[📖 Full Documentation →](./kyc.md)

---

## Common Workflows

### Workflow 1: User Onboarding & First Withdrawal

```
Step 1: Registration
├─ User creates account
└─ Status: PENDING_KYC

Step 2: Document Upload
├─ GET kyc.getKycRequirements()
├─ POST kycDocuments.getUploadUrl()
├─ UPLOAD → Convex Storage
└─ POST kycDocuments.uploadDocument()

Step 3: Identity Verification
├─ POST kyc.verifyIdentity()
├─ Automated provider check (80% approval)
└─ Result:
    ├─ APPROVED → Status: ACTIVE
    └─ REJECTED → Status: CLOSED (can reapply)

Step 4: Request Withdrawal
├─ GET risk.buildWithdrawalRiskSummary()
├─ POST withdrawals.requestWithdrawal()
│  ├─ assertWithdrawalRequestAllowed()
│  │  ├─ Check manual holds
│  │  ├─ Validate bank cooldown
│  │  ├─ Check daily limits
│  │  └─ Verify velocity
│  ├─ Create WITHDRAWAL transaction
│  └─ Create withdrawal record (PENDING)
└─ Sync aggregates

Step 5: Admin Review
├─ GET kyc.adminListPendingKyc()
├─ GET withdrawalPolicy.buildWithdrawalCapabilities()
│  ├─ Check status (PENDING → can approve/reject)
│  ├─ Check role (cash requires FINANCE/OPS/SUPER_ADMIN)
│  └─ Check risk (holds block approval)
└─ Admin takes action:
    ├─ APPROVE → Status: APPROVED
    └─ REJECT → Status: REJECTED + REVERSAL transaction
```

---

### Workflow 2: Admin Withdrawal Review

```
Step 1: Queue Display
├─ Admin navigates to withdrawal queue
├─ Query withdrawals.forReview()
│  └─ Returns PENDING withdrawals sorted by request time
└─ For each withdrawal:
    ├─ Calculate capabilities via buildWithdrawalCapabilities()
    └─ Display enabled action buttons

Step 2: Risk Assessment
├─ Query risk.buildWithdrawalRiskSummary(userId)
├─ Display risk indicators:
│  ├─ Active holds (red alert)
│  ├─ Recent risk events
│  └─ Bank account age (<24h = cooldown warning)
└─ If high risk → Show warning banner

Step 3: Approval Path
├─ Admin clicks "Approve"
├─ Mutation withdrawals.approve(withdrawalId)
│  ├─ Validate capability (allowed === true)
│  ├─ Check no active hold (via assertWithdrawalAdminActionAllowed)
│  ├─ Update status: PENDING → APPROVED
│  ├─ Set approved_by, approved_at
│  ├─ Sync aggregates (withdrawalsByStatus.replace)
│  └─ Log audit trail
└─ Success toast + Remove from queue

Step 4: Rejection Path
├─ Admin clicks "Reject"
├─ Prompt for reason (required)
├─ Mutation withdrawals.reject(withdrawalId, reason)
│  ├─ Validate capability
│  ├─ Update status: PENDING → REJECTED
│  ├─ Create REVERSAL transaction (refund user)
│  ├─ Sync aggregates
│  └─ Log audit trail with reason
└─ Success toast + Refund processed

Step 5: Processing (Cash Withdrawals Only)
├─ Admin clicks "Process Payment"
├─ Mutation withdrawals.process(withdrawalId)
│  ├─ Validate capability (role check for cash)
│  ├─ Update status: APPROVED → PROCESSED
│  ├─ Sync aggregates
│  └─ Log audit trail
└─ Success toast + Mark as paid
```

---

### Workflow 3: Risk Hold Management

```
Scenario: Suspicious activity detected

Step 1: Place Hold
├─ Admin identifies suspicious pattern
├─ Mutation risk.placeUserHold({ userId, reason })
│  ├─ Check no existing active hold
│  ├─ Insert user_risk_hold (status: ACTIVE)
│  ├─ Log RISK_EVENT: HOLD_PLACED
│  └─ Audit log entry
└─ Result: All withdrawals blocked

Step 2: User Impact
├─ User attempts withdrawal
├─ Risk evaluation:
│  ├─ activeHold !== null → BLOCKED
│  └─ Rule: "manual_hold"
├─ Error thrown:
│  ├─ code: "withdrawal_risk_blocked"
│  └─ message: "Withdrawals are currently blocked..."
└─ Withdrawal request denied

Step 3: Investigation
├─ Admin reviews user activity
├─ Checks audit logs
├─ Reviews transaction history
└─ Determines resolution

Step 4: Release Hold
├─ If cleared: risk.releaseUserHold({ userId })
│  ├─ Update hold status: ACTIVE → RELEASED
│  ├─ Set released_by_admin_id, released_at
│  ├─ Log RISK_EVENT: HOLD_RELEASED
│  └─ Audit log with before/after
└─ Result: Withdrawals unblocked

Step 5: Maintain Hold
├─ If fraud confirmed: Keep hold active
├─ Escalate to compliance team
├─ Additional documentation required
└─ Possible account closure
```

---

## Error Handling

### Risk Errors

#### Withdrawal Blocked by Risk

```typescript
{
  code: "withdrawal_risk_blocked",
  scope: "withdrawals",
  rule: WithdrawalRiskRule,  // Which rule triggered
  message: string,            // Human-readable reason
  details: {
    hold_id?: string,
    hold_reason?: string,
    attempted_amount_kobo?: string,
    recent_daily_amount_kobo?: string,
    daily_limit_kobo?: string,
    // ... other context
  }
}
```

**Common Rules**:

- `"manual_hold"` - Admin-placed hold
- `"bank_account_cooldown"` - <24h since bank change
- `"daily_amount_limit"` - Exceeded ₦500,000
- `"daily_count_limit"` - More than 3 today
- `"velocity_limit"` - More than 2 in 15 minutes

---

### Policy Errors

#### Action Forbidden

```typescript
{
  code: "withdrawal_action_forbidden",
  action: WithdrawalAction,
  method: WithdrawalMethod,
  allowed_roles: AdminRole[],
  message: string,
}
```

**Example Messages**:

- "Only pending withdrawals can be approved"
- "Cash withdrawals can only be processed by Finance, Operations, or Super Admin"

---

### KYC Errors

#### Missing Documents

```typescript
throw new ConvexError(
  `Missing required KYC documents: ${missingRequired.join(", ")}`
);
// "Missing required KYC documents: government_id, selfie_with_id"
```

#### Invalid File

```typescript
throw new ConvexError(
  `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`
);
// "Invalid file type. Allowed: .jpg, .jpeg, .png, .pdf"
```

#### File Too Large

```typescript
throw new ConvexError(
  `File too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB`
);
// "File too large. Maximum size: 10MB"
```

---

## Testing Guide

### Unit Tests

```typescript
// Test risk evaluation
test("should block due to manual hold", () => {
  const decision = evaluateWithdrawalRiskDecision({
    amountKobo: 10_000n,
    method: WithdrawalMethod.BANK_TRANSFER,
    now: Date.now(),
    activeHold: {
      _id: "hold123",
      reason: "Investigation pending",
      placed_at: Date.now() - 100000,
    },
    lastBankAccountChangeAt: undefined,
    recentDailyAmountKobo: 0n,
    recentDailyCount: 0,
    recentVelocityCount: 0,
  });

  expect(decision.blocked).toBe(true);
  expect(decision.rule).toBe("manual_hold");
  expect(decision.severity).toBe(RiskSeverity.CRITICAL);
});

// Test policy capabilities
test("should allow approve for pending withdrawal", () => {
  const caps = buildWithdrawalCapabilities(
    AdminRole.FINANCE,
    {
      status: WithdrawalStatus.PENDING,
      method: WithdrawalMethod.BANK_TRANSFER,
    },
    { has_active_hold: false }
  );

  expect(capabilities.approve.allowed).toBe(true);
  expect(capabilities.reject.allowed).toBe(true);
  expect(capabilities.process.allowed).toBe(false);
});

// Test KYC document validation
test("should accept valid document upload", async () => {
  const result = await ctx.runMutation(kycDocuments.uploadDocument, {
    documentType: DOCUMENT_TYPES.GOVERNMENT_ID,
    storageId: "storage:123" as any,
    fileName: "passport.jpg",
    fileSize: 1024 * 1024, // 1MB
    mimeType: "image/jpeg",
  });

  expect(result._id).toBeDefined();
  expect(result.status).toBe(KYCStatus.PENDING);
});

// Test KYC verification flow
test("should verify identity successfully", async () => {
  const userId = await createTestUser({ status: UserStatus.PENDING_KYC });
  await uploadTestDocument(userId, DOCUMENT_TYPES.GOVERNMENT_ID);
  await uploadTestDocument(userId, DOCUMENT_TYPES.SELFIE_WITH_ID);

  const result = await ctx.runAction(kyc.verifyIdentity);

  expect(result.approved).toBe(true); // 80% chance

  // Verify user status changed
  const updatedUser = await ctx.db.get(userId);
  expect(updatedUser?.status).toBe(UserStatus.ACTIVE);
});
```

---

### Integration Tests

```typescript
// Full withdrawal flow test
test("complete withdrawal flow with risk and policy", async () => {
  // 1. Create and verify KYC
  const userId = await createTestUser({ status: UserStatus.PENDING_KYC });
  await uploadTestDocument(userId, DOCUMENT_TYPES.GOVERNMENT_ID);
  await uploadTestDocument(userId, DOCUMENT_TYPES.SELFIE_WITH_ID);

  const kycResult = await ctx.runAction(kyc.verifyIdentity);
  expect(kycResult.approved).toBe(true);

  // 2. Request withdrawal
  const withdrawalId = await ctx.runMutation(withdrawals.requestWithdrawal, {
    amount_kobo: 10_000n,
    method: WithdrawalMethod.BANK_TRANSFER,
  });

  // 3. Check capabilities
  const withdrawal = await ctx.db.get(withdrawalId);
  const caps = buildWithdrawalCapabilities(AdminRole.FINANCE, withdrawal, {
    has_active_hold: false,
  });

  expect(capabilities.approve.allowed).toBe(true);

  // 4. Approve withdrawal
  await ctx.runMutation(withdrawals.approve, { withdrawalId });

  // 5. Verify status change
  const updated = await ctx.db.get(withdrawalId);
  expect(updated?.status).toBe(WithdrawalStatus.APPROVED);

  // 6. Process withdrawal
  await ctx.runMutation(withdrawals.process, { withdrawalId });

  // 7. Verify final status
  const final = await ctx.db.get(withdrawalId);
  expect(final?.status).toBe(WithdrawalStatus.PROCESSED);
});
```

---

## Performance Considerations

### Query Optimization

All modules use indexes for fast lookups:

```typescript
// Risk queries
.withIndex("by_user_id_and_status", q =>
  q.eq("user_id", userId).eq("status", RiskHoldStatus.ACTIVE)
)

// KYC document queries
.withIndex("by_user_id_and_status", q =>
  q.eq("user_id", userId).eq("status", KYCStatus.PENDING)
)

// Withdrawal queries
.withIndex("by_requested_by", q => q.eq("requested_by", userId))
```

### Caching Opportunities

Consider caching these frequently-called queries:

```typescript
// Risk summary (cache for 5 seconds)
const cachedRisk = await cache.get(`risk:${userId}`);
if (cachedRisk) return cachedRisk;

const summary = await buildWithdrawalRiskSummary(ctx, userId);
await cache.set(`risk:${userId}`, summary, 5000);
return summary;

// KYC requirements (static, cache indefinitely)
const requirements = await cache.get("kyc:requirements");
if (requirements) return requirements;

const reqs = await getKycRequirements();
await cache.set("kyc:requirements", reqs);
return reqs;
```

---

## Security Notes

⚠️ **Critical Security Controls**:

1. **Authentication Required**

   - All mutations require authenticated user or admin
   - No anonymous access to financial operations

2. **Access Control Enforcement**

   - Users can only view their own documents
   - Admins can view all documents but actions are logged
   - Role-based restrictions for cash withdrawals

3. **Audit Trail**

   - Every operation logged with full context
   - Before/after state captured for changes
   - Actor identity recorded

4. **Input Validation**

   - File types validated (no executables)
   - File sizes limited (DoS prevention)
   - Document uniqueness enforced

5. **Aggregate Synchronization**
   - Status changes sync with analytics
   - Prevents data drift
   - Maintains accurate counts

---

## Monitoring Recommendations

Track these metrics in production:

```typescript
// Risk metrics
const riskMetrics = {
  withdrawals_blocked_today: countBlockedWithdrawals(),
  active_holds: countActiveHolds(),
  avg_review_time: calculateAvgReviewTime(),
  block_reasons_breakdown: groupByBlockReason(),
};

// KYC metrics
const kycMetrics = {
  pending_queue_size: countPendingKyc(),
  approval_rate: calculateApprovalRate(),
  avg_time_to_review: calculateAvgReviewTime(),
  rejection_reasons: groupByRejectionReason(),
};

// Document metrics
const docMetrics = {
  uploads_today: countUploadsToday(),
  avg_file_size: calculateAverageFileSize(),
  rejected_documents: countRejectedDocs(),
};

// Policy metrics
const policyMetrics = {
  actions_by_role: groupActionsByRole(),
  cash_withdrawals_by_finance: countCashWithdrawalsProcessed(),
  blocked_actions: countBlockedActions(),
};
```

---

## Related Files

- [`withdrawals.ts`](./withdrawals.md) - Withdrawal processing implementation
- [`transactions.ts`](./transactions.md) - Transaction ledger system
- [`aggregateHelpers.ts`](./aggregateHelpers.md) - Aggregate synchronization helpers
- [`auditLog.ts`](./auditLog.md) - Audit trail system
- [`shared.ts`](./shared.md) - Enum and constant definitions
- [`types.ts`](./types.md) - TypeScript type definitions

---

## Quick Reference

### Configuration Constants

| Constant                          | Value       | Purpose               |
| --------------------------------- | ----------- | --------------------- |
| `WITHDRAWAL_DAILY_LIMIT_KOBO`     | 50,000,000n | ₦500,000 daily limit  |
| `WITHDRAWAL_DAILY_COUNT_LIMIT`    | 3           | Max 3 withdrawals/day |
| `WITHDRAWAL_VELOCITY_COUNT_LIMIT` | 2           | Max 2 per 15 minutes  |
| `BANK_ACCOUNT_COOLDOWN_MS`        | 86,400,000  | 24-hour cooldown      |
| `MAX_FILE_SIZE`                   | 10,485,760  | 10MB max file size    |
| `DAY_MS`                          | 86,400,000  | Milliseconds in day   |
| `VELOCITY_WINDOW_MS`              | 900,000     | 15-minute window      |

### Status Flows

#### User Status

```
PENDING_KYC → [APPROVED] → ACTIVE
PENDING_KYC → [REJECTED] → CLOSED
```

#### Withdrawal Status

```
PENDING → [APPROVE] → APPROVED → [PROCESS] → PROCESSED
PENDING → [REJECT] → REJECTED
```

#### KYC Document Status

```
PENDING → [APPROVE] → APPROVED (locked)
PENDING → [REJECT] → REJECTED (can delete)
```

### Role Permissions

| Role        | Bank Transfer | Cash Withdrawal | Place Holds |
| ----------- | ------------- | --------------- | ----------- |
| SUPER_ADMIN | ✅            | ✅              | ✅          |
| FINANCE     | ✅            | ✅              | ✅          |
| OPERATIONS  | ✅            | ✅              | ✅          |
| ADMIN       | ✅            | ❌              | ✅          |
| SUPPORT     | ✅            | ❌              | ✅          |

---

## Changelog

| Version | Date       | Changes                             |
| ------- | ---------- | ----------------------------------- |
| 1.0.0   | 2026-03-13 | Initial comprehensive documentation |
|         |            | - Risk assessment system            |
|         |            | - Withdrawal policy engine          |
|         |            | - KYC document management           |
|         |            | - KYC verification pipeline         |

---

**Last Updated**: March 13, 2026  
**Maintained By**: Backend Team
