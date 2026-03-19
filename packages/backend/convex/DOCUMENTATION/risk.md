# Risk Assessment & Fraud Prevention System

## Overview

The `risk.ts` module provides a comprehensive risk assessment engine for evaluating withdrawal requests and detecting potentially fraudulent activities. It implements real-time risk scoring, automated blocking rules, and manual administrative controls.

**Primary Responsibilities**:

- Real-time withdrawal risk evaluation
- Automated fraud detection with configurable rules
- Manual user holds placed by administrators
- Risk event logging and audit trails
- Velocity checking and limit enforcement

---

## Architecture

```
┌─────────────────────────────┐
│      Withdrawal Request     │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   evaluateWithdrawalRiskDecision    │
│  ─────────────────────────────────  │
│  • Manual Hold Check                │
│  • Bank Account Cooldown            │
│  • Daily Amount Limit               │
│  • Daily Count Limit                │
│  • Velocity Check                   │
└───────────────┬─────────────────────┘
                │
         ┌──────┴──────┐
         │             │
         ▼             ▼
    ┌─────────┐   ┌──────────┐
    │ ALLOWED │   │ BLOCKED  │
    │ Proceed │   │ + Event  │
    └─────────┘   └──────────┘
```

---

## Configuration Constants

### Withdrawal Limits

```typescript
// Daily limits
WITHDRAWAL_DAILY_LIMIT_KOBO = 50_000_000n; // ₦500,000 (~$625)
WITHDRAWAL_DAILY_COUNT_LIMIT = 3; // Max 3 per day

// Velocity limits
WITHDRAWAL_VELOCITY_COUNT_LIMIT = 2; // Max 2 in 15 minutes

// Time windows
DAY_MS = 24 * 60 * 60 * 1000; // 24 hours
VELOCITY_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
BANK_ACCOUNT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
```

---

## Risk Evaluation Rules

### Rule 1: Manual Hold Check

**Priority**: HIGHEST

Blocks all withdrawals if an administrator has placed a manual hold on the user.

```typescript
if (activeHold) {
  return {
    blocked: true,
    rule: "manual_hold",
    message: "Withdrawals are currently blocked for this user: ${reason}",
    eventType: RiskEventType.WITHDRAWAL_BLOCKED_HOLD,
    severity: RiskSeverity.CRITICAL,
  };
}
```

**When Triggered**:

- Admin places hold via `placeUserHold()` mutation
- Hold remains active until admin releases it via `releaseUserHold()`

**Override**: Only admin can release the hold

---

### Rule 2: Bank Account Cooldown

**Priority**: HIGH

Prevents bank transfer withdrawals within 24 hours of changing bank account details.

```typescript
if (
  method === BANK_TRANSFER &&
  now - lastBankAccountChangeAt < 24 hours
) {
  return {
    blocked: true,
    rule: "bank_account_cooldown",
    message: "Wait 24 hours after changing bank account details",
    eventType: RiskEventType.WITHDRAWAL_BLOCKED_BANK_COOLDOWN,
    severity: RiskSeverity.WARNING,
  };
}
```

**Purpose**: Prevents fraudsters from quickly changing account details and withdrawing funds

**Applies To**: Bank transfer withdrawals only

---

### Rule 3: Daily Amount Limit

**Priority**: MEDIUM

Blocks withdrawals that exceed the daily cumulative limit.

```typescript
if (recentDailyAmountKobo + amountKobo > 50_000_000n) {
  return {
    blocked: true,
    rule: "daily_amount_limit",
    message: "Daily withdrawal amount limit exceeded",
    eventType: RiskEventType.WITHDRAWAL_BLOCKED_DAILY_AMOUNT,
    severity: RiskSeverity.WARNING,
  };
}
```

**Calculation**: Sum of all withdrawals in past 24 hours + current request

**Limit**: ₦500,000 per day (50,000,000 kobo)

---

### Rule 4: Daily Count Limit

**Priority**: MEDIUM

Blocks withdrawals when daily count exceeds maximum.

```typescript
if (recentDailyCount + 1 > 3) {
  return {
    blocked: true,
    rule: "daily_count_limit",
    message: "Daily withdrawal count limit exceeded",
    eventType: RiskEventType.WITHDRAWAL_BLOCKED_DAILY_COUNT,
    severity: RiskSeverity.WARNING,
  };
}
```

**Limit**: Maximum 3 withdrawals per 24-hour period

