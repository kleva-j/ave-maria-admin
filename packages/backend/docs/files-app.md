# Backend Files Documentation - Part 2

## Application Logic Files

### `auth.ts` - Authentication Configuration and WorkOS Integration

**Purpose**: Configures WorkOS AuthKit integration and handles all authentication events and user synchronization.

**Core Components**:

#### AuthKit Instance
```typescript
import { AuthKit } from "@convex-dev/workos-authkit";
import { components, internal } from "./_generated/api";
import { auditLog } from "./auditLog";

const authFunctions: AuthFunctions = internal.auth;

export const authKit = new AuthKit<DataModel>(components.workOSAuthKit, {
  authFunctions,
});
```

**Configuration**:
- **Component**: Uses `workOSAuthKit` component
- **Auth Functions**: Points to `internal.auth` for token validation
- **Data Model**: Typed with full application DataModel

---

#### WorkOS Event Handlers

##### `authKitEvent` - WorkOS Webhook Events

Handles asynchronous events from WorkOS when user changes occur in the identity provider.

**1. `user.created`**
- **Triggered**: When a new user is created in WorkOS
- **Actions**:
  1. Logs audit event with user details
  2. Calls `users.upsertFromWorkOS` to create/update Convex user record
  3. Syncs user profile data (email, name, profile picture)
  4. Sets last login time from WorkOS data

**2. `user.updated`**
- **Triggered**: When user profile is updated in WorkOS
- **Actions**:
  1. Logs audit event
  2. Updates Convex user record via `upsertFromWorkOS`
  3. Syncs changed profile fields

**3. `user.deleted`**
- **Triggered**: When user is deleted from WorkOS
- **Actions**:
  1. Logs audit event with warning severity
  2. Calls `users.deleteFromWorkOS` to remove Convex record
  3. Triggers aggregate updates via sync helpers

**Event Payload Structure**:
```typescript
{
  id: string;              // WorkOS user ID
  email: string;
  firstName?: string;
  lastName?: string;
  profilePictureUrl?: string;
  lastSignInAt?: Date;
}
```

**Example Handler**:
```typescript
"user.created": async (ctx, event) => {
  // Log the event
  await auditLog.log(ctx, {
    action: "workos.user_created",
    severity: "info",
    metadata: { 
      workosId: event.data.id, 
      email: event.data.email 
    },
  });
  
  // Sync to database
  await ctx.runMutation(internal.users.upsertFromWorkOS, {
    workosId: event.data.id,
    email: event.data.email,
    firstName: event.data.firstName ?? undefined,
    lastName: event.data.lastName ?? undefined,
    profilePictureUrl: event.data.profilePictureUrl ?? undefined,
    lastLoginAt: event.data.lastSignInAt
      ? Number(new Date(event.data.lastSignInAt))
      : null,
  });
}
```

---

#### AuthKit Actions

##### `authKitAction` - Real-time Authentication Hooks

Synchronous hooks that run during authentication flows, allowing allow/deny decisions.

**1. `authentication`**
- **Triggered**: On every successful user authentication (login)
- **Purpose**: Sync last login timestamp
- **Actions**:
  1. Logs `USER_LOGIN` audit event
  2. Updates user's `last_login_at` field via `upsertFromWorkOS`
  3. Returns `response.allow()` to permit login

**Handler**:
```typescript
authentication: async (ctx, action, response) => {
  const { user } = action;
  
  if (user) {
    // Log login
    await auditLog.log(ctx, {
      action: AuditActions.USER_LOGIN,
      actorId: user.id,
      severity: "info",
      metadata: { email: user.email },
    });
    
    // Update last login time
    await ctx.runMutation(internal.users.upsertFromWorkOS, {
      workosId: user.id,
      email: user.email,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      profilePictureUrl: user.profilePictureUrl ?? undefined,
      lastLoginAt: Date.now(),
    });
  }
  
  return response.allow();
}
```

**2. `userRegistration`**
- **Triggered**: When a new user registers through WorkOS
- **Purpose**: Create initial user record
- **Actions**:
  1. Logs `USER_CREATED` audit event
  2. Creates user via `upsertFromWorkOS` with `lastLoginAt: null`
  3. Returns `response.allow()` to permit registration

**Handler**:
```typescript
userRegistration: async (ctx, action, response) => {
  const user = (action as { user?: WorkOSUserPayload }).user;
  
  if (user) {
    await auditLog.log(ctx, {
      action: AuditActions.USER_CREATED,
      actorId: user.id,
      severity: "info",
      metadata: { email: user.email },
    });
    
    await ctx.runMutation(internal.users.upsertFromWorkOS, {
      workosId: user.id,
      email: user.email,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      profilePictureUrl: user.profilePictureUrl ?? undefined,
      lastLoginAt: null,
    });
  }
  
  return response.allow();
}
```

