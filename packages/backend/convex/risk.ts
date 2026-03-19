/**
 * Risk Assessment & Fraud Prevention System
 * 
 * Provides real-time risk evaluation for withdrawal requests,
 * automated fraud detection, manual administrative controls,
 * and comprehensive risk event logging.
 * 
 * @module risk
 */

import type { MutationCtx } from "./_generated/server";
import type {
  UserRiskHold,
  AdminUser,
  RiskEvent,
  Context,
  UserId,
  User,
} from "./types";

import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getAdminUser } from "./utils";
import { auditLog } from "./auditLog";
import {
  WithdrawalMethod,
  RiskHoldStatus,
  riskHoldStatus,
  RESOURCE_TYPE,
  RiskEventType,
  RiskHoldScope,
  riskEventType,
  riskHoldScope,
  RiskSeverity,
  riskSeverity,
  TABLE_NAMES,
  EVENT_TYPE,
} from "./shared";

/** Time window for daily limit calculations (24 hours in milliseconds) */
const DAY_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Time window for velocity checks (15 minutes in milliseconds) */
const VELOCITY_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/** Cooldown period after bank account changes (24 hours in milliseconds) */
const BANK_ACCOUNT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Maximum daily withdrawal amount in kobo (₦500,000) */
export const WITHDRAWAL_DAILY_LIMIT_KOBO = 50_000_000n;

/** Maximum number of withdrawals allowed per day */
export const WITHDRAWAL_DAILY_COUNT_LIMIT = 3;

/** Maximum withdrawals within velocity window (15 minutes) */
export const WITHDRAWAL_VELOCITY_COUNT_LIMIT = 2;

/** Validator for risk hold summary objects returned to clients */
const riskHoldSummaryValidator = v.object({
  _id: v.id("user_risk_holds"),
  user_id: v.id("users"),
  scope: riskHoldScope,
  status: riskHoldStatus,
  reason: v.string(),
  placed_by_admin_id: v.id("admin_users"),
  placed_at: v.number(),
  released_by_admin_id: v.optional(v.id("admin_users")),
  released_at: v.optional(v.number()),
});

/** Validator for risk event summary objects returned to clients */
const riskEventSummaryValidator = v.object({
  _id: v.id("risk_events"),
  user_id: v.id("users"),
  scope: riskHoldScope,
  event_type: riskEventType,
  severity: riskSeverity,
  message: v.string(),
  details: v.optional(v.any()),
  actor_admin_id: v.optional(v.id("admin_users")),
  created_at: v.number(),
});

/**
 * Validator for withdrawal risk summary
 * Used by admin dashboards to display risk status
 */
export const withdrawalRiskSummaryValidator = v.object({
  has_active_hold: v.boolean(),
  blocked: v.boolean(),
  block_reason: v.optional(v.string()),
  active_hold: v.optional(riskHoldSummaryValidator),
  latest_event: v.optional(riskEventSummaryValidator),
});

/**
 * Union type representing which risk rule triggered a block
 */
type WithdrawalRiskRule =
  | "manual_hold"
  | "daily_amount_limit"
  | "daily_count_limit"
  | "velocity_limit"
  | "bank_account_cooldown";

/**
 * Result of evaluating withdrawal risk
 * - blocked: false = withdrawal allowed
 * - blocked: true = withdrawal denied with reason and metadata
 */
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
      details?: Record<string, string | number | boolean | undefined>;
    };

/**
 * Input parameters for withdrawal risk evaluation
 */
type WithdrawalRiskEvaluationInput = {
  amountKobo: bigint;
  method: WithdrawalMethod;
  now: number;
  lastBankAccountChangeAt?: number;
  activeHold?: Pick<UserRiskHold, "_id" | "reason" | "placed_at">;
  recentDailyAmountKobo: bigint;
  recentDailyCount: number;
  recentVelocityCount: number;
};

