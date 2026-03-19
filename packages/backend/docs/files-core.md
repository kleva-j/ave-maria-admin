# Backend Files Documentation

This document provides comprehensive documentation for all backend Convex files in the Better T-Stack application.

## File Structure

```
packages/backend/convex/
├── schema.ts              # Database schema definitions and validators
├── shared.ts              # Shared constants, enums, and utility types
├── types.ts               # TypeScript type definitions
├── router.ts              # HTTP router configuration
├── auth.ts                # Authentication configuration and WorkOS integration
├── users.ts               # User management mutations and queries
├── kyc.ts                 # KYC verification workflow
├── userBankAccounts.ts    # Bank account management
├── transactions.ts        # Transaction tracking and reconciliation
├── withdrawals.ts         # Withdrawal request processing
├── plans.ts               # Savings plans management
├── admin.ts               # Admin dashboard and operations
├── auditLog.ts            # Audit logging configuration
├── utils.ts               # Utility functions and helpers
├── kpis.ts                # KPI calculations and dashboard metrics
├── init.ts                # System initialization and cron setup
└── convex.config.ts       # Convex component configuration
```

---

## Core Infrastructure Files

### `schema.ts` - Database Schema Definition

**Purpose**: Defines the complete database schema using Convex's schema definition API with aggregate support.

**Key Components**:

#### Schema Definition
- **User Management**: `users`, `admin_users` tables with WorkOS integration
- **Financial Tables**: `transactions`, `withdrawals`, `user_bank_accounts`
- **Savings Plans**: `user_savings_plans` for automated savings
- **KYC System**: `kyc_documents`, `kyc_verifications`
- **Audit & Monitoring**: `audit_logs`, `transaction_reconciliation_runs`, `transaction_reconciliation_issues`
- **System Tables**: `admin_dashboard_kpis` for metrics tracking

#### Aggregate Definitions
1. **`userAggregate`**: Tracks user financial totals
   - Counts: total users, active users, deleted users
   - Financial: total balance, total savings balance
   
2. **`adminDashboardAggregate`**: Platform-wide metrics
   - User statistics and balances
   - Plan counts and amounts
   - Timestamps for updates

#### Indexes
- Strategic indexes for performance optimization
- Compound indexes for complex queries
- Unique constraints for data integrity

**Related Files**:
- `types.ts` - Type definitions derived from schema
- `shared.ts` - Constants used in schema validation
- `convex.config.ts` - Component configuration

---

### `shared.ts` - Shared Constants and Enums

**Purpose**: Centralizes all shared constants, enums, and configuration values used across the backend.

**Key Exports**:

#### Table Names
```typescript
TABLE_NAMES = {
  USERS: "users",
  ADMIN_USERS: "admin_users",
  USER_SAVINGS_PLANS: "user_savings_plans",
  WITHDRAWALS: "withdrawals",
  TRANSACTIONS: "transactions",
  USER_BANK_ACCOUNTS: "user_bank_accounts",
  KYC_DOCUMENTS: "kyc_documents",
  KYC_VERIFICATIONS: "kyc_verifications",
  TRANSACTION_RECONCILIATION_RUNS: "transaction_reconciliation_runs",
  TRANSACTION_RECONCILIATION_ISSUES: "transaction_reconciliation_issues",
  ADMIN_DASHBOARD_KPIS: "admin_dashboard_kpis"
}
```

#### Status Enums
1. **`UserStatus`**: User lifecycle states
   - `PENDING_KYC`: Awaiting KYC verification
   - `ACTIVE`: Fully verified and active
   - `CLOSED`: Account closed or rejected

2. **`PlanStatus`**: Savings plan lifecycle
   - `PENDING` → `ACTIVE` → `COMPLETED`/`FAILED`

3. **`WithdrawalStatus`**: Withdrawal processing states
   - `PENDING` → `APPROVED`/`REJECTED` → `PROCESSED`

