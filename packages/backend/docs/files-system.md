# Backend Files Documentation - Part 3

## System and Metrics Files

### `kpis.ts` - KPI Calculations and Dashboard Metrics

**Purpose**: Calculates and stores platform-wide Key Performance Indicators (KPIs) for the admin dashboard, updated periodically via cron jobs.

---

#### Configuration

**Page Size for Batch Processing**:
```typescript
const PAGE_SIZE = 500;
// Processes users/plans in batches of 500 to avoid transaction limits
```

---

#### Type Definitions

**`PageResult<T>`** - Generic pagination result type:
```typescript
type PageResult<T> = {
  page: Array<T>;
  continueCursor: string;
  isDone: boolean;
};
```

**`UserKpiItem`** - User data needed for KPI calculation:
```typescript
type UserKpiItem = {
  total_balance_koko: bigint;
  status: UserStatus;
};
```

**`PlanKpiItem`** - Plan data needed for KPI calculation:
```typescript
type PlanKpiItem = {
  current_amount_koko: bigint;
  status: PlanStatus;
};
```

---

#### Internal Queries (Data Fetching)

##### `_getUsersPage` - Paginated User Data Fetch

**Purpose**: Fetch a page of users with only the fields needed for KPI calculation.

**Parameters**:
- `cursor: string | null` - Pagination cursor (null for first page)

**Returns**:
```typescript
{
  page: Array<{
    total_balance_koko: bigint;
    status: UserStatus;
  }>;
  continueCursor: string;
  isDone: boolean;
}
```

**Implementation**:
```typescript
export const _getUsersPage = internalQuery({
  args: {
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.object({
    page: v.array(
      v.object({
        total_balance_koko: v.int64(),
        status: userStatus,
      }),
    ),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query(TABLE_NAMES.USERS)
      .paginate({ numItems: PAGE_SIZE, cursor: args.cursor });

    return {
      page: result.page.map(({ total_balance_koko, status }) => ({
        total_balance_koko,
        status,
      })),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});
```

**Usage Pattern**:
```typescript
let cursor: string | null = null;
do {
  const page = await ctx.runQuery(internal.kpis._getUsersPage, { cursor });
  
  // Process page
  for (const user of page.page) {
    totalAumKoko += user.total_balance_koko;
    if (user.status === UserStatus.ACTIVE) {
      activeUsers++;
    }
  }
  
  cursor = page.continueCursor;
} while (!page.isDone);
```

---

##### `_getPlansPage` - Paginated Plan Data Fetch

**Purpose**: Fetch a page of savings plans with only the fields needed for KPI calculation.

**Structure**: Identical to `_getUsersPage` but for plans

**Returns**:
```typescript
{
  page: Array<{
    current_amount_koko: bigint;
    status: PlanStatus;
  }>;
  continueCursor: string;
  isDone: boolean;
}
```

---

#### Internal Mutation (Data Storage)

##### `_setDashboardKpis` - Store KPI Snapshot

**Purpose**: Insert or update daily KPI snapshot.

**Parameters**:
```typescript
{
  total_aum_koko: bigint;      // Total assets under management
  active_users: number;         // Count of active users
  active_plans: number;         // Count of active savings plans
  total_savings_koko: bigint;   // Total savings across all plans
  computed_at: number;          // Timestamp when calculated
}
```

**Upsert Logic**:

1. **Query Latest Snapshot**:
   ```typescript
   const existing = await ctx.db
     .query(TABLE_NAMES.ADMIN_DASHBOARD_KPIS)
     .withIndex("by_computed_at")
     .order("desc")
     .first();
   ```

2. **Decision**:
   - **No existing record OR different day**: Insert new row
   - **Same day**: Update existing row in place