---

### Rule 5: Velocity Check

**Priority**: MEDIUM

Prevents rapid-fire withdrawal attempts.

```typescript
if (recentVelocityCount + 1 > 2) {
  return {
    blocked: true,
    rule: "velocity_limit",
    message: "Too many withdrawal attempts in a short time",
    eventType: RiskEventType.WITHDRAWAL_BLOCKED_VELOCITY,
    severity: RiskSeverity.WARNING,
  };
}
```

**Window**: 15 minutes  
**Limit**: Maximum 2 withdrawals per 15-minute window

---

## Risk Decision Type

```typescript
type WithdrawalRiskDecision =
  | {
      blocked: false;
      rule?: undefined;
      message?: undefined;
      eventType?: undefined;
      severity?: undefined;
      details?: undefined;
    }
  | {
      blocked: true;
      rule: WithdrawalRiskRule;
      message: string;
      eventType: RiskEventType;
      severity: RiskSeverity;
      details?: Record<string, string | number | boolean>;
    };
```

**Allowed Decision**: All fields except `blocked: false` are undefined

**Blocked Decision**: Includes rule name, message, event type, severity, and optional details

---

## Core Functions

### `evaluateWithdrawalRiskDecision(input)`

Pure function that evaluates all risk rules and returns a decision.

**Input Parameters**:

```typescript
{
  amountKobo: bigint;                    // Requested amount in kobo
  method: WithdrawalMethod;              // BANK_TRANSFER or CASH
  now: number;                           // Current timestamp
  lastBankAccountChangeAt?: number;      // Last bank change timestamp
  activeHold?: Pick<UserRiskHold, "_id" | "reason" | "placed_at">;
  recentDailyAmountKobo: bigint;         // Total withdrawn in past 24h
  recentDailyCount: number;              // Count of withdrawals in past 24h
  recentVelocityCount: number;           // Count in past 15 minutes
}
```

**Returns**: `WithdrawalRiskDecision`

**Example**:

```typescript
const decision = evaluateWithdrawalRiskDecision({
  amountKobo: 100_000n,
  method: WithdrawalMethod.BANK_TRANSFER,
  now: Date.now(),
  lastBankAccountChangeAt: Date.now() - 10000000,
  activeHold: undefined,
  recentDailyAmountKobo: 0n,
  recentDailyCount: 0,
  recentVelocityCount: 0,
});

if (decision.blocked) {
  console.log(`Blocked by: ${decision.rule}`);
  console.log(`Reason: ${decision.message}`);
}
```

---

### `assertWithdrawalRequestAllowed(ctx, args)`

Main entry point for withdrawal risk checks. Throws error if blocked.

**Parameters**:

```typescript
{
  user: User;
  method: WithdrawalMethod;
  amountKobo: bigint;
  now: number;
}
```

**Behavior**:

1. Fetches active holds, bank account changes, and withdrawal history
2. Calls `evaluateWithdrawalRiskDecision()`
3. If blocked:
   - Logs risk event to database
   - Throws ConvexError with error data
4. If allowed: returns void

**Usage**:

```typescript
// In withdrawals.ts requestWithdrawal mutation
await assertWithdrawalRequestAllowed(ctx, {
  user,
  method: args.method,
  amountKobo: args.amount_kobo,
  now: Date.now(),
});
```

---

### `assertWithdrawalAdminActionAllowed(ctx, args)`

Validates that an admin action (approve/reject/process) is allowed even if user has hold.

**Parameters**:

```typescript
{
  userId: UserId;
  actorAdminId: AdminUser["_id"];
}
```

**Behavior**:

- Checks if user has active hold
- If yes, logs admin override attempt as risk event
- Throws error to prevent admin from bypassing hold

**Purpose**: Prevents admins from accidentally processing withdrawals for held users

---

### `buildWithdrawalRiskSummary(ctx, userId)`

Fetches and summarizes risk state for UI display.

**Returns**:

```typescript
{
  has_active_hold: boolean;
  blocked: boolean;
  block_reason?: string;
  active_hold?: {
    _id: Id<"user_risk_holds">;
    reason: string;
    placed_by_admin_id: Id<"admin_users">;
    placed_at: number;
    // ... other fields
  };
  latest_event?: {
    _id: Id<"risk_events">;
    event_type: RiskEventType;
    severity: RiskSeverity;
    message: string;
    created_at: number;
    // ... other fields
  };
}
```