4. **`KYCStatus`**: Document verification states
   - `PENDING` → `APPROVED`/`REJECTED`

5. **`TransactionReconciliationIssueStatus`**: Issue tracking
   - `OPEN`, `RESOLVED`, `ESCALATED`

#### Resource Types (Audit Logging)
```typescript
RESOURCE_TYPE = {
  USERS: "users",
  WITHDRAWALS: "withdrawals",
  BANK_ACCOUNTS: "bank_accounts",
  SAVINGS_PLANS: "savings_plans",
  TRANSACTIONS: "transactions",
  KYC_DOCUMENTS: "kyc_documents"
}
```

#### Event Types (Audit Actions)
```typescript
EVENT_TYPE = {
  // User events
  USER_REGISTERED: "user.registered",
  USER_UPDATED: "user.updated",
  USER_DELETED: "user.deleted",
  USER_LOGIN: "user.login",
  
  // KYC events
  KYC_SUBMITTED: "kyc.submitted",
  KYC_APPROVED: "kyc.approved",
  KYC_REJECTED: "kyc.rejected",
  KYC_VERIFICATION_COMPLETED: "kyc.verification_completed",
  KYC_VERIFICATION_FAILED: "kyc.verification_failed",
  
  // Withdrawal events
  WITHDRAWAL_REQUESTED: "withdrawal.requested",
  WITHDRAWAL_APPROVED: "withdrawal.approved",
  WITHDRAWAL_REJECTED: "withdrawal.rejected",
  WITHDRAWAL_PROCESSED: "withdrawal.processed",
  
  // Bank account events
  BANK_ACCOUNT_ADDED: "bank_account.added",
  BANK_ACCOUNT_VERIFIED: "bank_account.verified",
  BANK_ACCOUNT_REMOVED: "bank_account.removed",
  
  // Plan events
  PLAN_CREATED: "plan.created",
  PLAN_ACTIVATED: "plan.activated",
  PLAN_PAYMENT_MADE: "plan.payment_made",
  PLAN_COMPLETED: "plan.completed",
  PLAN_FAILED: "plan.failed"
}
```

**Usage Example**:
```typescript
import { TABLE_NAMES, UserStatus, EVENT_TYPE } from "./shared";

// Query users with status filter
const activeUsers = await ctx.db
  .query(TABLE_NAMES.USERS)
  .withIndex("by_workos_id_and_status", q => 
    q.eq("workosId", userId).eq("status", UserStatus.ACTIVE)
  )
  .unique();

// Log audit event
await auditLog.logChange(ctx, {
  action: EVENT_TYPE.USER_UPDATED,
  actorId: user._id,
  resourceType: RESOURCE_TYPE.USERS,
  resourceId: user._id,
  before: oldData,
  after: newData,
  severity: "info"
});
```

**Related Files**:
- All backend files import from `shared.ts`
- `schema.ts` - Uses table names and enums
- `auditLog.ts` - Uses resource and event types

---

### `types.ts` - TypeScript Type Definitions

**Purpose**: Provides strong typing across the entire backend by deriving TypeScript types from the Convex schema.

**Key Type Categories**:

#### ID Types
```typescript
export type UserId = Id<"users">;
export type AdminUserId = Id<"admin_users">;
export type UserBankAccountId = Id<"user_bank_accounts">;
export type WithdrawalId = Id<"withdrawals">;
export type TransactionId = Id<"transactions">;
export type UserSavingsPlanId = Id<"user_savings_plans">;
export type KycDocumentId = Id<"kyc_documents">;
export type KycVerificationId = Id<"kyc_verifications">;
export type TransactionReconciliationRunId = Id<"transaction_reconciliation_runs">;
export type TransactionReconciliationIssueId = Id<"transaction_reconciliation_issues">;
export type AdminDashboardKpiId = Id<"admin_dashboard_kpis">;
```