**Implementation**:
```typescript
export const _setDashboardKpis = internalMutation({
  args: {
    total_aum_koko: v.int64(),
    active_users: v.number(),
    active_plans: v.number(),
    total_savings_koko: v.int64(),
    computed_at: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query(TABLE_NAMES.ADMIN_DASHBOARD_KPIS)
      .withIndex("by_computed_at")
      .order("desc")
      .first();

    if (!existing || !isSameDay(existing.computed_at, args.computed_at)) {
      // New day — insert fresh snapshot
      await ctx.db.insert(TABLE_NAMES.ADMIN_DASHBOARD_KPIS, args);
    } else {
      // Same day — update in place
      await ctx.db.patch(existing._id, args);
    }
    return null;
  },
});
```

**Date Comparison**:
```typescript
import { isSameDay } from "date-fns";

if (!isSameDay(existing.computed_at, args.computed_at)) {
  // Different day - insert new
} else {
  // Same day - patch existing
}
```

**Why This Pattern?**:
- **Historical Tracking**: Keep daily snapshots for trend analysis
- **Idempotency**: Multiple runs on same day don't duplicate data
- **Efficiency**: Single row per day minimizes storage

---

#### Internal Action (Orchestration)

##### `refreshDashboardKpis` - Calculate and Store All KPIs

**Purpose**: Orchestrate the full KPI calculation workflow by aggregating data from all users and plans.

**Called By**: Cron job (every 10 minutes)

**Returns**: `null` (side-effect only: updates KPI table)

**Workflow**:

**Step 1: Aggregate Users**
```typescript
let totalAumKoko = 0n;
let activeUsers = 0;
let userCursor: string | null = null;

for (;;) {
  const result: PageResult<UserKpiItem> = await ctx.runQuery(
    internal.kpis._getUsersPage,
    { cursor: userCursor }
  );

  for (const user of result.page) {
    totalAumKoko += user.total_balance_koko;
    if (user.status === UserStatus.ACTIVE) {
      activeUsers += 1;
    }
  }

  if (result.isDone) break;
  userCursor = result.continueCursor;
}
```

**Logic**:
- Initialize accumulators (`totalAumKoko`, `activeUsers`)
- Loop through all users in pages of 500
- For each user:
  - Add their balance to total AUM
  - Increment active user count if status is ACTIVE
- Continue until `isDone` is true

**Step 2: Aggregate Plans**
```typescript
let totalSavingsKoko = 0n;
let activePlans = 0;
let planCursor: string | null = null;

for (;;) {
  const result: PageResult<PlanKpiItem> = await ctx.runQuery(
    internal.kpis._getPlansPage,
    { cursor: planCursor }
  );

  for (const plan of result.page) {
    totalSavingsKoko += plan.current_amount_koko;
    if (plan.status === PlanStatus.ACTIVE) {
      activePlans += 1;
    }
  }

  if (result.isDone) break;
  planCursor = result.continueCursor;
}
```

**Logic**:
- Similar pattern to user aggregation
- Sums up all active plan balances
- Counts only plans with ACTIVE status

**Step 3: Store Results**
```typescript
await ctx.runMutation(internal.kpis._setDashboardKpis, {
  total_aum_koko: totalAumKoko,
  active_users: activeUsers,
  active_plans: activePlans,
  total_savings_koko: totalSavingsKoko,
  computed_at: Date.now(),
});
```

**Complete Implementation**:
```typescript
export const refreshDashboardKpis = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // --- Aggregate users ---
    let totalAumKoko = 0n;
    let activeUsers = 0;
    let userCursor: string | null = null;

    for (;;) {
      const result: PageResult<UserKpiItem> = await ctx.runQuery(
        internal.kpis._getUsersPage,
        { cursor: userCursor },
      );

      for (const user of result.page) {
        totalAumKoko += user.total_balance_koko;
        if (user.status === UserStatus.ACTIVE) {
          activeUsers += 1;
        }
      }

      if (result.isDone) break;
      userCursor = result.continueCursor;
    }

    // --- Aggregate savings plans ---
    let totalSavingsKoko = 0n;
    let activePlans = 0;
    let planCursor: string | null = null;

    for (;;) {
      const result: PageResult<PlanKpiItem> = await ctx.runQuery(
        internal.kpis._getPlansPage,
        { cursor: planCursor },
      );

      for (const plan of result.page) {
        totalSavingsKoko += plan.current_amount_koko;
        if (plan.status === PlanStatus.ACTIVE) {
          activePlans += 1;
        }
      }

      if (result.isDone) break;
      planCursor = result.continueCursor;
    }

    // --- Write results ---
    await ctx.runMutation(internal.kpis._setDashboardKpis, {
      total_aum_koko: totalAumKoko,
      active_users: activeUsers,
      active_plans: activePlans,
      total_savings_koko: totalSavingsKoko,
      computed_at: Date.now(),
    });

    return null;
  },
});
```

