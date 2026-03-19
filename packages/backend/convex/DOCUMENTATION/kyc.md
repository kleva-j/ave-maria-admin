# KYC Identity Verification System

## Overview

The `kyc.ts` module implements a comprehensive Know Your Customer (KYC) identity verification pipeline. It supports both automated verification through simulated third-party providers and manual admin review, with full audit logging and aggregate synchronization.

**Primary Responsibilities**:

- Automated KYC verification via external provider simulation
- Manual admin review and approval workflow
- Document requirement validation
- User status transitions based on KYC results
- Risk assessment integration
- Audit trail maintenance

---

## Architecture

```
┌─────────────────────┐
│   User Submits      │
│   KYC Documents     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────┐
│  verifyIdentity Action  │
│  ─────────────────────  │
│  • Validate documents   │
│  • Call KYC provider    │
│  • Process result       │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  simulateKycProvider    │
│  (External API Mock)    │
│  • 80% auto-approval    │
│  • Random rejections    │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  processKycResult       │
│  • Update user status   │
│  • Mark documents       │
│  • Sync aggregates      │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────┐
│  APPROVED → ACTIVE  │
│  REJECTED → CLOSED  │
└─────────────────────┘
```

---

## Required KYC Documents

Users must submit these documents before verification:

```typescript
const REQUIRED_KYC_DOCUMENTS = [
  DOCUMENT_TYPES.GOVERNMENT_ID, // National ID card, Passport, Driver's license
  DOCUMENT_TYPES.SELFIE_WITH_ID, // Selfie while holding the government ID
] as const;
```

**Validation Rules**:

- Both documents must be uploaded before verification can proceed
- Documents must be in PENDING status
- User must be in PENDING_KYC status

---

## KYC Status Flow

```
User Registration
        ↓
PENDING_KYC ─────────────────────┐
        ↓                        │
  Upload Documents               │
        ↓                        │
  verifyIdentity()              │
        ↓                        │
   ┌────┴─────┐                  │
   │          │                  │
APPROVED   REJECTED              │
   ↓          ↓                  │
 ACTIVE    CLOSED ←──────────────┘
            │
            │ (Admin override possible)
            └─────────────────────→ (Manual review path)
```

### Status Definitions

```typescript
enum UserStatus {
  PENDING_KYC = "pending_kyc", // Awaiting document upload and verification
  ACTIVE = "active", // KYC approved, full platform access
  CLOSED = "closed", // KYC rejected, account restricted
}
```

---

## Core Functions

### `verifyIdentity(args)`

Main action to trigger the complete KYC verification process.

**Type**: Action (can call external services)

**Arguments**: None (uses authenticated user context)

**Returns**:

```typescript
{
  approved: boolean;
  reason: string;
  userId: Id<"users">;
}
```

**Workflow**:

1. **Fetch User Data**

   - Calls `getViewerKycData()` internal query
   - Retrieves user record and pending documents

2. **Validate Requirements**

   - Checks for pending documents
   - Verifies user status is PENDING_KYC
   - Ensures required documents are present

3. **Call External Provider**

   - Invokes `simulateKycProvider()` internal action
   - Simulates 2-second network delay
   - Returns 80% approval rate with random rejection reasons

4. **Process Result**

   - Calls `processKycResult()` mutation
   - Updates user status and documents
   - Syncs aggregates

5. **Return Outcome**
   - Provides approval status and reason

**Implementation**:

```typescript
export const verifyIdentity = action({
  handler: async (ctx) => {
    // Step 1: Fetch user data and pending documents
    const data: KycData = await ctx.runQuery(internal.kyc.getViewerKycData);

    if (data.documents.length === 0) {
      throw new ConvexError("No pending KYC documents found to verify");
    }

    if (data.user.status !== UserStatus.PENDING_KYC) {
      throw new ConvexError("User is not in pending_kyc status");
    }

    // Step 2: Validate required documents
    const submittedTypes = new Set(data.documents.map((d) => d.document_type));
    const missingRequired = REQUIRED_KYC_DOCUMENTS.filter(
      (docType) => !submittedTypes.has(docType)
    );

    if (missingRequired.length > 0) {
      throw new ConvexError(
        `Missing required KYC documents: ${missingRequired.join(", ")}`
      );
    }

    // Step 3: Call external provider (simulated)
    const result = await ctx.runAction(internal.kyc.simulateKycProvider, {
      userId: data.user._id,
      documentTypes: data.documents.map((d) => d.document_type),
    });

    // Step 4: Process result
    await ctx.runMutation(internal.users.processKycResult, {
      userId: data.user._id,
      approved: result.approved,
      reason: result.reason,
    });

    // Step 5: Return outcome
    return { ...result, userId: data.user._id };
  },
});
```