---

#### Type Definitions

**`WorkOSUserPayload`**:
```typescript
interface WorkOSUserPayload {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  profilePictureUrl?: string | null;
}
```

---

#### Authentication Flow

**User Registration**:
```
1. User signs up in WorkOS
   ↓
2. WorkOS triggers "user.created" event
   ↓
3. authKitEvent handler runs
   ↓
4. Audit log entry created
   ↓
5. users.upsertFromWorkOS creates Convex user
   ↓
6. User aggregates updated
```

**User Login**:
```
1. User authenticates with WorkOS
   ↓
2. authKitAction.authentication hook fires
   ↓
3. Audit log entry created
   ↓
4. users.upsertFromWorkOS updates last_login_at
   ↓
5. Login allowed
```

**User Profile Update**:
```
1. Admin updates user in WorkOS dashboard
   ↓
2. WorkOS triggers "user.updated" event
   ↓
3. authKitEvent handler runs
   ↓
4. Convex user record updated
   ↓
5. Aggregates recalculated if needed
```

**User Deletion**:
```
1. Admin deletes user in WorkOS
   ↓
2. WorkOS triggers "user.deleted" event
   ↓
3. authKitEvent handler runs
   ↓
4. Audit log with warning severity
   ↓
5. users.deleteFromWorkOS removes record
   ↓
6. Aggregates updated (counts decremented)
```

---

#### Security Considerations

1. **All Auth Events Logged**: Every authentication action is audited
2. **PII Masking**: Email and personal data masked in audit logs
3. **Atomic Updates**: User sync happens in single transaction
4. **Allow-by-Default**: Auth actions return `response.allow()` unless error occurs

---

#### Error Handling

- **Missing User Data**: Handled with nullish coalescing (`?? undefined`)
- **Failed Mutations**: Will cause auth flow to fail (intentional)
- **Audit Log Failures**: Non-blocking (errors caught internally)

---

**Usage in Other Files**:

```typescript
// utils.ts - Get authenticated user
import { authKit } from "./auth";

export async function getUser(ctx: Context) {
  const authUser = await authKit.getAuthUser(ctx);
  if (!authUser) throw new ConvexError("Not authenticated");
  
  const user = await ctx.db
    .query(TABLE_NAMES.USERS)
    .withIndex("by_workos_id", q => q.eq("workosId", authUser.id))
    .unique();
    
  return user;
}

// users.ts - Internal mutation called from auth handlers
export const upsertFromWorkOS = internalMutation({
  args: { /* ... */ },
  handler: async (ctx, args) => {
    // Create or update user
  }
});
```

---

**Related Files**:
- `utils.ts` - `getUser`, `getAdminUser` use authKit
- `users.ts` - `upsertFromWorkOS`, `deleteFromWorkOS` mutations
- `auditLog.ts` - All auth events logged
- `schema.ts` - User table structure

---

### `users.ts` - User Management

**Purpose**: Handles all user-related queries and mutations including profile management, KYC processing, and WorkOS synchronization.

---

#### Queries

##### `get` - Get User Profile by ID

**Access Control**:
- Users can only view their own profile
- Admins can view any user profile

**Parameters**:
- `id: v.id("users")` - User ID to fetch
- `role: v.optional(v.string())` - Optional role hint

**Logic**:
1. Attempts to get regular user authentication
2. Falls back to admin authentication
3. Validates authorization (user can only access own profile)
4. Returns user document

**Example**:
```typescript
const user = await client.query(users.get, { 
  id: "user123:456" 
});
```

---

##### `viewer` - Get Current Authenticated User

**Purpose**: Fetch the profile of the currently logged-in user.

**Returns**: Full `User` document

**Usage**:
```typescript
// Frontend - Get current user
const { data: user } = useQuery(users.viewer);

// In backend code
const currentUser = await ctx.runQuery(users.viewer);
```

---

#### Mutations

##### `updateUserProfile` - Update Profile Fields

**Allowed Updates**:
- `onboardingComplete: boolean` - Mark onboarding as complete

**Authorization**: Requires authenticated user (via `getUser`)

**Audit Logging**:
- Logs before/after state of `onboarding_complete` field
- Action: `AuditActions.USER_UPDATED`
- Severity: "info"

**Example**:
```typescript
await client.mutation(users.updateUserProfile, {
  onboardingComplete: true
});
```