---

#### KPI Metrics Explained

**1. Total AUM (Assets Under Management)**:
- **Definition**: Sum of all user wallet balances
- **Formula**: `Σ user.total_balance_koko`
- **Unit**: Kobo (1/100 of Naira)
- **Use Case**: Platform growth tracking

**2. Active Users**:
- **Definition**: Users with status = ACTIVE
- **Formula**: `COUNT(users WHERE status = "active")`
- **Use Case**: Engagement metric

**3. Active Savings Plans**:
- **Definition**: Plans with status = ACTIVE
- **Formula**: `COUNT(plans WHERE status = "ACTIVE")`
- **Use Case**: Product adoption metric

**4. Total Savings**:
- **Definition**: Sum of all plan contributions
- **Formula**: `Σ plan.current_amount_koko`
- **Unit**: Kobo
- **Use Case**: Savings product performance

---

#### Performance Optimizations

**1. Pagination**:
- Avoids loading all records at once
- Respects Convex transaction limits
- Uses cursor-based pagination

**2. Minimal Field Selection**:
- Only fetches required fields (`balance`, `status`)
- Reduces memory usage and network transfer

**3. Batch Processing**:
- Processes 500 records per batch
- Configurable via `PAGE_SIZE` constant

**4. Separation of Concerns**:
- Queries: Read-only, can be called from actions
- Mutation: Single write operation
- Action: Orchestrates reads then writes

---

#### Usage in Admin Dashboard

**Query Latest KPIs**:
```typescript
const { data: kpis } = useQuery(
  admin.getKpis, // Would query ADMIN_DASHBOARD_KPIS table
  { limit: 7 }   // Last 7 days
);

// Display trend chart
kpis?.forEach(kpi => {
  console.log(`Date: ${new Date(kpi.computed_at)}`);
  console.log(`Active Users: ${kpi.active_users}`);
  console.log(`Total AUM: ${Number(kpi.total_aum_koko) / 100} NGN`);
});
```

**Manual Trigger** (for testing):
```typescript
await client.action(kpis.refreshDashboardKpis);
```

---

#### Cron Integration

**Scheduled Execution**:
```typescript
// init.ts
{
  name: "refresh dashboard kpis",
  fn: internal.kpis.refreshDashboardKpis,
  schedule: { kind: "interval", ms: 10 * 60 * 1000 }, // 10 minutes
}
```

**Why 10 Minutes?**:
- Frequent enough for near-real-time metrics
- Infrequent enough to minimize database load
- Balances freshness vs cost

---

**Related Files**:
- `init.ts` - Cron job registration
- `admin.ts` - Uses KPI data for dashboard
- `schema.ts` - `admin_dashboard_kpis` table
- `shared.ts` - UserStatus, PlanStatus enums

---

### `init.ts` - System Initialization and Cron Setup

**Purpose**: Idempotent setup function to register and configure cron jobs for automated background tasks.

---

#### Crons Component Setup

```typescript
import { Crons } from "@convex-dev/crons";
import { components, internal } from "./_generated/api";

const crons = new Crons(components.crons);
```

**Component**: Uses the `crons` component for reliable job scheduling

---

#### Setup Function

##### `setup` - Register Cron Jobs

**Purpose**: One-time setup to register all cron jobs. Safe to run multiple times (idempotent).