**Usage**: Display risk status in admin dashboard

---

## Administrative Functions

### `placeUserHold(args)`

Places a manual withdrawal hold on a user.

**Arguments**:

```typescript
{
  userId: v.id("users");
  reason: v.string();
}
```

**Returns**: Risk hold summary object

**Validation**:

- Admin must be authenticated
- User must exist
- User cannot already have active hold

**Side Effects**:

1. Inserts `user_risk_hold` record with status=ACTIVE
2. Logs `HOLD_PLACED` risk event
3. Writes audit log entry

**Example**:

```typescript
await ctx.runMutation(risk.placeUserHold, {
  userId: user._id,
  reason: "Suspected account compromise - investigation pending",
});
```

---

### `releaseUserHold(args)`

Releases a manual withdrawal hold.

**Arguments**:

```typescript
{
  userId: v.id("users");
}
```

**Returns**: Updated risk hold summary

**Validation**:

- Admin must be authenticated
- User must have active hold

**Side Effects**:

1. Updates hold status to RELEASED
2. Sets released_by_admin_id and released_at
3. Logs `HOLD_RELEASED` risk event
4. Writes audit log with before/after comparison

**Example**:

```typescript
await ctx.runMutation(risk.releaseUserHold, {
  userId: user._id,
});
```

---

### `listEventsForAdmin(args)`

Lists risk events for admin review.

**Arguments**:

```typescript
{
  userId?: v.id("users");        // Optional filter by user
  limit?: v.number();            // Default 20, max 100
}
```

**Returns**: Array of risk event summaries

**Ordering**: Most recent first (by created_at DESC)

**Usage**: Admin dashboard risk timeline

---

## Risk Events

All risk decisions are logged to the `risk_events` table for audit and analysis.

### Event Types

```typescript
enum RiskEventType {
  // Withdrawal blocks
  WITHDRAWAL_BLOCKED_HOLD,
  WITHDRAWAL_BLOCKED_BANK_COOLDOWN,
  WITHDRAWAL_BLOCKED_DAILY_AMOUNT,
  WITHDRAWAL_BLOCKED_DAILY_COUNT,
  WITHDRAWAL_BLOCKED_VELOCITY,

  // Hold lifecycle
  HOLD_PLACED,
  HOLD_RELEASED,
}
```

### Severity Levels

```typescript
enum RiskSeverity {
  INFO = "info", // Informational (hold released)
  WARNING = "warning", // Potential fraud (limits exceeded)
  CRITICAL = "critical", // Active threat (manual hold triggered)
}
```

### Event Structure

```typescript
{
  _id: Id<"risk_events">;
  user_id: Id<"users">;
  scope: "withdrawals";
  event_type: RiskEventType;
  severity: RiskSeverity;
  message: string;
  details?: Record<string, any>;
  actor_admin_id?: Id<"admin_users">;  // If admin-triggered
  created_at: number;
}
```

---

## Error Data Structure

When a withdrawal is blocked, the error includes detailed metadata:

```typescript
{
  code: "withdrawal_risk_blocked";
  scope: "withdrawals";
  rule: WithdrawalRiskRule;  // Which rule triggered
  message: string;            // Human-readable reason
  details?: {
    hold_id?: string;
    hold_reason?: string;
    attempted_amount_kobo?: string;
    recent_daily_amount_kobo?: string;
    daily_limit_kobo?: string;
    recent_daily_count?: number;
    daily_count_limit?: number;
    recent_velocity_count?: number;
    velocity_count_limit?: number;
    velocity_window_ms?: number;
    last_bank_account_change_at?: number;
    cooldown_ms?: number;
  };
}
```

**Frontend Usage**:

```typescript
try {
  await api.withdrawals.requestWithdrawal({ ... });
} catch (error) {
  if (error.data?.code === "withdrawal_risk_blocked") {
    const rule = error.data.rule;
    const message = error.data.message;
    const details = error.data.details;

    switch (rule) {
      case "manual_hold":
        showBlockingMessage(message);
        break;
      case "daily_amount_limit":
        showLimitMessage(
          `₦${Number(details.daily_limit_kobo) / 100} daily limit`,
          `Attempted: ₦${Number(details.attempted_amount_kobo) / 100}`,
          `Already withdrawn: ₦${Number(details.recent_daily_amount_kobo) / 100}`
        );
        break;
      // ... handle other rules
    }
  }
}
```

---

