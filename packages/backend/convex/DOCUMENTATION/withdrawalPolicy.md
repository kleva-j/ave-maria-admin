# Withdrawal Policy & Action Capabilities

## Overview

The `withdrawalPolicy.ts` module provides a comprehensive policy engine for determining which actions can be performed on withdrawal requests. It evaluates role-based permissions, withdrawal status constraints, and risk assessments to produce a capability matrix for each withdrawal.

**Primary Responsibilities**:

- Role-based action authorization
- Status-based workflow validation
- Risk-aware decision making
- Action capability computation
- Cash withdrawal restrictions

---

## Architecture

```
┌─────────────────────────┐
│    Withdrawal Request   │
│    + Admin User         │
│    + Risk Summary       │
└────────────┬────────────┘
             │
             ▼
┌──────────────────────────────┐
│  buildWithdrawalCapabilities │
│  ─────────────────────────── │
│  1. Check Status Rules       │
│  2. Check Risk Holds         │
│  3. Check Role Permissions   │
│  4. Build Capability Matrix  │
└──────────────┬───────────────┘
               │
               ▼
┌───────────────────────────────────┐
│  WithdrawalActionCapabilities     │
│  {                                │
│    approve: { allowed: boolean }, │
│    reject: { allowed: boolean },  │
│    process: { allowed: boolean }  │
│  }                                │
└───────────────────────────────────┘
```

---

## Withdrawal Actions

Three administrative actions are supported:

```typescript
enum WithdrawalAction {
  APPROVE = "approve", // Approve pending withdrawal
  REJECT = "reject", // Reject pending withdrawal
  PROCESS = "process", // Process approved withdrawal
}
```

### Action Status Transitions

```
PENDING ──[APPROVE]──> APPROVED ──[PROCESS]──> PROCESSED
   │                       │
   │                       │
[REJECT]                [REJECT]
   │                       │
   ▼                       ▼
REJECTED                REJECTED
```

---

## Role-Based Permissions

### Cash Withdrawal Allowed Roles

Cash withdrawals have stricter controls than bank transfers:

```typescript
const cashWithdrawalAllowedRoles = [
  AdminRole.SUPER_ADMIN,
  AdminRole.OPERATIONS,
  AdminRole.FINANCE,
] as const;
```

**Restricted Roles** (cannot process cash withdrawals):

- ADMIN (regular admins)
- SUPPORT
- Any unlisted role

**Bank Transfer Withdrawals**: All admin roles can process

---

## Core Types

### WithdrawalRiskSummaryForPolicy

Simplified risk summary used by policy engine:

```typescript
type WithdrawalRiskSummaryForPolicy = {
  has_active_hold: boolean;
  block_reason?: string;
};
```

**Note**: This is a subset of the full risk summary from `risk.ts`, containing only fields needed for policy decisions.

---

### WithdrawalActionCapability

Result of evaluating a single action:

```typescript
type WithdrawalActionCapability = {
  allowed: boolean;
  reason?: string; // Present when allowed=false
};
```

**Examples**:

```typescript
// Allowed
{ allowed: true }

// Blocked
{
  allowed: false,
  reason: "Only pending withdrawals can be approved"
}
```

---

### WithdrawalActionCapabilities

Complete capability matrix for all actions:

```typescript
type WithdrawalActionCapabilities = {
  approve: WithdrawalActionCapability;
  reject: WithdrawalActionCapability;
  process: WithdrawalActionCapability;
};
```

**Example Response**:

```typescript
{
  approve: { allowed: true },
  reject: { allowed: true },
  process: { allowed: false, reason: "Only approved withdrawals can be processed" }
}
```

---

## Policy Functions

### `getWithdrawalStatusBlockedReason(withdrawal, action)`

Validates that an action is appropriate for the withdrawal's current status.

**Parameters**:

```typescript
withdrawal: Pick<Withdrawal, "status">;
action: WithdrawalAction;
```

**Rules**:

| Action  | Allowed Status | Block Reason                                 |
| ------- | -------------- | -------------------------------------------- |
| APPROVE | PENDING        | "Only pending withdrawals can be approved"   |
| REJECT  | PENDING        | "Only pending withdrawals can be rejected"   |
| PROCESS | APPROVED       | "Only approved withdrawals can be processed" |