**Error Scenarios**:

| Error                               | Condition                               |
| ----------------------------------- | --------------------------------------- |
| "No pending KYC documents found"    | No documents in PENDING status          |
| "User is not in pending_kyc status" | User already processed or not started   |
| "Missing required KYC documents"    | Missing government_id or selfie_with_id |

**Usage**:

```typescript
const result = await ctx.runAction(kyc.verifyIdentity);

if (result.approved) {
  toast.success("KYC verified successfully!");
} else {
  toast.error(`KYC failed: ${result.reason}`);
}
```

---

### `simulateKycProvider(args)`

Simulates a third-party KYC provider API call (e.g., Smile Identity, Dojah).

**Type**: Internal Action

**Arguments**:

```typescript
{
  userId: v.id("users");
  documentTypes: v.array(v.string());
}
```

**Returns**:

```typescript
{
  approved: boolean;
  reason: string;
}
```

**Simulation Logic**:

```typescript
export const simulateKycProvider = internalAction({
  handler: async () => {
    // Simulate network latency (2 seconds)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Simulate 80% approval rate
    const isApproved = Math.random() < 0.8;

    if (isApproved) {
      return {
        approved: true,
        reason: "Automatically verified by provider",
      };
    }

    // Random rejection reasons
    const reasons = [
      "Document illegible or blurry",
      "Face mismatch with government ID",
      "ID expired or invalid",
      "Suspected fraudulent document",
    ];

    return {
      approved: false,
      reason: reasons[Math.floor(Math.random() * reasons.length)],
    };
  },
});
```

**Rejection Reasons** (randomly selected):

1. "Document illegible or blurry"
2. "Face mismatch with government ID"
3. "ID expired or invalid"
4. "Suspected fraudulent document"

**Production Integration**:

Replace with real provider call:

```typescript
// Production example
const response = await fetch("https://api.smileidentity.com/v1/kyb", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${SMILE_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    user_id: userId,
    documents: documentUrls,
  }),
});

const result = await response.json();
return {
  approved: result.status === "approved",
  reason: result.rejection_reason || "Verified",
};
```

---

### `getViewerKycData()`

Internal query to fetch authenticated user's KYC data safely.

**Type**: Internal Query

**Arguments**: None

**Returns**:

```typescript
{
  user: User;
  documents: KycDocument[];
}
```

**Implementation**:

```typescript
export const getViewerKycData = internalQuery({
  handler: async (ctx) => {
    const user = await getUser(ctx);

    const documents = await ctx.db
      .query(TABLE_NAMES.KYC_DOCUMENTS)
      .withIndex("by_user_id_and_status", (q) =>
        q.eq("user_id", user._id).eq("status", KYCStatus.PENDING)
      )
      .collect();

    return { user, documents };
  },
});
```

**Note**: Uses internal query pattern for safe action-to-query communication

---

### `adminListPendingKyc()`

Admin query to list all users awaiting KYC review.

**Type**: Query (requires admin authentication)

**Arguments**: None

**Returns**: Array of user records with pending documents:

```typescript
Array<{
  user_id: Id<"users">;
  first_name: string;
  last_name: string;
  email?: string;
  phone: string;
  status: string;
  pending_documents: Array<{
    document_id: Id<"kyc_documents">;
    document_type: KycDocumentType;
    created_at: number;
    uploaded_at?: number;
    file_name?: string;
    file_size?: number;
    mime_type?: string;
  }>;
}>;
```

**Ordering**: Sorted by oldest pending document (first-come-first-serve)

**Implementation**:

```typescript
export const adminListPendingKyc = query({
  handler: async (ctx) => {
    await getAdminUser(ctx); // Require admin auth

    // Fetch all pending documents
    const pendingDocs = await ctx.db
      .query(TABLE_NAMES.KYC_DOCUMENTS)
      .withIndex("by_status", (q) => q.eq("status", KYCStatus.PENDING))
      .collect();

    // Group by user
    const grouped = new Map<UserId, KycDocument[]>();
    for (const doc of pendingDocs) {
      const key = doc.user_id;
      const current = grouped.get(key);
      if (current) {
        current.push(doc);
      } else {
        grouped.set(key, [doc]);
      }
    }

    // Build response
    const rows = [];
    for (const [userId, docs] of grouped) {
      const user = await ctx.db.get(userId);
      if (!user) continue;

      docs.sort((a, b) => a.created_at - b.created_at);

      rows.push({
        user_id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email ?? undefined,
        phone: user.phone,
        status: user.status,
        pending_documents: docs.map((doc) => ({
          document_id: doc._id,
          document_type: doc.document_type,
          created_at: doc.created_at,
          uploaded_at: doc.uploaded_at,
          file_name: doc.file_name,
          file_size: doc.file_size,
          mime_type: doc.mime_type,
        })),
      });
    }

    // Sort by oldest pending document
    rows.sort((a, b) => {
      const aOldest =
        a.pending_documents[0]?.created_at ?? Number.MAX_SAFE_INTEGER;
      const bOldest =
        b.pending_documents[0]?.created_at ?? Number.MAX_SAFE_INTEGER;
      return aOldest - bOldest;
    });

    return rows;
  },
});
```

**Usage**: Admin dashboard KYC review queue

---

### `adminReviewKyc(args)`

Admin mutation to manually review and approve/reject KYC submissions.

**Type**: Mutation (requires admin authentication)

**Arguments**:

```typescript
{
  userId: v.id("users");
  approved: v.boolean();
  reason?: v.string();  // Required if rejected
}
```

**Returns**:

```typescript
{
  userId: Id<"users">;
  newStatus: "active" | "closed";
  documentsReviewed: number;
}
```

**Validation**:

1. Admin must be authenticated
2. User must exist
3. User must be in PENDING_KYC status
4. Rejection requires a reason
5. Must have pending documents to review

**Side Effects**:

1. Calls `processKycResult()` to update user and documents
2. Syncs user aggregates (for analytics)
3. Logs comprehensive audit trail
4. Transitions user status

**Implementation**:

```typescript
export const adminReviewKyc = mutation({
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    if (user.status !== UserStatus.PENDING_KYC) {
      throw new ConvexError("User is not in pending_kyc status");
    }

    if (!args.approved && (!args.reason || args.reason.trim().length === 0)) {
      throw new ConvexError("Rejection reason is required");
    }

    const pendingDocs = await ctx.db
      .query(TABLE_NAMES.KYC_DOCUMENTS)
      .withIndex("by_user_id_and_status", (q) =>
        q.eq("user_id", args.userId).eq("status", KYCStatus.PENDING)
      )
      .collect();

    if (pendingDocs.length === 0) {
      throw new ConvexError("No pending KYC documents to review");
    }

    const nextUserStatus = args.approved
      ? UserStatus.ACTIVE
      : UserStatus.CLOSED;

    // Capture old state before update
    const oldUser = user;

    // Process KYC result
    await ctx.runMutation(internal.users.processKycResult, {
      userId: args.userId,
      approved: args.approved,
      reason: args.reason,
      reviewedBy: admin._id,
    });

    // Get updated user and sync aggregates
    const updatedUser = await ctx.db.get(args.userId);
    if (updatedUser) {
      await syncUserUpdate(ctx, oldUser, updatedUser);
    }

    // Log audit trail
    await auditLog.logChange(ctx, {
      action: "kyc.reviewed",
      actorId: admin._id,
      resourceType: RESOURCE_TYPE.USERS,
      resourceId: user._id,
      before: { status: user.status },
      after: {
        status: nextUserStatus,
        approved: args.approved,
        reason: args.reason,
        documents_reviewed: pendingDocs.length,
      },
      severity: args.approved ? "info" : "warning",
    });

    return {
      userId: user._id,
      newStatus: nextUserStatus,
      documentsReviewed: pendingDocs.length,
    };
  },
});
```

**Usage**:

```typescript
// Approve KYC
await ctx.runMutation(kyc.adminReviewKyc, {
  userId: user._id,
  approved: true,
});

// Reject KYC with reason
await ctx.runMutation(kyc.adminReviewKyc, {
  userId: user._id,
  approved: false,
  reason: "Government ID appears to be expired",
});
```

---

## Aggregate Integration

### User Status Aggregates

KYC status changes affect user count aggregates:

```typescript
// In adminReviewKyc mutation
const oldUser = user; // Before status change

await ctx.runMutation(internal.users.processKycResult, {
  userId: args.userId,
  approved: args.approved,
  reason: args.reason,
  reviewedBy: admin._id,
});

const updatedUser = await ctx.db.get(args.userId);

// Sync aggregates after status change
await syncUserUpdate(ctx, oldUser, updatedUser);
```