## Helper Functions

### Internal Statistics Functions

These functions fetch historical data for risk evaluation:

#### `getActiveWithdrawalHold(ctx, userId)`

Returns the active withdrawal hold if exists, null otherwise.

#### `getLatestRiskEvent(ctx, userId)`

Returns the most recent risk event for a user.

#### `getLastBankAccountChangeAt(ctx, userId)`

Returns timestamp of last bank account creation/update/primary change.

#### `getRecentWithdrawalStats(ctx, userId, now)`

Calculates withdrawal statistics:

```typescript
{
  recentDailyAmountKobo: bigint; // Total in past 24h
  recentDailyCount: number; // Count in past 24h
  recentVelocityCount: number; // Count in past 15min
}
```

---

## Integration Example

### Withdrawal Request Flow

```typescript
// withdrawals.ts - requestWithdrawal mutation
export const requestWithdrawal = mutation({
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const now = Date.now();

    // 1. Run risk assessment BEFORE creating withdrawal
    await assertWithdrawalRequestAllowed(ctx, {
      user,
      method: args.method,
      amountKobo: args.amount_kobo,
      now,
    });

    // 2. If passed, proceed with withdrawal creation
    const withdrawalId = await ctx.db.insert(TABLE_NAMES.WITHDRAWALS, {
      // ... withdrawal data
    });

    // 3. Sync with aggregates
    const withdrawal = await ctx.db.get(withdrawalId);
    await syncWithdrawalInsert(ctx, withdrawal);

    return withdrawalId;
  },
});
```

### Admin Dashboard Display