**Returns**: `undefined` if allowed, block reason string if blocked

**Example**:

```typescript
const reason = getWithdrawalStatusBlockedReason(
  { status: WithdrawalStatus.PROCESSED },
  WithdrawalAction.APPROVE
);
// Returns: "Only pending withdrawals can be approved"
```

---

### `getCashWithdrawalRoleBlockedReason(adminRole, withdrawal, action)`

Checks if admin role permits cash withdrawal action.

**Parameters**:

```typescript
adminRole: AdminRole;
withdrawal: Pick<Withdrawal, "method">;
action: WithdrawalAction;
```

**Logic**:

1. If withdrawal method is BANK_TRANSFER → always allowed (return undefined)
2. If withdrawal method is CASH:
   - Check if admin role is in allowed list
   - Return block message if not authorized

**Block Message**:

```
"Cash withdrawals can only be {action}ed by Finance, Operations, or Super Admin."
```

**Example**:

```typescript
const reason = getCashWithdrawalRoleBlockedReason(
  AdminRole.ADMIN, // Regular admin
  { method: WithdrawalMethod.CASH },
  WithdrawalAction.APPROVE
);
// Returns: "Cash withdrawals can only be approved by Finance, Operations, or Super Admin."
```

---

### `buildWithdrawalActionCapability(...)`

Evaluates all rules for a single action and returns capability.

**Parameters**:

```typescript
adminRole: AdminRole;
withdrawal: Pick<Withdrawal, "status" | "method">;
action: WithdrawalAction;
risk: WithdrawalRiskSummaryForPolicy;
```

**Evaluation Order**:

1. **Status Check** (highest priority)

   - Calls `getWithdrawalStatusBlockedReason()`
   - If blocked → return immediately with status reason

2. **Risk Hold Check**

   - If `risk.has_active_hold === true`
   - And action is APPROVE or PROCESS
   - Return blocked with `risk.block_reason`

3. **Role Permission Check**

   - Calls `getCashWithdrawalRoleBlockedReason()`
   - If blocked → return with role reason

4. **All Checks Passed**
   - Return `{ allowed: true }`

**Returns**: `WithdrawalActionCapability`

**Implementation**:

```typescript
export function buildWithdrawalActionCapability(
  adminRole: AdminRole,
  withdrawal: Pick<Withdrawal, "status" | "method">,
  action: WithdrawalAction,
  risk: WithdrawalRiskSummaryForPolicy
): WithdrawalActionCapability {
  // 1. Check status constraints
  const statusReason = getWithdrawalStatusBlockedReason(withdrawal, action);
  if (statusReason) {
    return { allowed: false, reason: statusReason };
  }

  // 2. Check risk holds (only for approve/process)
  if (
    risk.has_active_hold &&
    (action === WithdrawalAction.APPROVE || action === WithdrawalAction.PROCESS)
  ) {
    return {
      allowed: false,
      reason:
        risk.block_reason ?? "Withdrawals are currently blocked for this user",
    };
  }

  // 3. Check role permissions (cash withdrawals only)
  const roleReason = getCashWithdrawalRoleBlockedReason(
    adminRole,
    withdrawal,
    action
  );
  if (roleReason) {
    return { allowed: false, reason: roleReason };
  }

  // 4. All checks passed
  return { allowed: true };
}
```

---

### `buildWithdrawalCapabilities(...)`

Builds complete capability matrix for all three actions.

**Parameters**:

```typescript
adminRole: AdminRole;
withdrawal: Pick<Withdrawal, "status" | "method">;
risk: WithdrawalRiskSummaryForPolicy;
```

**Returns**: `WithdrawalActionCapabilities`

**Usage**:

```typescript
const capabilities = buildWithdrawalCapabilities(adminRole, withdrawal, risk);

if (capabilities.approve.allowed) {
  // Show approve button
}

if (capabilities.reject.allowed) {
  // Show reject button
}

if (capabilities.process.allowed) {
  // Show process button
}
```

---

## Helper Functions