**Aggregates Updated**:

- `totalUsers` - Overall user count (unchanged, just status shift)
- `usersByStatus` - Count by status (PENDING_KYC → ACTIVE/CLOSED)

**Sync Helper**:

```typescript
// aggregateHelpers.ts
export async function syncUserUpdate(
  ctx: MutationCtx,
  oldUser: { _id: string; status: string },
  newUser: { _id: string; status: string }
) {
  await Promise.all([
    totalUsers.replace(ctx, oldUser as any, newUser as any),
    usersByStatus.replace(ctx, oldUser as any, newUser as any),
  ]);
}
```

---

## Audit Logging

### Comprehensive Trail

All KYC operations are logged with full metadata:

#### Document Upload (in kycDocuments.ts)

```typescript
await auditLog.log(ctx, {
  action: "kyc.document_uploaded",
  actorId: user._id,
  resourceType: RESOURCE_TYPE.KYC_DOCUMENTS,
  resourceId: document._id,
  severity: "info",
  metadata: {
    document_type: args.documentType,
    file_name: args.fileName,
    file_size: args.fileSize,
    mime_type: args.mimeType,
  },
});
```

#### Admin Review

```typescript
await auditLog.logChange(ctx, {
  action: "kyc.reviewed",
  actorId: admin._id,
  resourceType: RESOURCE_TYPE.USERS,
  resourceId: user._id,
  before: { status: user.status },
  after: {
    status: nextUserStatus,
    approved: args.approved,
    reason: args.reason,
    documents_reviewed: pendingDocs.length,
  },
  severity: args.approved ? "info" : "warning",
});
```

**Audit Events Tracked**:

- `kyc.document_uploaded` - User uploads document
- `kyc.document_deleted` - User deletes document
- `kyc.reviewed` - Admin reviews KYC submission
- `kyc.verified` - Automated verification completed
- `user.status_changed` - User status transition

---

## Error Handling

### Client-Facing Errors

#### Missing Documents

```typescript
throw new ConvexError(
  `Missing required KYC documents: ${missingRequired.join(", ")}`
);
// Example: "Missing required KYC documents: government_id, selfie_with_id"
```

#### Invalid User Status

```typescript
throw new ConvexError("User is not in pending_kyc status");
```

#### No Pending Documents

```typescript
throw new ConvexError("No pending KYC documents found to verify");
```

#### Missing Rejection Reason

```typescript
throw new ConvexError("Rejection reason is required");
```

#### User Not Found

```typescript
throw new ConvexError("User not found");
```

#### No Documents to Review

```typescript
throw new ConvexError("No pending KYC documents to review");
```

---

## Integration Example

### User KYC Submission Flow

```typescript
// React component for KYC submission
function KycSubmissionForm() {
  const [submitting, setSubmitting] = useState(false);
  const verifyIdentity = useAction(kyc.verifyIdentity);

  const handleVerify = async () => {
    setSubmitting(true);
    try {
      const result = await verifyIdentity();

      if (result.approved) {
        toast.success("✅ KYC Verified Successfully!", {
          description: "Your account has been activated.",
        });
        // Redirect to dashboard or refresh user data
      } else {
        toast.error("❌ KYC Verification Failed", {
          description: result.reason,
          action: (
            <Button variant="outline" onClick={() => window.location.reload()}>
              Try Again
            </Button>
          ),
        });
      }
    } catch (error) {
      if (error.message.includes("Missing required")) {
        toast.error("Incomplete Submission", {
          description: error.message,
        });
      } else {
        toast.error("Verification Error", {
          description: error.message,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verify Your Identity</CardTitle>
        <CardDescription>
          Submit your KYC documents for verification
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleVerify} disabled={submitting}>
          {submitting ? "Verifying..." : "Submit for Verification"}
        </Button>
      </CardContent>
    </Card>
  );
}
```

---

### Admin KYC Review Dashboard