**Execution Command**:
```bash
npx convex run init:setup
```

**Audit Logging**:
```typescript
await auditLog.log(ctx, {
  action: "system.setup_executed",
  severity: "info",
});
```

---

#### Cron Job Definitions

**Job 1: Refresh Dashboard KPIs**

**Configuration**:
```typescript
{
  name: "refresh dashboard kpis",
  fn: internal.kpis.refreshDashboardKpis,
  schedule: { 
    kind: "interval" as const, 
    ms: 10 * 60 * 1000  // 10 minutes
  },
}
```

**Details**:
- **Function**: `kpis.refreshDashboardKpis`
- **Interval**: Every 10 minutes (600,000 ms)
- **Purpose**: Calculate and store platform KPIs
- **Load**: Moderate (paginates through all users/plans)

**Execution Flow**:
```
Every 10 minutes:
1. Fetch all users in batches of 500
2. Sum balances and count active users
3. Fetch all plans in batches of 500
4. Sum plan amounts and count active plans
5. Store snapshot in ADMIN_DASHBOARD_KPIS
```

---

**Job 2: Run Transaction Reconciliation**

**Configuration**:
```typescript
{
  name: "run transaction reconciliation",
  fn: internal.transactions.runReconciliation,
  schedule: { 
    kind: "interval" as const, 
    ms: 60 * 60 * 1000  // 1 hour
  },
}
```

**Details**:
- **Function**: `transactions.runReconciliation`
- **Interval**: Every hour (3,600,000 ms)
- **Purpose**: Detect and log transaction discrepancies
- **Load**: High (complex financial data processing)

**Note**: Implementation in `transactions.ts` (not shown in detail)

---

#### Registration Logic

**Idempotent Pattern**:
```typescript
for (const job of cronJobs) {
  const existing = await crons.get(ctx, { name: job.name });

  if (existing) {
    console.log(`Cron job '${job.name}' is already registered.`);
    continue;
  }

  await crons.register(ctx, job.schedule, job.fn, {}, job.name);

  console.log(
    `Successfully registered cron job '${job.name}' via the crons component.`
  );
}
```

**Steps**:
1. Check if job already exists by name
2. If exists: Skip registration (idempotent)
3. If not exists: Register with component
4. Log success/failure

**Why Idempotent?**:
- Safe to run after every deployment
- No manual tracking of what's registered
- Prevents duplicate cron jobs

---

#### Cron Schedule Types

The `@convex-dev/crons` component supports:

**1. Interval Schedule** (used here):
```typescript
{
  kind: "interval",
  ms: 600000  // 10 minutes
}
```

**2. Cron Expression Schedule**:
```typescript
{
  kind: "cron",
  expression: "0 */6 * * *"  // Every 6 hours
}
```

**3. Human-Readable Interval**:
```typescript
{
  kind: "human",
  human: "every 10 minutes"
}
```

---

#### Deployment Workflow

**Post-Deployment Steps**:

1. **Deploy Code**:
   ```bash
   npx convex deploy
   ```

2. **Run Setup**:
   ```bash
   npx convex run init:setup
   ```

3. **Verify Cron Jobs**:
   - Check Convex dashboard
   - Look for scheduled jobs
   - Monitor execution logs

**Automation Option** (CI/CD):
```yaml
# .github/workflows/deploy.yml
- name: Deploy to Convex
  run: npx convex deploy
  
- name: Run initialization
  run: npx convex run init:setup
```

---

#### Monitoring and Debugging

**Check Job Status**:
```typescript
// In Convex dashboard or via query
const jobs = await crons.list(ctx);
console.log(jobs);
```

**View Execution Logs**:
```typescript
// Query audit logs
const logs = await ctx.db
  .query(TABLE_NAMES.AUDIT_LOGS)
  .withIndex("by_action", q => q.eq("action", "system.setup_executed"))
  .collect();
```

**Common Issues**:

1. **Job Not Running**:
   - Check if registered: `crons.get(ctx, { name })`
   - Verify function is exported correctly
   - Check component configuration