### `normalizeWithdrawalMethod(method)`

Safely normalizes withdrawal method to enum value.

```typescript
function normalizeWithdrawalMethod(method: unknown) {
  return method === WithdrawalMethod.CASH
    ? WithdrawalMethod.CASH
    : WithdrawalMethod.BANK_TRANSFER;
}
```

**Purpose**: Handles cases where method might be invalid or undefined

---

### `getCashWithdrawalRoleBlockedMessage(action)`

Generates standardized block message for role restrictions.

```typescript
export function getCashWithdrawalRoleBlockedMessage(action: WithdrawalAction) {
  return `Cash withdrawals can only be ${withdrawalActionPastTense[action]} by Finance, Operations, or Super Admin.`;
}
```

**Action Past Tense Mapping**:

```typescript
const withdrawalActionPastTense = {
  [WithdrawalAction.APPROVE]: WithdrawalStatus.APPROVED, // "approved"
  [WithdrawalAction.REJECT]: WithdrawalStatus.REJECTED, // "rejected"
  [WithdrawalAction.PROCESS]: WithdrawalStatus.PROCESSED, // "processed"
};
```

---

### `getCashWithdrawalForbiddenData(action)`

Returns structured error data for cash withdrawal forbidden cases.

```typescript
export function getCashWithdrawalForbiddenData(action: WithdrawalAction) {
  return {
    code: "withdrawal_action_forbidden" as const,
    action,
    method: WithdrawalMethod.CASH,
    allowed_roles: [...cashWithdrawalAllowedRoles],
    message: getCashWithdrawalRoleBlockedMessage(action),
  };
}
```

**Usage**: Include in thrown errors for frontend handling

---

## Integration Example

### Admin Dashboard Usage

```typescript
// Admin withdrawal detail page
function WithdrawalActions({ withdrawal }: { withdrawal: Withdrawal }) {
  const adminRole = useAdminRole();
  const riskSummary = useQuery(risk.buildWithdrawalRiskSummary, {
    userId: withdrawal.user_id,
  });

  const capabilities = buildWithdrawalCapabilities(
    adminRole,
    withdrawal,
    riskSummary
  );

  return (
    <div className="flex gap-2">
      <Button
        onClick={() => handleApprove(withdrawal)}
        disabled={!capabilities.approve.allowed}
        title={capabilities.approve.reason}
      >
        Approve
      </Button>

      <Button
        onClick={() => handleReject(withdrawal)}
        disabled={!capabilities.reject.allowed}
        title={capabilities.reject.reason}
        variant="destructive"
      >
        Reject
      </Button>

      <Button
        onClick={() => handleProcess(withdrawal)}
        disabled={!capabilities.process.allowed}
        title={capabilities.process.reason}
        variant="secondary"
      >
        Process Payment
      </Button>
    </div>
  );
}
```

---

### Mutation Handler Integration

```typescript
// withdrawals.ts - adminApproveWithdrawal
export const adminApproveWithdrawal = mutation({
  args: { withdrawalId: v.id("withdrawals") },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    const withdrawal = await ctx.db.get(args.withdrawalId);

    if (!withdrawal) {
      throw new ConvexError("Withdrawal not found");
    }

    // Get risk summary
    const riskSummary = await buildWithdrawalRiskSummary(
      ctx,
      withdrawal.user_id
    );

    // Check capability BEFORE proceeding
    const capabilities = buildWithdrawalCapabilities(
      admin.role,
      withdrawal,
      riskSummary
    );

    if (!capabilities.approve.allowed) {
      throw new ConvexError({
        code: "withdrawal_action_forbidden",
        message: capabilities.approve.reason,
      });
    }

    // Proceed with approval
    const oldWithdrawal = withdrawal;
    await ctx.db.patch(withdrawal._id, {
      status: WithdrawalStatus.APPROVED,
      approved_by: admin._id,
      approved_at: Date.now(),
    });

    const updated = await ctx.db.get(withdrawal._id);
    await syncWithdrawalUpdate(ctx, oldWithdrawal, updated);

    return updated;
  },
});
```

---

## Decision Matrix Examples

### Example 1: Pending Bank Transfer