#### Doc Types (Full Record Types)
```typescript
export type User = Doc<"users">;
export type AdminUser = Doc<"admin_users">;
export type UserBankAccount = Doc<"user_bank_accounts">;
export type Withdrawal = Doc<"withdrawals">;
export type Transaction = Doc<"transactions">;
export type UserSavingsPlan = Doc<"user_savings_plans">;
export type KycDocument = Doc<"kyc_documents">;
export type KycVerification = Doc<"kyc_verifications">;
export type TransactionReconciliationRun = Doc<"transaction_reconciliation_runs">;
export type TransactionReconciliationIssue = Doc<"transaction_reconciliation_issues">;
export type AdminDashboardKpi = Doc<"admin_dashboard_kpis">;
```

#### Pagination Types
```typescript
// Generic pagination result type
export type PaginatedResult<T> = {
  page: T[];
  continueCursor: string;
  isDone: boolean;
};

// Specific pagination types
export type UserPage = PaginatedResult<User>;
export type PlanPage = PaginatedResult<UserSavingsPlan>;
```

#### Function Parameter Types
```typescript
// KYC verification
export type KycVerificationParams = {
  userId: UserId;
  bvn?: string;
  nin?: string;
  documentType?: string;
  documentNumber?: string;
};

// Withdrawal creation
export type WithdrawalCreateParams = {
  amount: number;
  bankAccountId: UserBankAccountId;
  description?: string;
};

// Bank account creation
export type BankAccountCreateParams = {
  bankName: string;
  accountNumber: string;
  accountName: string;
  isPrimary?: boolean;
};
```

#### Return Types
```typescript
export type UserProfile = Omit<User, "bvn_encrypted" | "nin_encrypted">;
export type WithdrawalWithDetails = Withdrawal & {
  bankAccount?: UserBankAccount;
};
export type PlanWithProgress = UserSavingsPlan & {
  progressPercentage: number;
  remainingAmount: bigint;
};
```

**Usage Example**:
```typescript
import type { UserId, User, WithdrawalCreateParams } from "./types";

// Type-safe function parameters
export const createWithdrawal = mutation({
  args: {
    amount: v.number(),
    bankAccountId: v.id("user_bank_accounts"),
    description: v.optional(v.string())
  },
  handler: async (ctx, args: WithdrawalCreateParams) => {
    // Implementation
  }
});

// Type-safe return types
export const getUserProfile = query({
  args: { id: v.id("users") },
  returns: v.nullable(userProfileValidator),
  handler: async (ctx, args): Promise<UserProfile | null> => {
    return await ctx.db.get(args.id);
  }
});
```

**Related Files**:
- `schema.ts` - Types are derived from schema
- All mutation/query files use these types

---

### `utils.ts` - Utility Functions and Helpers

**Purpose**: Provides reusable utility functions for authentication, authorization, and common operations.

**Authentication Helpers**:

#### `getUser(ctx)`
Retrieves the authenticated regular user from the database.
- **Throws**: `ConvexError` if not authenticated or user not found
- **Returns**: `User` record
- **Uses**: WorkOS auth ID to lookup user

#### `getAdminUser(ctx)`
Retrieves the authenticated admin user from the database.
- **Throws**: `ConvexError` if not authenticated or not an admin
- **Returns**: `AdminUser` record
- **Uses**: WorkOS auth ID to lookup admin

#### `getUserWithStatus(ctx, status)`
Retrieves user with specific status filter.
- **Parameters**: `ctx`, `status: UserStatus`
- **Uses**: Compound index `(workosId, status)` for efficiency
- **Common Usage**: `getUserWithStatus(ctx, "active")`

#### `ensureUser(ctx, userId)`
Validates that a user exists by ID.
- **Parameters**: `ctx`, `userId: UserId`
- **Throws**: `ConvexError` if user not found
- **Returns**: `User` record

#### `ensureAdminUser(ctx, userId)`
Validates that an admin user exists by ID.
- **Parameters**: `ctx`, `userId: AdminUserId`
- **Throws**: `ConvexError` if admin not found
- **Returns**: `AdminUser` record