```typescript
// Admin dashboard component
function AdminKycReviewQueue() {
  const pendingUsers = useQuery(kyc.adminListPendingKyc);
  const reviewKyc = useMutation(kyc.adminReviewKyc);

  const handleApprove = async (userId: UserId) => {
    if (!confirm("Approve this user's KYC submission?")) return;

    try {
      await reviewKyc({
        userId,
        approved: true,
      });

      toast.success("KYC Approved");
    } catch (error) {
      toast.error(`Approval failed: ${error.message}`);
    }
  };

  const handleReject = async (userId: UserId) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;

    try {
      await reviewKyc({
        userId,
        approved: false,
        reason,
      });

      toast.success("KYC Rejected");
    } catch (error) {
      toast.error(`Rejection failed: ${error.message}`);
    }
  };

  if (!pendingUsers) return <LoadingSpinner />;
  if (pendingUsers.length === 0) {
    return <EmptyState title="No Pending KYC Reviews" />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Documents</TableHead>
          <TableHead>Submitted</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pendingUsers.map((user) => (
          <TableRow key={user.user_id}>
            <TableCell>
              <div>
                <div className="font-medium">
                  {user.first_name} {user.last_name}
                </div>
                <div className="text-sm text-muted-foreground">
                  {user.email}
                </div>
                <div className="text-sm text-muted-foreground">
                  {user.phone}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex gap-1 flex-wrap">
                {user.pending_documents.map((doc) => (
                  <Badge key={doc.document_id} variant="outline">
                    {formatDocType(doc.document_type)}
                  </Badge>
                ))}
              </div>
            </TableCell>
            <TableCell>
              {new Date(
                user.pending_documents[0].created_at
              ).toLocaleDateString()}
            </TableCell>
            <TableCell>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleApprove(user.user_id)}>
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleReject(user.user_id)}
                >
                  Reject
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

---

## Testing Checklist

### Unit Tests

```typescript
describe("verifyIdentity action", () => {
  test("should succeed with valid documents", async () => {
    // Create user in PENDING_KYC status
    const userId = await createTestUser({ status: UserStatus.PENDING_KYC });

    // Upload required documents
    await uploadTestDocument(userId, DOCUMENT_TYPES.GOVERNMENT_ID);
    await uploadTestDocument(userId, DOCUMENT_TYPES.SELFIE_WITH_ID);

    // Run verification
    const result = await ctx.runAction(kyc.verifyIdentity);

    expect(result.approved).toBe(true); // 80% chance
    expect(result.userId).toBe(userId);
  });

  test("should fail if no documents", async () => {
    const userId = await createTestUser({ status: UserStatus.PENDING_KYC });

    await expect(ctx.runAction(kyc.verifyIdentity)).rejects.toThrow(
      "No pending KYC documents"
    );
  });

  test("should fail if missing required documents", async () => {
    const userId = await createTestUser({ status: UserStatus.PENDING_KYC });

    // Only upload one document
    await uploadTestDocument(userId, DOCUMENT_TYPES.GOVERNMENT_ID);

    await expect(ctx.runAction(kyc.verifyIdentity)).rejects.toThrow(
      "Missing required KYC documents"
    );
  });

  test("should fail if user not in PENDING_KYC", async () => {
    const userId = await createTestUser({ status: UserStatus.ACTIVE });

    await expect(ctx.runAction(kyc.verifyIdentity)).rejects.toThrow(
      "User is not in pending_kyc status"
    );
  });
});

describe("adminReviewKyc mutation", () => {
  test("should approve user successfully", async () => {
    const userId = await createTestUser({ status: UserStatus.PENDING_KYC });
    await uploadTestDocument(userId, DOCUMENT_TYPES.GOVERNMENT_ID);

    const result = await ctx.runMutation(kyc.adminReviewKyc, {
      userId,
      approved: true,
    });

    expect(result.newStatus).toBe(UserStatus.ACTIVE);
    expect(result.documentsReviewed).toBe(1);

    // Verify user status changed
    const updatedUser = await ctx.db.get(userId);
    expect(updatedUser?.status).toBe(UserStatus.ACTIVE);
  });

  test("should reject user with reason", async () => {
    const userId = await createTestUser({ status: UserStatus.PENDING_KYC });
    await uploadTestDocument(userId, DOCUMENT_TYPES.GOVERNMENT_ID);

    const result = await ctx.runMutation(kyc.adminReviewKyc, {
      userId,
      approved: false,
      reason: "Document quality insufficient",
    });

    expect(result.newStatus).toBe(UserStatus.CLOSED);

    const updatedUser = await ctx.db.get(userId);
    expect(updatedUser?.status).toBe(UserStatus.CLOSED);
  });

  test("should require rejection reason", async () => {
    const userId = await createTestUser({ status: UserStatus.PENDING_KYC });

    await expect(
      ctx.runMutation(kyc.adminReviewKyc, {
        userId,
        approved: false,
      })
    ).rejects.toThrow("Rejection reason is required");
  });

  test("should sync aggregates after approval", async () => {
    const userId = await createTestUser({ status: UserStatus.PENDING_KYC });

    await ctx.runMutation(kyc.adminReviewKyc, {
      userId,
      approved: true,
    });

    // Check aggregate tables were updated
    const usersByStatusCount = await ctx.runQuery(
      aggregates.usersByStatus.count,
      { prefix: [UserStatus.ACTIVE] }
    );

    expect(usersByStatusCount).toBeGreaterThan(0);
  });
});
```

---

## Security Considerations

⚠️ **Critical Security Points**:

1. **Document validation before verification**

   - Prevents bypassing requirements
   - Ensures complete submission

2. **Status enforcement**

   - Only PENDING_KYC users can verify
   - Prevents re-verification attempts

3. **Admin authentication required**

   - Manual review restricted to admins
   - All actions logged with admin ID

4. **Aggregate synchronization**

   - Analytics stay accurate
   - User counts reflect real-time status

5. **Comprehensive audit trail**

   - Full compliance tracking
   - Before/after state captured

6. **Rejection reason requirement**
   - Forces thoughtful decisions
   - Provides feedback to users

---

## Performance Notes

### Query Optimization

All queries use indexes:

```typescript
// By user ID and status (user-specific lookups)
.withIndex("by_user_id_and_status", q =>
  q.eq("user_id", userId).eq("status", KYCStatus.PENDING)
)