2. **Frequent Failures**:
   - Review function logs for errors
   - Check transaction timeout (max 10s for mutations)
   - Consider using actions for long-running tasks

3. **Duplicate Executions**:
   - Ensure idempotent registration
   - Check cron component configuration
   - Verify single deployment environment

---

#### Best Practices

**1. Idempotency**:
- Always check if job exists before registering
- Use unique, descriptive names
- Safe to run setup multiple times

**2. Error Handling**:
- Wrap cron functions in try-catch
- Log failures to audit system
- Implement retry logic if needed

**3. Monitoring**:
- Track execution duration
- Alert on repeated failures
- Monitor data freshness (e.g., last KPI update)

**4. Documentation**:
- Document each cron job's purpose
- Note expected execution time
- List dependencies and side effects

---

**Example: Adding a New Cron Job**:

```typescript
// Step 1: Create the function
export const nightlyReport = internalAction({
  args: {},
  handler: async (ctx) => {
    // Generate daily report
  }
});

// Step 2: Add to init.ts setup
const cronJobs = [
  // ... existing jobs
  {
    name: "generate nightly report",
    fn: internal.init.nightlyReport,
    schedule: { 
      kind: "cron", 
      expression: "0 2 * * *"  // 2 AM daily
    },
  }
];

// Step 3: Deploy and run setup
// npx convex deploy
// npx convex run init:setup
```

---

**Related Files**:
- `kpis.ts` - KPI refresh cron job
- `transactions.ts` - Reconciliation cron job
- `auditLog.ts` - Setup execution logging
- `convex.config.ts` - Component configuration

---

## Cross-File Workflows

This section documents how these files work together to implement complete business workflows.

---

### Workflow 1: User Registration and Onboarding

**Files Involved**: `auth.ts`, `users.ts`, `auditLog.ts`, `schema.ts`

**Step-by-Step Flow**:

1. **User Signs Up** (External - WorkOS)
   ```
   User → WorkOS Registration Form → WorkOS API
   ```

2. **WorkOS Event Triggered**
   ```typescript
   // auth.ts
   "user.created": async (ctx, event) => {
     // event.data contains user info
   }
   ```

3. **Audit Log Created**
   ```typescript
   await auditLog.log(ctx, {
     action: "workos.user_created",
     severity: "info",
     metadata: { workosId: event.data.id, email: event.data.email }
   });
   ```

4. **User Record Created/Updated**
   ```typescript
   await ctx.runMutation(internal.users.upsertFromWorkOS, {
     workosId: event.data.id,
     email: event.data.email,
     firstName: event.data.firstName,
     lastName: event.data.lastName,
     profilePictureUrl: event.data.profilePictureUrl,
     lastLoginAt: null
   });
   ```

5. **Aggregates Updated** (Internal)
   ```typescript
   // Inside upsertFromWorkOS handler
   await syncUserInsert(ctx, newUser);
   // Increments user count, initializes balances
   ```

6. **User Status**: `PENDING_KYC`
   - Cannot perform financial transactions yet
   - Must complete KYC verification

---

### Workflow 2: User Login

**Files Involved**: `auth.ts`, `users.ts`, `utils.ts`

**Flow**:

1. **User Authenticates** (WorkOS)
   ```
   User → Login Form → WorkOS Authentication
   ```

2. **AuthKit Action Hook Fires**
   ```typescript
   // auth.ts
   authentication: async (ctx, action, response) => {
     const { user } = action;
     
     // Update last login time
     await ctx.runMutation(internal.users.upsertFromWorkOS, {
       workosId: user.id,
       lastLoginAt: Date.now()
     });
     
     return response.allow();
   }
   ```

3. **Frontend Gets Auth Token**
   ```typescript
   // Frontend
   const auth = await authKit.authenticate(credentials);
   ```

4. **Backend Functions Can Now Access User**
   ```typescript
   export const getProfile = query(
     withUser(async (ctx) => {
       // ctx.user is available
       return ctx.user;
     })
   );
   ```