#### `ensureAuthedUser(ctx)`
Ensures user is authenticated without returning the record.
- **Use Case**: When you only need to verify authentication

**Higher-Order Functions (Middleware Pattern)**:

#### `withUser(func)`
Wraps a function to automatically inject authenticated user.
```typescript
export const updateUser = mutation(
  withUser(async (ctx, args) => {
    // ctx.user is automatically available
    await ctx.db.patch(ctx.user._id, args);
  })
);
```

#### `withActiveUser(func)`
Wraps a function to ensure user has "active" status.
```typescript
export const initiateWithdrawal = mutation(
  withActiveUser(async (ctx, args) => {
    // Only active users can reach here
    // ctx.user.status === "active"
  })
);
```

#### `withAdminUser(func)`
Wraps a function to automatically inject admin user.
```typescript
export const approveWithdrawal = mutation(
  withAdminUser(async (ctx, args) => {
    // ctx.adminUser is automatically available
    await ctx.db.patch(args.withdrawalId, {
      approved_by: ctx.adminUser._id
    });
  })
);
```

**Utility Functions**:

#### `sortAccounts(accounts)`
Sorts bank accounts by primary status then by creation date.
- **Parameters**: `accounts: UserBankAccount[]`
- **Returns**: Sorted array (primary first, then newest)
- **Logic**: Primary accounts always come first, then sorted by `created_at` descending

**Security Patterns**:

1. **Authentication Check**: All public-facing functions should verify authentication
   ```typescript
   const user = await getUser(ctx); // Throws if not authed
   ```

2. **Authorization Check**: Admin functions require admin privileges
   ```typescript
   const admin = await getAdminUser(ctx); // Throws if not admin
   ```

3. **Status Validation**: Active user requirement for sensitive operations
   ```typescript
   const user = await getUserWithStatus(ctx, "active");
   ```

**Usage Example**:
```typescript
import { withUser, withAdminUser, getUser, sortAccounts } from "./utils";

// Regular user operation
export const updateProfile = mutation(
  withUser(async (ctx, args) => {
    await ctx.db.patch(ctx.user._id, args);
  })
);

// Admin-only operation
export const listAllUsers = query(
  withAdminUser(async (ctx) => {
    return await ctx.db.query(TABLE_NAMES.USERS).collect();
  })
);

// Manual auth check with custom logic
export const getProfile = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    const authedUser = await getUser(ctx);
    const isAdmin = await getAdminUser(ctx).catch(() => false);
    
    if (!isAdmin && authedUser._id !== args.id) {
      throw new Error("Unauthorized");
    }
    
    return await ctx.db.get(args.id);
  }
});
```

**Related Files**:
- `auth.ts` - WorkOS authentication
- All query/mutation files use these utilities
- `shared.ts` - UserStatus enum

---

### `auditLog.ts` - Audit Logging Configuration

**Purpose**: Configures the audit logging system for tracking all significant actions and changes in the application.

**Configuration**:

```typescript
import { AuditLog } from "convex-audit-log";
import { components } from "./_generated/api";

export const auditLog = new AuditLog(components.auditLog, {
  piiFields: [
    "email",
    "phone",
    "first_name",
    "last_name",
    "referral_code",
    "account_number",
  ],
});
```

**PII Field Protection**:
The following fields are automatically redacted/masked in audit logs:
- **Personal Information**: email, phone, first_name, last_name
- **Identifiers**: referral_code
- **Financial Data**: account_number

**Audit Log Methods**:

#### `auditLog.log(ctx, event)`
Logs a simple event without change tracking.

**Parameters**:
- `ctx`: Convex context
- `event`: Object with properties:
  - `action`: String identifying the action (from `EVENT_TYPE` or custom)
  - `actorId`: ID of who performed the action
  - `resourceType`: Type of resource affected (from `RESOURCE_TYPE`)
  - `resourceId`: ID of the resource
  - `severity`: "info" | "warning" | "error"
  - `metadata`: Optional additional data