**Implementation**:
```typescript
export const updateUserProfile = mutation({
  args: {
    onboardingComplete: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    
    // Log change
    await auditLog.logChange(ctx, {
      action: AuditActions.USER_UPDATED,
      actorId: user._id,
      resourceType: RESOURCE_TYPE.USERS,
      resourceId: user._id,
      before: { onboarding_complete: user.onboarding_complete },
      after: { onboarding_complete: args.onboardingComplete },
      severity: "info",
    });
    
    // Update database
    await ctx.db.patch(user._id, {
      onboarding_complete: args.onboardingComplete ?? user.onboarding_complete,
    });
    
    return user._id;
  },
});
```

---

##### `upsertFromWorkOS` - Sync User from WorkOS (Internal)

**Purpose**: Create or update user records when WorkOS events fire.

**Called By**:
- `auth.ts` - `user.created`, `user.updated` events
- `auth.ts` - `authentication` action
- `auth.ts` - `userRegistration` action

**Parameters**:
```typescript
{
  workosId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profilePictureUrl?: string;
  lastLoginAt: number | null;
}
```

**Logic**:

**If User Exists**:
1. Patch existing record with new data
2. Call `syncUserUpdate` to update aggregates
3. Return existing user ID

**If User Does Not Exist**:
1. Insert new user with default values:
   - `onboarding_complete: false`
   - `phone: ""` (empty until provided)
   - `referral_code: ""` (generated later)
   - `total_balance_koko: BigInt(0)`
   - `savings_balance_koko: BigInt(0)`
   - `status: UserStatus.PENDING_KYC`
   - Timestamps set to `Date.now()`
2. Call `syncUserInsert` to update aggregates
3. Return new user ID

**Aggregate Sync**:
- **New User**: Increments total user count, adds balances to totals
- **Updated User**: Recalculates deltas for balance/name changes

**Example Flow**:
```typescript
// From auth.ts event handler
await ctx.runMutation(internal.users.upsertFromWorkOS, {
  workosId: "user_abc123",
  email: "user@example.com",
  firstName: "John",
  lastName: "Doe",
  profilePictureUrl: "https://...",
  lastLoginAt: Date.now(),
});
```

---

##### `deleteFromWorkOS` - Delete User (Internal)

**Purpose**: Remove user record when deleted from WorkOS.

**Called By**:
- `auth.ts` - `user.deleted` event

**Logic**:
1. Query user by WorkOS ID
2. If found:
   - Call `syncUserDelete` to update aggregates
   - Log audit event (severity: "warning")
   - Delete user document
3. If not found: No-op (idempotent)

**Aggregate Sync**:
- Decrements total user count
- Subtracts user's balances from totals

---

##### `processKycResult` - Process Automated KYC Decision (Internal)

**Purpose**: Update user and document statuses after automated KYC verification.

**Called By**:
- External KYC service webhook (via HTTP action)
- Manual admin review process

**Parameters**:
```typescript
{
  userId: Id<"users">,
  approved: boolean,
  reason?: string,        // Required if rejected
  reviewedBy?: Id<"admin_users">  // Who performed the review
}
```

**Logic**:

1. **Validate User Exists**: Throws if user not found

2. **Determine New Status**:
   ```typescript
   const newStatus = approved ? "active" : "closed";
   const docStatus = approved 
     ? KYC_VERIFICATION_STATUS.APPROVED 
     : KYC_VERIFICATION_STATUS.REJECTED;
   ```

3. **Find Pending Documents**:
   ```typescript
   const documents = await ctx.db
     .query(TABLE_NAMES.KYC_DOCUMENTS)
     .withIndex("by_user_id_and_status", q =>
       q.eq("user_id", userId).eq("status", KYC_VERIFICATION_STATUS.PENDING)
     )
     .collect();
   ```

4. **Update User Status**:
   ```typescript
   await ctx.db.patch(userId, { 
     status: newStatus, 
     updated_at: Date.now() 
   });
   ```

5. **Update All Pending Documents** (concurrently):
   ```typescript
   await Promise.all(
     documents.map(doc =>
       ctx.db.patch(doc._id, {
         status: docNewStatus,
         reviewed_by: args.reviewedBy,
         reviewed_at: Date.now(),
         rejection_reason: approved ? undefined : args.reason,
       })
     )
   );
   ```