---

### Workflow 3: KYC Verification

**Files Involved**: `users.ts`, `kyc.ts`, `auditLog.ts`, `shared.ts`

**Flow**:

1. **User Submits KYC Documents**
   ```typescript
   await client.mutation(kyc.submitDocument, {
     documentType: "BVN",
     documentNumber: "12345678901",
     userId: currentUser._id
   });
   ```

2. **Document Status**: `PENDING`

3. **Automated Verification Runs** (External service webhook)
   ```typescript
   // HTTP action receives webhook
   const verified = await verifyWithKYCProvider(document);
   
   await ctx.runMutation(internal.users.processKycResult, {
     userId: document.user_id,
     approved: verified.approved,
     reason: verified.reason
   });
   ```

4. **If Approved**:
   ```typescript
   // users.ts - processKycResult
   await ctx.db.patch(userId, { 
     status: UserStatus.ACTIVE 
   });
   
   await ctx.db.patch(document._id, {
     status: KYC_VERIFICATION_STATUS.APPROVED,
     reviewed_at: Date.now()
   });
   
   await auditLog.logChange(ctx, {
     action: EVENT_TYPE.KYC_VERIFICATION_COMPLETED,
     actorId: userId,
     resourceType: RESOURCE_TYPE.USERS,
     resourceId: userId,
     before: { status: "pending_kyc" },
     after: { status: "active" },
     severity: "info"
   });
   ```

5. **User Can Now**:
   - Add bank accounts
   - Create savings plans
   - Make transactions
   - Request withdrawals

---

### Workflow 4: Withdrawal Request and Approval

**Files Involved**: `withdrawals.ts`, `admin.ts`, `utils.ts`, `auditLog.ts`

**Flow**:

1. **User Requests Withdrawal**
   ```typescript
   // Frontend - User must be active
   await client.mutation(withdrawals.initiate, {
     amount: 500000, // 5000 NGN
     bankAccountId: bankAccount._id,
     description: "Withdraw savings"
   });
   ```

2. **Withdrawal Created** with status: `PENDING`

3. **Admin Dashboard Shows Pending Withdrawal**
   ```typescript
   // admin.ts - getOperationsSummary
   const summary = await client.query(admin.getOperationsSummary);
   // summary.withdrawals.pending includes this withdrawal
   ```

4. **Admin Reviews and Approves**
   ```typescript
   await client.mutation(withdrawals.approve, {
     id: withdrawal._id
   });
   ```

5. **Status Changes**: `PENDING` → `APPROVED`

6. **Audit Log Created**
   ```typescript
   await auditLog.logChange(ctx, {
     action: EVENT_TYPE.WITHDRAWAL_APPROVED,
     actorId: adminUser._id,
     resourceType: RESOURCE_TYPE.WITHDRAWALS,
     resourceId: withdrawal._id,
     before: { status: "pending" },
     after: { status: "approved" },
     severity: "info"
   });
   ```

7. **Payment Processed** (External payment gateway)
   ```typescript
   await client.mutation(withdrawals.markAsProcessed, {
     id: withdrawal._id,
     paymentReference: "PAY123456"
   });
   ```

8. **Final Status**: `PROCESSED`

---

### Workflow 5: KPI Calculation (Cron Job)

**Files Involved**: `init.ts`, `kpis.ts`, `schema.ts`

**Flow**:

1. **Cron Triggers Every 10 Minutes**
   ```typescript
   // init.ts
   {
     name: "refresh dashboard kpis",
     fn: internal.kpis.refreshDashboardKpis,
     schedule: { kind: "interval", ms: 600000 }
   }
   ```

2. **Action Fetches All Users** (in batches)
   ```typescript
   // kpis.ts - refreshDashboardKpis
   for (;;) {
     const result = await ctx.runQuery(internal.kpis._getUsersPage, {
       cursor: userCursor
     });
     
     for (const user of result.page) {
       totalAumKoko += user.total_balance_koko;
       if (user.status === UserStatus.ACTIVE) activeUsers++;
     }
     
     if (result.isDone) break;
     userCursor = result.continueCursor;
   }
   ```