**Example**:
```typescript
await auditLog.log(ctx, {
  action: "user.login",
  actorId: user._id,
  severity: "info",
  metadata: { email: user.email, loginTime: Date.now() }
});
```

#### `auditLog.logChange(ctx, event)`
Logs a change event with before/after state tracking.

**Parameters**:
- `ctx`: Convex context
- `event`: Object with properties:
  - `action`: String identifying the action
  - `actorId`: ID of who performed the action
  - `resourceType`: Type of resource
  - `resourceId`: ID of the resource
  - `before`: Previous state (object)
  - `after`: New state (object)
  - `severity`: "info" | "warning" | "error"

**Example**:
```typescript
await auditLog.logChange(ctx, {
  action: EVENT_TYPE.USER_UPDATED,
  actorId: user._id,
  resourceType: RESOURCE_TYPE.USERS,
  resourceId: user._id,
  before: { onboarding_complete: false },
  after: { onboarding_complete: true },
  severity: "info"
});
```

**Audit Actions Used**:

From `convex-audit-log`:
- `AuditActions.USER_CREATED`
- `AuditActions.USER_UPDATED`
- `AuditActions.USER_DELETED`
- `AuditActions.USER_LOGIN`

From custom `EVENT_TYPE`:
- All KYC, withdrawal, bank account, and plan events

**Best Practices**:

1. **Log All State Changes**: Any mutation that changes data should log the change
   ```typescript
   const before = { status: user.status };
   await ctx.db.patch(user._id, { status: "active" });
   const after = { status: "active" };
   
   await auditLog.logChange(ctx, {
     action: EVENT_TYPE.USER_STATUS_CHANGED,
     actorId: user._id,
     resourceType: RESOURCE_TYPE.USERS,
     resourceId: user._id,
     before,
     after,
     severity: "info"
   });
   ```

2. **Log System Events**: Even automated processes should be logged
   ```typescript
   await auditLog.log(ctx, {
     action: "system.setup_executed",
     severity: "info"
   });
   ```

3. **Attribute System Actions**: When system performs actions, attribute to context
   ```typescript
   await auditLog.logChange(ctx, {
     action: EVENT_TYPE.KYC_VERIFICATION_COMPLETED,
     actorId: args.userId, // Attribute to user context
     resourceType: RESOURCE_TYPE.USERS,
     resourceId: args.userId,
     before: { status: user.status },
     after: { status: "active" },
     severity: "info"
   });
   ```

4. **PII Handling**: Sensitive fields are automatically masked
   ```typescript
   // Email will be masked in the log
   await auditLog.log(ctx, {
     action: "user.registered",
     metadata: { email: "user@example.com" } // Will be redacted
   });
   ```

**Integration Points**:
- **WorkOS Events**: All user sync events are logged (`auth.ts`)
- **User Mutations**: Profile updates, KYC processing (`users.ts`)
- **KYC Workflow**: Document submissions, approvals (`kyc.ts`)
- **Withdrawals**: All state changes (`withdrawals.ts`)
- **Bank Accounts**: Verification, additions, removals (`userBankAccounts.ts`)
- **System Operations**: Cron jobs, initialization (`init.ts`)

**Querying Audit Logs**:
```typescript
// Get recent audit logs for a resource
const logs = await ctx.db
  .query(TABLE_NAMES.AUDIT_LOGS)
  .withIndex("by_resource", q => 
    q.eq("resource_type", "users").eq("resource_id", userId)
  )
  .order("desc")
  .take(10)
  .collect();
```

**Related Files**:
- `shared.ts` - `RESOURCE_TYPE`, `EVENT_TYPE`
- `users.ts`, `kyc.ts`, `withdrawals.ts` - All mutation files use auditLog
- `auth.ts` - WorkOS event logging

---