```typescript
const caps = buildWithdrawalCapabilities(
  AdminRole.ADMIN,
  {
    status: WithdrawalStatus.PENDING,
    method: WithdrawalMethod.BANK_TRANSFER
  },
  { has_active_hold: false }
);

// Result:
{
  approve: { allowed: true },
  reject: { allowed: true },
  process: { allowed: false, reason: "Only approved withdrawals can be processed" }
}
```

---

### Example 2: Approved Cash Withdrawal

```typescript
const caps = buildWithdrawalCapabilities(
  AdminRole.SUPPORT,  // Not authorized for cash
  {
    status: WithdrawalStatus.APPROVED,
    method: WithdrawalMethod.CASH
  },
  { has_active_hold: false }
);

// Result:
{
  approve: { allowed: false, reason: "Only pending withdrawals can be approved" },
  reject: { allowed: false, reason: "Only pending withdrawals can be rejected" },
  process: { allowed: false, reason: "Cash withdrawals can only be processed by Finance, Operations, or Super Admin" }
}
```

---

### Example 3: Pending Withdrawal with Active Hold

```typescript
const caps = buildWithdrawalCapabilities(
  AdminRole.FINANCE,
  {
    status: WithdrawalStatus.PENDING,
    method: WithdrawalMethod.BANK_TRANSFER
  },
  {
    has_active_hold: true,
    block_reason: "Suspected fraud investigation"
  }
);

// Result:
{
  approve: { allowed: false, reason: "Suspected fraud investigation" },
  reject: { allowed: true },  // Can still reject
  process: { allowed: false, reason: "Only approved withdrawals can be processed" }
}
```

**Note**: Reject is still allowed because holds don't block rejections (user-friendly)

---

### Example 4: Super Admin Full Access

```typescript
const caps = buildWithdrawalCapabilities(
  AdminRole.SUPER_ADMIN,
  {
    status: WithdrawalStatus.APPROVED,
    method: WithdrawalMethod.CASH
  },
  { has_active_hold: false }
);

// Result:
{
  approve: { allowed: false, reason: "Only pending withdrawals can be approved" },
  reject: { allowed: false, reason: "Only pending withdrawals can be rejected" },
  process: { allowed: true }  // Full access
}
```

---

## Error Handling

### Forbidden Error Structure

```typescript
{
  code: "withdrawal_action_forbidden";
  action: WithdrawalAction;
  method: WithdrawalMethod;
  allowed_roles: AdminRole[];
  message: string;
}
```

### Frontend Error Handler

```typescript
async function handleWithdrawalAction(action: WithdrawalAction) {
  try {
    await api.withdrawals.adminApproveWithdrawal({ withdrawalId });
  } catch (error) {
    if (error.data?.code === "withdrawal_action_forbidden") {
      const { action, method, allowed_roles, message } = error.data;

      toast.error("Action Not Allowed", {
        description: message,
        details: {
          action: action.toUpperCase(),
          withdrawal_method: method,
          required_roles: allowed_roles.join(", "),
        },
      });
    } else {
      throw error;
    }
  }
}
```

---

## Testing Checklist

### Unit Tests

```typescript
describe("buildWithdrawalActionCapability", () => {
  test("should allow approve for pending withdrawal", () => {
    const result = buildWithdrawalActionCapability(
      AdminRole.FINANCE,
      {
        status: WithdrawalStatus.PENDING,
        method: WithdrawalMethod.BANK_TRANSFER,
      },
      WithdrawalAction.APPROVE,
      { has_active_hold: false }
    );

    expect(result.allowed).toBe(true);
  });

  test("should block approve for non-pending withdrawal", () => {
    const result = buildWithdrawalActionCapability(
      AdminRole.FINANCE,
      {
        status: WithdrawalStatus.APPROVED,
        method: WithdrawalMethod.BANK_TRANSFER,
      },
      WithdrawalAction.APPROVE,
      { has_active_hold: false }
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Only pending withdrawals can be approved");
  });

  test("should block approve when active hold exists", () => {
    const result = buildWithdrawalActionCapability(
      AdminRole.FINANCE,
      {
        status: WithdrawalStatus.PENDING,
        method: WithdrawalMethod.BANK_TRANSFER,
      },
      WithdrawalAction.APPROVE,
      {
        has_active_hold: true,
        block_reason: "Investigation pending",
      }
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Investigation pending");
  });

  test("should block cash withdrawal for unauthorized role", () => {
    const result = buildWithdrawalActionCapability(
      AdminRole.SUPPORT,
      {
        status: WithdrawalStatus.APPROVED,
        method: WithdrawalMethod.CASH,
      },
      WithdrawalAction.PROCESS,
      { has_active_hold: false }
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Finance, Operations, or Super Admin");
  });

  test("should allow cash withdrawal for authorized role", () => {
    const result = buildWithdrawalActionCapability(
      AdminRole.OPERATIONS,
      {
        status: WithdrawalStatus.APPROVED,
        method: WithdrawalMethod.CASH,
      },
      WithdrawalAction.PROCESS,
      { has_active_hold: false }
    );

    expect(result.allowed).toBe(true);
  });
});
```