```typescript
// Admin UI component
function RiskStatusPanel({ userId }: { userId: UserId }) {
  const riskSummary = useQuery(risk.buildWithdrawalRiskSummary, { userId });

  if (!riskSummary) return <LoadingSpinner />;

  return (
    <Card>
      <CardHeader>Risk Assessment</CardHeader>
      <CardContent>
        {riskSummary.has_active_hold ? (
          <Alert variant="destructive">
            <AlertTitle>Withdrawals Blocked</AlertTitle>
            <AlertDescription>{riskSummary.block_reason}</AlertDescription>
          </Alert>
        ) : (
          <Alert variant="success">
            <AlertTitle>No Active Holds</AlertTitle>
            <AlertDescription>
              User can request withdrawals normally
            </AlertDescription>
          </Alert>
        )}

        {riskSummary.latest_event && (
          <div className="mt-4">
            <h4 className="text-sm font-medium">Latest Risk Event</h4>
            <p className="text-sm text-muted-foreground">
              {riskSummary.latest_event.message}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(riskSummary.latest_event.created_at).toLocaleString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## Testing Checklist

### Unit Tests (Pure Functions)

```typescript
describe("evaluateWithdrawalRiskDecision", () => {
  test("should allow normal withdrawal", () => {
    const decision = evaluateWithdrawalRiskDecision({
      amountKobo: 10_000n,
      method: WithdrawalMethod.BANK_TRANSFER,
      now: Date.now(),
      activeHold: undefined,
      lastBankAccountChangeAt: undefined,
      recentDailyAmountKobo: 0n,
      recentDailyCount: 0,
      recentVelocityCount: 0,
    });

    expect(decision.blocked).toBe(false);
  });

  test("should block due to manual hold", () => {
    const decision = evaluateWithdrawalRiskDecision({
      amountKobo: 10_000n,
      method: WithdrawalMethod.BANK_TRANSFER,
      now: Date.now(),
      activeHold: {
        _id: "hold123" as any,
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

  test("should block due to bank account cooldown", () => {
    const decision = evaluateWithdrawalRiskDecision({
      amountKobo: 10_000n,
      method: WithdrawalMethod.BANK_TRANSFER,
      now: Date.now(),
      lastBankAccountChangeAt: Date.now() - 1000000, // 1 second ago
      activeHold: undefined,
      recentDailyAmountKobo: 0n,
      recentDailyCount: 0,
      recentVelocityCount: 0,
    });

    expect(decision.blocked).toBe(true);
    expect(decision.rule).toBe("bank_account_cooldown");
  });

  test("should block due to daily amount limit", () => {
    const decision = evaluateWithdrawalRiskDecision({
      amountKobo: 1_000_000n, // ₦10,000
      method: WithdrawalMethod.BANK_TRANSFER,
      now: Date.now(),
      activeHold: undefined,
      lastBankAccountChangeAt: undefined,
      recentDailyAmountKobo: 49_500_000n, // ₦495,000
      recentDailyCount: 2,
      recentVelocityCount: 1,
    });

    expect(decision.blocked).toBe(true);
    expect(decision.rule).toBe("daily_amount_limit");
  });

  test("should block due to velocity limit", () => {
    const decision = evaluateWithdrawalRiskDecision({
      amountKobo: 10_000n,
      method: WithdrawalMethod.BANK_TRANSFER,
      now: Date.now(),
      activeHold: undefined,
      lastBankAccountChangeAt: undefined,
      recentDailyAmountKobo: 0n,
      recentDailyCount: 0,
      recentVelocityCount: 2, // Already at limit
    });

    expect(decision.blocked).toBe(true);
    expect(decision.rule).toBe("velocity_limit");
  });
});
```

### Integration Tests

```typescript
describe("assertWithdrawalRequestAllowed", () => {
  test("should throw when user has active hold", async () => {
    // Create active hold
    await ctx.runMutation(risk.placeUserHold, {
      userId: testUser._id,
      reason: "Testing",
    });

    // Attempt withdrawal
    await expect(
      ctx.runMutation(withdrawals.requestWithdrawal, {
        amount_kobo: 10_000n,
        method: WithdrawalMethod.BANK_TRANSFER,
      })
    ).rejects.toThrow("withdrawal_risk_blocked");
  });

  test("should allow withdrawal when no risks", async () => {
    const withdrawalId = await ctx.runMutation(withdrawals.requestWithdrawal, {
      amount_kobo: 10_000n,
      method: WithdrawalMethod.BANK_TRANSFER,
    });

    expect(withdrawalId).toBeDefined();
  });
});
```

---

## Performance Considerations

### Query Optimization

All risk-related queries use indexes for fast lookups:

```typescript
// Index on user_risk_holds
.withIndex("by_user_id_and_status", q =>
  q.eq("user_id", userId).eq("status", RiskHoldStatus.ACTIVE)
)

// Index on risk_events
.withIndex("by_user_id_and_created_at", q =>
  q.eq("user_id", userId)
)

// Index on withdrawals
.withIndex("by_requested_by", q =>
  q.eq("requested_by", userId)
)
```

### Caching Strategy

Consider caching risk summary for frequently-checked users:

```typescript
// Cache for 5 seconds
const cachedRiskSummary = await cache.get(`risk:${userId}`);
if (cachedRiskSummary) return cachedRiskSummary;

const summary = await buildWithdrawalRiskSummary(ctx, userId);
await cache.set(`risk:${userId}`, summary, 5000);
return summary;
```

---

## Security Notes

⚠️ **Critical Security Controls**:

1. **Always check risk BEFORE creating withdrawal**

   - Never skip the risk assessment
   - Check happens inside transaction (atomic)

2. **Log all blocked attempts**

   - Risk events provide audit trail
   - Essential for fraud investigation

3. **Admin actions also validated**

   - Prevents accidental hold bypass
   - Admin override attempts are logged

4. **No client-side risk logic**

   - All evaluation happens server-side
   - Client only sees pass/fail result

5. **Hold placement requires authentication**
   - Only authenticated admins can place holds
   - Admin identity is recorded

---

## Monitoring Recommendations

Track these metrics in production:

```typescript
// Risk event counts by type
const eventCounts = await ctx.db
  .query(TABLE_NAMES.RISK_EVENTS)
  .withIndex("by_event_type_and_created_at", q =>
    q.eq("event_type", eventType)
  )
  .filter(q => q.gte(q.field("created_at"), Date.now() - DAY_MS))
  .collect();

// Users with active holds
const activeHoldsCount = await ctx.db
  .query(TABLE_NAMES.USER_RISK_HOLDS)
  .withIndex("by_status", q => q.eq("status", RiskHoldStatus.ACTIVE))
  .collect();

// Withdrawal approval rate
const totalRequests = ...;
const blockedRequests = ...;
const approvalRate = (totalRequests - blockedRequests) / totalRequests;
```

---

## Related Files

- [`withdrawals.ts`](./withdrawals.md) - Withdrawal request processing
- [`withdrawalPolicy.ts`](./withdrawalPolicy.md) - Action capability policies
- [`auditLog.ts`](./auditLog.md) - Audit trail system
- [`types.ts`](./types.md) - Type definitions