/**
 * Evaluates all risk rules for a withdrawal request and returns a decision
 * 
 * This is a pure function (no side effects) that checks:
 * 1. Manual holds (highest priority)
 * 2. Bank account cooldown period
 * 3. Daily amount limits
 * 4. Daily count limits
 * 5. Velocity limits
 * 
 * @param input - Risk evaluation input parameters
 * @returns WithdrawalRiskDecision - blocked=true with reason, or allowed
 */
export function evaluateWithdrawalRiskDecision(
  input: WithdrawalRiskEvaluationInput,
): WithdrawalRiskDecision {
  // Rule 1: Check for manual administrative hold (CRITICAL severity)
  if (input.activeHold) {
    return {
      blocked: true,
      rule: "manual_hold",
      message: `Withdrawals are currently blocked for this user: ${input.activeHold.reason}`,
      eventType: RiskEventType.WITHDRAWAL_BLOCKED_HOLD,
      severity: RiskSeverity.CRITICAL,
      details: {
        hold_id: String(input.activeHold._id),
        hold_reason: input.activeHold.reason,
        placed_at: input.activeHold.placed_at,
      },
    };
  }

  // Rule 2: Bank account cooldown (24 hours after change)
  if (
    input.method === WithdrawalMethod.BANK_TRANSFER &&
    input.lastBankAccountChangeAt !== undefined &&
    input.now - input.lastBankAccountChangeAt < BANK_ACCOUNT_COOLDOWN_MS
  ) {
    return {
      blocked: true,
      rule: "bank_account_cooldown",
      message:
        "Wait 24 hours after changing bank account details before requesting a bank transfer withdrawal.",
      eventType: RiskEventType.WITHDRAWAL_BLOCKED_BANK_COOLDOWN,
      severity: RiskSeverity.WARNING,
      details: {
        last_bank_account_change_at: input.lastBankAccountChangeAt,
        cooldown_ms: BANK_ACCOUNT_COOLDOWN_MS,
      },
    };
  }

  // Rule 3: Daily amount limit check
  if (
    input.recentDailyAmountKobo + input.amountKobo >
    WITHDRAWAL_DAILY_LIMIT_KOBO
  ) {
    return {
      blocked: true,
      rule: "daily_amount_limit",
      message: "Daily withdrawal amount limit exceeded.",
      eventType: RiskEventType.WITHDRAWAL_BLOCKED_DAILY_AMOUNT,
      severity: RiskSeverity.WARNING,
      details: {
        attempted_amount_kobo: input.amountKobo.toString(),
        recent_daily_amount_kobo: input.recentDailyAmountKobo.toString(),
        daily_limit_kobo: WITHDRAWAL_DAILY_LIMIT_KOBO.toString(),
      },
    };
  }

  // Rule 4: Daily count limit check
  if (input.recentDailyCount + 1 > WITHDRAWAL_DAILY_COUNT_LIMIT) {
    return {
      blocked: true,
      rule: "daily_count_limit",
      message: "Daily withdrawal count limit exceeded.",
      eventType: RiskEventType.WITHDRAWAL_BLOCKED_DAILY_COUNT,
      severity: RiskSeverity.WARNING,
      details: {
        recent_daily_count: input.recentDailyCount,
        daily_count_limit: WITHDRAWAL_DAILY_COUNT_LIMIT,
      },
    };
  }

  // Rule 5: Velocity limit check (15-minute window)
  if (input.recentVelocityCount + 1 > WITHDRAWAL_VELOCITY_COUNT_LIMIT) {
    return {
      blocked: true,
      rule: "velocity_limit",
      message: "Too many withdrawal attempts in a short time.",
      eventType: RiskEventType.WITHDRAWAL_BLOCKED_VELOCITY,
      severity: RiskSeverity.WARNING,
      details: {
        recent_velocity_count: input.recentVelocityCount,
        velocity_count_limit: WITHDRAWAL_VELOCITY_COUNT_LIMIT,
        velocity_window_ms: VELOCITY_WINDOW_MS,
      },
    };
  }

  // All checks passed - withdrawal allowed
  return { blocked: false };
}