// By status only (admin queue)
.withIndex("by_status", q => q.eq("status", KYCStatus.PENDING))
```

### Action Pattern

Uses internal action/query pattern for safe cross-context calls:

```typescript
// Action → Internal Query → Database
const data = await ctx.runQuery(internal.kyc.getViewerKycData);

// Action → Internal Action → External API
const result = await ctx.runAction(internal.kyc.simulateKycProvider, {...});

// Action → Mutation → Database Update
await ctx.runMutation(internal.users.processKycResult, {...});
```

---

## Monitoring Recommendations

Track these metrics:

```typescript
// KYC approval rate
const totalSubmissions = count(allKycAttempts);
const approvedCount = count(allKycAttempts, (k) => k.approved);
const approvalRate = approvedCount / totalSubmissions;

// Average time to review
const avgReviewTime =
  approvedReviews.reduce(
    (sum, r) => sum + (r.reviewed_at - r.submitted_at),
    0
  ) / approvedReviews.length;

// Rejection reasons breakdown
const reasons = groupBy(rejectedKyc, (k) => k.reason);

// Pending queue size
const pendingCount = await ctx.db
  .query(TABLE_NAMES.KYC_DOCUMENTS)
  .withIndex("by_status", (q) => q.eq("status", KYCStatus.PENDING))
  .collect()
  .then((docs) => docs.length);
```

---

## Related Files

- [`kycDocuments.ts`](./kycDocuments.md) - Document upload and management
- [`users.ts`](./users.md) - User status processing
- [`aggregateHelpers.ts`](./aggregates.md) - Aggregate synchronization
- [`auditLog.ts`](./auditLog.md) - Audit trail system
- [`shared.ts`](./shared.md) - Enum and constant definitions

---

## Quick Reference

### KYC Document Requirements

| Document Type    | Required?   | Description                                |
| ---------------- | ----------- | ------------------------------------------ |
| GOVERNMENT_ID    | ✅ Yes      | National ID, Passport, or Driver's License |
| SELFIE_WITH_ID   | ✅ Yes      | Photo of user holding the government ID    |
| PROOF_OF_ADDRESS | ❌ Optional | Utility bill, bank statement               |
| BANK_STATEMENT   | ❌ Optional | Financial institution statement            |

### User Status Transitions

| From Status | Event                     | To Status |
| ----------- | ------------------------- | --------- |
| PENDING_KYC | verifyIdentity() approved | ACTIVE    |
| PENDING_KYC | verifyIdentity() rejected | CLOSED    |
| PENDING_KYC | adminReviewKyc() approved | ACTIVE    |
| PENDING_KYC | adminReviewKyc() rejected | CLOSED    |

### Simulation Behavior

| Metric            | Value            |
| ----------------- | ---------------- |
| Approval Rate     | 80%              |
| Network Delay     | 2 seconds        |
| Rejection Reasons | 4 random options |

---

## Changelog

- **Initial Implementation**: Basic KYC verification pipeline
- **Admin Review**: Added manual review workflow
- **Aggregate Integration**: Synchronized user status aggregates
- **Enhanced Audit**: Comprehensive audit logging for all operations
- **Document Validation**: Stricter requirement checking