---

## Security Considerations

⚠️ **Critical Security Points**:

1. **Always check capabilities before mutations**

   - Don't rely solely on UI disabling buttons
   - Server-side validation is essential

2. **Cash withdrawal restrictions are strict**

   - Only FINANCE, OPERATIONS, SUPER_ADMIN can process
   - Prevents unauthorized cash disbursement

3. **Status transitions are enforced**

   - Cannot skip workflow steps
   - Cannot regress (e.g., APPROVED → PENDING)

4. **Risk holds block approvals**

   - Even authorized admins cannot bypass holds
   - Prevents fraudulent withdrawals during investigation

5. **Reject is less restricted**
   - Allows support staff to deny suspicious requests
   - Does not require finance-level access

---

## Performance Notes

### Pure Function Optimization

All policy functions are pure (no I/O), enabling:

1. **Client-Side Pre-Validation**

   ```typescript
   // Calculate in component render
   const capabilities = buildWithdrawalCapabilities(...);

   // Disable buttons without server round-trip
   <Button disabled={!capabilities.approve.allowed} />
   ```

2. **Memoization**

   ```typescript
   const capabilities = useMemo(
     () => buildWithdrawalCapabilities(adminRole, withdrawal, risk),
     [adminRole, withdrawal, risk]
   );
   ```

3. **Batch Evaluation**
   ```typescript
   // Evaluate multiple withdrawals at once
   const withdrawalCapabilities = withdrawals.map((w) => ({
     ...w,
     capabilities: buildWithdrawalCapabilities(role, w, risk),
   }));
   ```

---

## Related Files

- [`withdrawals.ts`](./withdrawals.md) - Withdrawal processing implementation
- [`risk.ts`](./risk.md) - Risk assessment engine
- [`shared.ts`](./shared.md) - Enum definitions (WithdrawalAction, WithdrawalStatus, AdminRole)
- [`types.ts`](./types.md) - TypeScript type definitions

---

## Quick Reference

### Status + Action Matrix

| Current Status | APPROVE | REJECT | PROCESS |
| -------------- | ------- | ------ | ------- |
| PENDING        | ✅      | ✅     | ❌      |
| APPROVED       | ❌      | ❌     | ✅\*    |
| PROCESSED      | ❌      | ❌     | ❌      |
| REJECTED       | ❌      | ❌     | ❌      |

\* PROCESS for APPROVED requires FINANCE, OPERATIONS, or SUPER_ADMIN role for cash withdrawals

### Role Authorization Table

| Role        | Bank Transfer | Cash Withdrawal |
| ----------- | ------------- | --------------- |
| SUPER_ADMIN | ✅            | ✅              |
| FINANCE     | ✅            | ✅              |
| OPERATIONS  | ✅            | ✅              |
| ADMIN       | ✅            | ❌              |
| SUPPORT     | ✅            | ❌              |

---

## Changelog

- **Initial Implementation**: Role-based withdrawal action authorization
- **Cash Withdrawal Restrictions**: Added stricter controls for cash
- **Risk Integration**: Integrated with risk assessment system
- **Pure Function Design**: Enabled client-side pre-validation