/**
 * Builds structured error data for blocked withdrawals
 * 
 * @param decision - The blocked risk decision
 * @returns Error data object for ConvexError
 */
function buildWithdrawalRiskErrorData(decision: Extract<
  WithdrawalRiskDecision,
  { blocked: true }
>) {
  return {
    code: "withdrawal_risk_blocked" as const,
    scope: RiskHoldScope.WITHDRAWALS,
    rule: decision.rule,
    message: decision.message,
    details: decision.details,
  };
}

/**
 * Converts a UserRiskHold to a summary object for client response
 * 
 * @param hold - Full risk hold record from database
 * @returns Summarized hold data safe for client exposure
 */
function summarizeRiskHold(hold: UserRiskHold) {
  return {
    _id: hold._id,
    user_id: hold.user_id,
    scope: hold.scope,
    status: hold.status,
    reason: hold.reason,
    placed_by_admin_id: hold.placed_by_admin_id,
    placed_at: hold.placed_at,
    released_by_admin_id: hold.released_by_admin_id,
    released_at: hold.released_at,
  };
}

/**
 * Converts a RiskEvent to a summary object for client response
 * 
 * @param event - Full risk event record from database
 * @returns Summarized event data safe for client exposure
 */
function summarizeRiskEvent(event: RiskEvent) {
  return {
    _id: event._id,
    user_id: event.user_id,
    scope: event.scope,
    event_type: event.event_type,
    severity: event.severity,
    message: event.message,
    details: event.details,
    actor_admin_id: event.actor_admin_id,
    created_at: event.created_at,
  };
}

/**
 * Inserts a risk event into the database for audit trail
 * 
 * @param ctx - Mutation context
 * @param args - Event details including type, severity, and metadata
 * @returns The created risk event record
 * @throws ConvexError if event creation fails
 */
async function insertRiskEvent(
  ctx: MutationCtx,
  args: {
    userId: UserId;
    eventType: RiskEventType;
    severity: RiskSeverity;
    message: string;
    details?: Record<string, unknown>;
    actorAdminId?: AdminUser["_id"];
  },
) {
  const eventId = await ctx.db.insert(TABLE_NAMES.RISK_EVENTS, {
    user_id: args.userId,
    scope: RiskHoldScope.WITHDRAWALS,
    event_type: args.eventType,
    severity: args.severity,
    message: args.message,
    details: args.details,
    actor_admin_id: args.actorAdminId,
    created_at: Date.now(),
  });

  // Verify event was created successfully
  const event = await ctx.db.get(eventId);
  if (!event) {
    throw new ConvexError("Failed to record risk event");
  }

  return event;
}

/**
 * Fetches the active withdrawal hold for a user, if any
 * 
 * @param ctx - Database context
 * @param userId - User ID to check for holds
 * @returns Active withdrawal hold or null
 */
async function getActiveWithdrawalHold(
  ctx: Context,
  userId: UserId,
): Promise<UserRiskHold | null> {
  const activeHolds = await ctx.db
    .query(TABLE_NAMES.USER_RISK_HOLDS)
    .withIndex("by_user_id_and_status", (q) =>
      q.eq("user_id", userId).eq("status", RiskHoldStatus.ACTIVE),
    )
    .collect();

  // Return only withdrawal-scope holds
  return (
    activeHolds.find((hold) => hold.scope === RiskHoldScope.WITHDRAWALS) ?? null
  );
}

/**
 * Fetches the most recent risk event for a user
 * 
 * @param ctx - Database context
 * @param userId - User ID to fetch events for
 * @returns Latest risk event or null
 */
async function getLatestRiskEvent(ctx: Context, userId: UserId) {
  const events = await ctx.db
    .query(TABLE_NAMES.RISK_EVENTS)
    .withIndex("by_user_id_and_created_at", (q) => q.eq("user_id", userId))
    .order("desc")
    .take(1);

  return events[0] ?? null;
}