6. **Audit Log**:
   ```typescript
   await auditLog.logChange(ctx, {
     action: approved
       ? EVENT_TYPE.KYC_VERIFICATION_COMPLETED
       : EVENT_TYPE.KYC_VERIFICATION_FAILED,
     actorId: userId,
     resourceType: RESOURCE_TYPE.USERS,
     resourceId: userId,
     before: { status: user.status },
     after: { status: newStatus, reason: args.reason },
     severity: approved ? "info" : "warning",
   });
   ```

7. **Return Success**:
   ```typescript
   return { success: true };
   ```

**Usage Example**:
```typescript
// After KYC provider responds
await ctx.runMutation(internal.users.processKycResult, {
  userId: user._id,
  approved: true,
  reviewedBy: adminId, // Optional for automated checks
});

// User status now: "active"
// All pending documents status: "APPROVED"
```

**State Transition Diagram**:
```
PENDING_KYC ──[approved]──> ACTIVE
            ──[rejected]──> CLOSED

KYC Document:
PENDING ──[approved]──> APPROVED
        ──[rejected]──> REJECTED
```

---

#### Aggregate Integration

All user mutations trigger aggregate updates:

**Insert**:
```typescript
await syncUserInsert(ctx, newUser);
// Increments: userTotalCount, userTotalBalance, etc.
```

**Update**:
```typescript
await syncUserUpdate(ctx, oldUser, newUser);
// Calculates delta and updates aggregates
```

**Delete**:
```typescript
await syncUserDelete(ctx, existing);
// Decrements: userTotalCount, subtracts balances
```

**File**: `aggregateHelpers.ts` (not shown in detail)

---

**Related Files**:
- `auth.ts` - Calls upsert/delete mutations
- `kyc.ts` - Works with KYC verification
- `utils.ts` - Authentication helpers
- `auditLog.ts` - All changes logged
- `shared.ts` - UserStatus, EVENT_TYPE

---

### `admin.ts` - Admin Dashboard and Operations

**Purpose**: Provides admin-only queries for platform oversight and operational monitoring.

---

#### Validators

##### `adminViewerValidator`
Schema for admin user profile response.

**Fields**:
- `_id`, `workosId`, `email` - Identity
- `first_name`, `last_name`, `profile_picture_url` - Profile
- `role`, `status` - Authorization
- `created_at`, `last_login_at` - Timestamps
- `deleted_at` (optional) - Soft delete marker

---

##### `adminOperationsSummaryValidator`
Schema for operational dashboard summary.

**Structure**:
```typescript
{
  withdrawals: {
    pending: number;
    approved: number;
    rejected: number;
    processed: number;
  };
  kyc: {
    pending_users: number;
  };
  bankVerification: {
    pending_accounts: number;
    oldest_submission_at?: number;
  };
  reconciliation: {
    latest_run: {
      _id: Id<"transaction_reconciliation_runs">;
      status: string;
      issue_count: number;
      started_at: number;
      completed_at?: number;
    } | null;
    open_issue_count: number;
  };
}
```

---

#### Queries

##### `viewer` - Get Current Admin User

**Purpose**: Verify admin authentication and return admin profile.

**Authorization**: Requires admin user (via `getAdminUser`)

**Returns**: Validated admin user object

**Usage**:
```typescript
// Frontend - Check if user is admin
const { data: admin } = useQuery(admin.viewer);

if (admin) {
  // Show admin dashboard
}
```

**Implementation**:
```typescript
export const viewer = query({
  args: {},
  returns: adminViewerValidator,
  handler: async (ctx) => {
    const admin = await getAdminUser(ctx);
    return admin;
  },
});
```

---

##### `getOperationsSummary` - Operational Dashboard

**Purpose**: Provide real-time metrics for admin dashboard landing page.

**Authorization**: Admin-only

**Data Sources** (fetched in parallel):

1. **Withdrawals**: All withdrawal requests
   - Grouped by status: PENDING, APPROVED, REJECTED, PROCESSED

2. **KYC Documents**: Pending documents only
   - Count of unique users awaiting review

3. **Bank Accounts**: Pending verification accounts
   - Count of accounts needing review
   - Oldest submission timestamp

4. **Reconciliation Runs**: Latest run
   - Most recent reconciliation execution
   - Status, issue count, timestamps

5. **Reconciliation Issues**: Open issues
   - Count of unresolved discrepancies

**Implementation Details**:

**Parallel Fetch**:
```typescript
const [withdrawals, pendingDocs, pendingAccounts, latestRun, openIssues] =
  await Promise.all([
    ctx.db.query(TABLE_NAMES.WITHDRAWALS).collect(),
    ctx.db
      .query(TABLE_NAMES.KYC_DOCUMENTS)
      .withIndex("by_status", q => q.eq("status", KYCStatus.PENDING))
      .collect(),
    ctx.db
      .query(TABLE_NAMES.USER_BANK_ACCOUNTS)
      .withIndex("by_verification_status", q =>
        q.eq("verification_status", "pending")
      )
      .collect(),
    ctx.db
      .query(TABLE_NAMES.TRANSACTION_RECONCILIATION_RUNS)
      .withIndex("by_started_at")
      .order("desc")
      .take(1),
    ctx.db
      .query(TABLE_NAMES.TRANSACTION_RECONCILIATION_ISSUES)
      .withIndex("by_issue_status", q =>
        q.eq("issue_status", TransactionReconciliationIssueStatus.OPEN)
      )
      .collect(),
  ]);
```

**Pending KYC Users Calculation**:
```typescript
const pendingKycUsers = new Set(
  pendingDocs.map(doc => String(doc.user_id))
).size;
// Ensures unique user count (one user may have multiple docs)
```

**Oldest Submission Calculation**:
```typescript
const oldestSubmissionAt = pendingAccounts.length > 0
  ? pendingAccounts.reduce((oldest, account) => {
      const current = account.verification_submitted_at ?? account.created_at;
      return current < oldest ? current : oldest;
    }, pendingAccounts[0].verification_submitted_at ?? pendingAccounts[0].created_at)
  : undefined;
```

**Withdrawal Summary**:
```typescript
withdrawals: {
  pending: withdrawals.filter(w => w.status === WithdrawalStatus.PENDING).length,
  approved: withdrawals.filter(w => w.status === WithdrawalStatus.APPROVED).length,
  rejected: withdrawals.filter(w => w.status === WithdrawalStatus.REJECTED).length,
  processed: withdrawals.filter(w => w.status === WithdrawalStatus.PROCESSED).length,
}
```

**Validation**:
```typescript
if (
  summary.withdrawals.pending < 0 ||
  summary.withdrawals.approved < 0 ||
  // ... other checks
) {
  throw new ConvexError("Invalid withdrawal summary state");
}
```

**Response Example**:
```json
{
  "withdrawals": {
    "pending": 5,
    "approved": 12,
    "rejected": 2,
    "processed": 48
  },
  "kyc": {
    "pending_users": 8
  },
  "bankVerification": {
    "pending_accounts": 3,
    "oldest_submission_at": 1710234567890
  },
  "reconciliation": {
    "latest_run": {
      "_id": "run123:456",
      "status": "completed",
      "issue_count": 2,
      "started_at": 1710234000000,
      "completed_at": 1710234120000
    },
    "open_issue_count": 2
  }
}
```

---

##### `list` - List All Users

**Purpose**: Return complete user list for admin review.

**Authorization**: Admin-only

**Returns**: Array of all user records with full details

**Includes**:
- All user profile fields
- Financial balances (total, savings)
- KYC data (encrypted BVN, NIN)
- Status and timestamps
- Referral information

**Usage**:
```typescript
const users = await client.query(admin.list);

// Display in admin table
users.forEach(user => {
  console.log(`${user.email} - Balance: ${user.total_balance_koko}`);
});
```

**Performance Note**:
- Uses `.collect()` which loads all users into memory
- For large datasets, consider pagination
- No filtering or search (admin can filter client-side)

---

#### Admin Access Patterns

**Frontend Check**:
```typescript
// React component
function AdminDashboard() {
  const { data: admin } = useQuery(admin.viewer);
  
  if (!admin) {
    return <Navigate to="/" />;
  }
  
  const { data: summary } = useQuery(admin.getOperationsSummary);
  
  return (
    <div>
      <h1>Admin Dashboard</h1>
      <p>Pending Withdrawals: {summary?.withdrawals.pending}</p>
      {/* ... rest of UI */}
    </div>
  );
}
```

**Backend Authorization**:
```typescript
export const someAdminFunction = query(
  withAdminUser(async (ctx, args) => {
    // ctx.adminUser available
    // Only admins can reach here
  })
);
```

---

#### Security Considerations

1. **All Functions Require Admin Auth**: Every query uses `getAdminUser`
2. **No Admin Creation via API**: Admins must be created directly in database
3. **Full Data Access**: Admins can see all user data including encrypted fields
4. **Audit Logging**: Admin actions should be logged (not shown in these queries)

---

**Related Files**:
- `utils.ts` - `getAdminUser`, `withAdminUser`
- `withdrawals.ts` - Withdrawal data source
- `kyc.ts` - KYC data source
- `transactions.ts` - Reconciliation data
- `shared.ts` - Status enums

---