3. **Action Fetches All Plans** (in batches)
   ```typescript
   for (;;) {
     const result = await ctx.runQuery(internal.kpis._getPlansPage, {
       cursor: planCursor
     });
     
     for (const plan of result.page) {
       totalSavingsKoko += plan.current_amount_koko;
       if (plan.status === PlanStatus.ACTIVE) activePlans++;
     }
     
     if (result.isDone) break;
     planCursor = result.continueCursor;
   }
   ```

4. **Store KPI Snapshot**
   ```typescript
   await ctx.runMutation(internal.kpis._setDashboardKpis, {
     total_aum_koko: totalAumKoko,
     active_users: activeUsers,
     active_plans: activePlans,
     total_savings_koko: totalSavingsKoko,
     computed_at: Date.now()
   });
   ```

5. **Admin Dashboard Queries Latest KPIs**
   ```typescript
   const { data: kpis } = useQuery(admin.getKpis, { limit: 30 });
   // Displays 30-day trend chart
   ```

---

### Workflow 6: Transaction Reconciliation

**Files Involved**: `init.ts`, `transactions.ts`, `auditLog.ts`

**Flow**:

1. **Hourly Cron Triggers**
   ```typescript
   // init.ts
   {
     name: "run transaction reconciliation",
     fn: internal.transactions.runReconciliation,
     schedule: { kind: "interval", ms: 3600000 }
   }
   ```

2. **Reconciliation Action Runs**
   - Compares internal transactions with bank statements
   - Identifies discrepancies
   - Creates issue records

3. **Issues Logged**
   ```typescript
   await ctx.db.insert(TABLE_NAMES.TRANSACTION_RECONCILIATION_ISSUES, {
     issue_type: "MISSING_TRANSACTION",
     issue_status: TransactionReconciliationIssueStatus.OPEN,
     amount_koko: 10000n,
     detected_at: Date.now()
   });
   ```

4. **Admin Dashboard Shows Issue Count**
   ```typescript
   // admin.ts - getOperationsSummary
   const summary = await client.query(admin.getOperationsSummary);
   // summary.reconciliation.open_issue_count
   ```

5. **Admin Investigates and Resolves**
   ```typescript
   await client.mutation(transactions.resolveIssue, {
     id: issue._id,
     resolution: "MANUAL_ENTRY_CREATED"
   });
   ```

---

## Summary

This documentation covers the complete backend architecture of the Better T-Stack savings platform:

### Core Components

1. **Schema & Types** (`schema.ts`, `types.ts`, `shared.ts`)
   - Database structure
   - TypeScript types
   - Constants and enums

2. **Authentication** (`auth.ts`, `utils.ts`)
   - WorkOS integration
   - User synchronization
   - Authorization helpers

3. **Business Logic** (`users.ts`, `kyc.ts`, `withdrawals.ts`, etc.)
   - User management
   - KYC verification
   - Financial operations

4. **Admin Operations** (`admin.ts`, `kpis.ts`)
   - Dashboard queries
   - Operational metrics
   - Oversight tools

5. **System Infrastructure** (`init.ts`, `auditLog.ts`)
   - Cron jobs
   - Audit logging
   - System initialization

### Key Design Patterns

- **Aggregate Pattern**: Real-time metrics via `@convex-dev/aggregate`
- **Audit Logging**: Complete change tracking with PII masking
- **Paginated Processing**: Handle large datasets safely
- **Idempotent Operations**: Safe retries for all operations
- **Separation of Concerns**: Queries read, mutations write, actions orchestrate

### Security Features

- Role-based access control (user vs admin)
- PII redaction in audit logs
- Status-based authorization
- Encrypted sensitive data (BVN, NIN)

This documentation should serve as a comprehensive reference for understanding, maintaining, and extending the backend system.