/**
 * Fetches the timestamp of the last bank account change for a user
 * 
 * @param ctx - Database context
 * @param userId - User ID to check
 * @returns Timestamp of last bank account change or undefined
 */
async function getLastBankAccountChangeAt(ctx: Context, userId: UserId) {
  const events = await ctx.db
    .query(TABLE_NAMES.USER_BANK_ACCOUNT_EVENTS)
    .withIndex("by_user_id", (q) => q.eq("user_id", userId))
    .collect();

  return events
    .filter((event) =>
      event.event_type === EVENT_TYPE.CREATED ||
      event.event_type === EVENT_TYPE.UPDATED ||
      event.event_type === EVENT_TYPE.SET_PRIMARY,
    )
    .sort((a, b) => b.created_at - a.created_at)[0]?.created_at;
}

/**
 * Calculates recent withdrawal statistics for risk evaluation
 * 
 * @param ctx - Database context
 * @param userId - User ID to calculate stats for
 * @param now - Current timestamp for window calculations
 * @returns Object with daily and velocity statistics
 */
async function getRecentWithdrawalStats(ctx: Context, userId: UserId, now: number) {
  const sinceDay = now - DAY_MS;
  const sinceVelocity = now - VELOCITY_WINDOW_MS;

  const withdrawals = await ctx.db
    .query(TABLE_NAMES.WITHDRAWALS)
    .withIndex("by_requested_by", (q) => q.eq("requested_by", userId))
    .collect();

  const recentDaily = withdrawals.filter(
    (withdrawal) => withdrawal.requested_at >= sinceDay,
  );
  const recentVelocity = withdrawals.filter(
    (withdrawal) => withdrawal.requested_at >= sinceVelocity,
  );

  return {
    recentDailyAmountKobo: recentDaily.reduce(
      (sum, withdrawal) => sum + withdrawal.requested_amount_kobo,
      0n,
    ),
    recentDailyCount: recentDaily.length,
    recentVelocityCount: recentVelocity.length,
  };
}

/**
 * Evaluates withdrawal risk from database context by fetching all required data
 * 
 * @param ctx - Database context
 * @param args - Withdrawal request parameters
 * @returns Risk decision from evaluateWithdrawalRiskDecision
 */
async function evaluateWithdrawalRiskFromContext(
  ctx: Context,
  args: {
    userId: UserId;
    method: WithdrawalMethod;
    amountKobo: bigint;
    now: number;
  },
) {
  // Fetch all risk-related data in parallel for performance
  const [activeHold, latestBankAccountChangeAt, recentStats] = await Promise.all([
    getActiveWithdrawalHold(ctx, args.userId),
    getLastBankAccountChangeAt(ctx, args.userId),
    getRecentWithdrawalStats(ctx, args.userId, args.now),
  ]);

  return evaluateWithdrawalRiskDecision({
    amountKobo: args.amountKobo,
    method: args.method,
    now: args.now,
    activeHold:
      activeHold === null
        ? undefined
        : {
            _id: activeHold._id,
            reason: activeHold.reason,
            placed_at: activeHold.placed_at,
          },
    lastBankAccountChangeAt: latestBankAccountChangeAt,
    recentDailyAmountKobo: recentStats.recentDailyAmountKobo,
    recentDailyCount: recentStats.recentDailyCount,
    recentVelocityCount: recentStats.recentVelocityCount,
  });
}

/**
 * Builds a comprehensive risk summary for UI display
 * 
 * @param ctx - Database context
 * @param userId - User ID to build summary for
 * @returns Risk summary with active holds and latest events
 */
export async function buildWithdrawalRiskSummary(ctx: Context, userId: UserId) {
  const [activeHold, latestEvent] = await Promise.all([
    getActiveWithdrawalHold(ctx, userId),
    getLatestRiskEvent(ctx, userId),
  ]);

  return {
    has_active_hold: activeHold !== null,
    blocked: activeHold !== null,
    block_reason: activeHold?.reason,
    active_hold: activeHold ? summarizeRiskHold(activeHold) : undefined,
    latest_event: latestEvent ? summarizeRiskEvent(latestEvent) : undefined,
  };
}

/**
 * Asserts that a withdrawal request is allowed by evaluating all risk rules
 * 
 * This is the main entry point for withdrawal risk checks. It:
 * 1. Fetches all risk data (holds, bank changes, withdrawal history)
 * 2. Evaluates all risk rules
 * 3. If blocked: logs risk event and throws error
 * 4. If allowed: returns void
 * 
 * @param ctx - Mutation context
 * @param args - Withdrawal request details including user, amount, method
 * @throws ConvexError with withdrawal_risk_blocked code if blocked
 */
export async function assertWithdrawalRequestAllowed(
  ctx: MutationCtx,
  args: {
    user: User;
    method: WithdrawalMethod;
    amountKobo: bigint;
    now: number;
  },
) {
  const decision = await evaluateWithdrawalRiskFromContext(ctx, {
    userId: args.user._id,
    method: args.method,
    amountKobo: args.amountKobo,
    now: args.now,
  });

  // If not blocked, allow withdrawal to proceed
  if (!decision.blocked) {
    return;
  }

  // Log risk event before throwing error
  await insertRiskEvent(ctx, {
    userId: args.user._id,
    eventType: decision.eventType,
    severity: decision.severity,
    message: decision.message,
    details: decision.details,
  });

  throw new ConvexError(buildWithdrawalRiskErrorData(decision));
}

/**
 * Asserts that an admin action (approve/reject/process) is allowed even with active hold
 * 
 * Prevents admins from accidentally processing withdrawals for held users.
 * Logs admin override attempt as risk event.
 * 
 * @param ctx - Mutation context
 * @param args - User ID and admin ID for validation
 * @throws ConvexError if user has active hold
 */
export async function assertWithdrawalAdminActionAllowed(
  ctx: MutationCtx,
  args: {
    userId: UserId;
    actorAdminId: AdminUser["_id"];
  },
) {
  const activeHold = await getActiveWithdrawalHold(ctx, args.userId);
  // If no active hold, admin action is allowed
  if (!activeHold) {
    return;
  }

  const decision: Extract<WithdrawalRiskDecision, { blocked: true }> = {
    blocked: true,
    rule: "manual_hold",
    message: `Withdrawals are currently blocked for this user: ${activeHold.reason}`,
    eventType: RiskEventType.WITHDRAWAL_BLOCKED_HOLD,
    severity: RiskSeverity.CRITICAL,
    details: {
      hold_id: String(activeHold._id),
      hold_reason: activeHold.reason,
      placed_at: activeHold.placed_at,
    },
  };

  await insertRiskEvent(ctx, {
    userId: args.userId,
    eventType: decision.eventType,
    severity: decision.severity,
    message: decision.message,
    details: decision.details,
    actorAdminId: args.actorAdminId,
  });

  throw new ConvexError(buildWithdrawalRiskErrorData(decision));
}

/**
 * Places a manual withdrawal hold on a user
 * 
 * @mutation
 * @requires Admin authentication
 * @param userId - User to place hold on
 * @param reason - Reason for placing hold (will be shown to user)
 * @returns Summarized risk hold object
 * @throws If user already has active hold or validation fails
 */
export const placeUserHold = mutation({
  args: {
    userId: v.id("users"),
    reason: v.string(),
  },
  returns: riskHoldSummaryValidator,
  handler: async (ctx, args) => {
    // Validate admin authentication
    const admin = await getAdminUser(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    // Check for existing active hold
    const activeHold = await getActiveWithdrawalHold(ctx, args.userId);
    if (activeHold) {
      throw new ConvexError("User already has an active withdrawal hold");
    }

    const placedAt = Date.now();
    const holdId = await ctx.db.insert(TABLE_NAMES.USER_RISK_HOLDS, {
      user_id: args.userId,
      scope: RiskHoldScope.WITHDRAWALS,
      status: RiskHoldStatus.ACTIVE,
      reason: args.reason.trim(),
      placed_by_admin_id: admin._id,
      placed_at: placedAt,
    });

    // Verify hold was created successfully
    const hold = await ctx.db.get(holdId);
    if (!hold) {
      throw new ConvexError("Failed to create risk hold");
    }

    await insertRiskEvent(ctx, {
      userId: args.userId,
      eventType: RiskEventType.HOLD_PLACED,
      severity: RiskSeverity.WARNING,
      message: `Withdrawal hold placed: ${hold.reason}`,
      details: {
        hold_id: String(hold._id),
      },
      actorAdminId: admin._id,
    });

    await auditLog.log(ctx, {
      action: "risk.hold_placed",
      actorId: admin._id,
      resourceType: RESOURCE_TYPE.USER_RISK_HOLDS,
      resourceId: hold._id,
      severity: "warning",
      metadata: {
        user_id: String(args.userId),
        scope: hold.scope,
        reason: hold.reason,
      },
    });

    return summarizeRiskHold(hold);
  },
});

/**
 * Releases a manual withdrawal hold from a user
 * 
 * @mutation
 * @requires Admin authentication
 * @param userId - User to release hold from
 * @returns Updated risk hold object
 * @throws If user doesn't have active hold
 */
export const releaseUserHold = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: riskHoldSummaryValidator,
  handler: async (ctx, args) => {
    // Validate admin authentication
    const admin = await getAdminUser(ctx);
    const activeHold = await getActiveWithdrawalHold(ctx, args.userId);

    if (!activeHold) {
      throw new ConvexError("User does not have an active withdrawal hold");
    }

    // Update hold status to released
    const releasedAt = Date.now();
    await ctx.db.patch(activeHold._id, {
      status: RiskHoldStatus.RELEASED,
      released_by_admin_id: admin._id,
      released_at: releasedAt,
    });

    // Verify update succeeded
    const updated = await ctx.db.get(activeHold._id);
    if (!updated) {
      throw new ConvexError("Failed to release risk hold");
    }

    await insertRiskEvent(ctx, {
      userId: args.userId,
      eventType: RiskEventType.HOLD_RELEASED,
      severity: RiskSeverity.INFO,
      message: "Withdrawal hold released.",
      details: {
        hold_id: String(updated._id),
      },
      actorAdminId: admin._id,
    });

    await auditLog.logChange(ctx, {
      action: "risk.hold_released",
      actorId: admin._id,
      resourceType: RESOURCE_TYPE.USER_RISK_HOLDS,
      resourceId: updated._id,
      before: summarizeRiskHold(activeHold),
      after: summarizeRiskHold(updated),
      severity: "info",
    });

    return summarizeRiskHold(updated);
  },
});

/**
 * Lists risk events for admin review
 * 
 * @query
 * @requires Admin authentication
 * @param userId - Optional filter by specific user
 * @param limit - Number of events to return (default: 20, max: 100)
 * @returns Array of risk event summaries, most recent first
 */
export const listEventsForAdmin = query({
  args: {
    userId: v.optional(v.id("users")),
    limit: v.optional(v.number()),
  },
  returns: v.array(riskEventSummaryValidator),
  handler: async (ctx, args) => {
    await getAdminUser(ctx);

    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);

    if (args.userId) {
      const events = await ctx.db
        .query(TABLE_NAMES.RISK_EVENTS)
        .withIndex("by_user_id_and_created_at", (q) =>
          q.eq("user_id", args.userId!),
        )
        .order("desc")
        .take(limit);

      return events.map(summarizeRiskEvent);
    }

    const events = await ctx.db
      .query(TABLE_NAMES.RISK_EVENTS)
      .withIndex("by_created_at")
      .order("desc")
      .take(limit);

    return events.map(summarizeRiskEvent);
  },
});
