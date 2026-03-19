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

const DAY_MS = 24 * 60 * 60 * 1000; // 24 hours
const VELOCITY_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const BANK_ACCOUNT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export const WITHDRAWAL_DAILY_LIMIT_KOBO = 50_000_000n;
export const WITHDRAWAL_DAILY_COUNT_LIMIT = 3;
export const WITHDRAWAL_VELOCITY_COUNT_LIMIT = 2;

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

export const withdrawalRiskSummaryValidator = v.object({
  has_active_hold: v.boolean(),
  blocked: v.boolean(),
  block_reason: v.optional(v.string()),
  active_hold: v.optional(riskHoldSummaryValidator),
  latest_event: v.optional(riskEventSummaryValidator),
});

type WithdrawalRiskRule =
  | "manual_hold"
  | "daily_amount_limit"
  | "daily_count_limit"
  | "velocity_limit"
  | "bank_account_cooldown";

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

export function evaluateWithdrawalRiskDecision(
  input: WithdrawalRiskEvaluationInput,
): WithdrawalRiskDecision {
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

  return { blocked: false };
}

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

  const event = await ctx.db.get(eventId);
  if (!event) {
    throw new ConvexError("Failed to record risk event");
  }

  return event;
}

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

  return (
    activeHolds.find((hold) => hold.scope === RiskHoldScope.WITHDRAWALS) ?? null
  );
}

async function getLatestRiskEvent(ctx: Context, userId: UserId) {
  const events = await ctx.db
    .query(TABLE_NAMES.RISK_EVENTS)
    .withIndex("by_user_id_and_created_at", (q) => q.eq("user_id", userId))
    .order("desc")
    .take(1);

  return events[0] ?? null;
}

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

async function evaluateWithdrawalRiskFromContext(
  ctx: Context,
  args: {
    userId: UserId;
    method: WithdrawalMethod;
    amountKobo: bigint;
    now: number;
  },
) {
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

  if (!decision.blocked) {
    return;
  }

  await insertRiskEvent(ctx, {
    userId: args.user._id,
    eventType: decision.eventType,
    severity: decision.severity,
    message: decision.message,
    details: decision.details,
  });

  throw new ConvexError(buildWithdrawalRiskErrorData(decision));
}

export async function assertWithdrawalAdminActionAllowed(
  ctx: MutationCtx,
  args: {
    userId: UserId;
    actorAdminId: AdminUser["_id"];
  },
) {
  const activeHold = await getActiveWithdrawalHold(ctx, args.userId);
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

export const placeUserHold = mutation({
  args: {
    userId: v.id("users"),
    reason: v.string(),
  },
  returns: riskHoldSummaryValidator,
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new ConvexError("User not found");
    }

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

export const releaseUserHold = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: riskHoldSummaryValidator,
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    const activeHold = await getActiveWithdrawalHold(ctx, args.userId);

    if (!activeHold) {
      throw new ConvexError("User does not have an active withdrawal hold");
    }

    const releasedAt = Date.now();
    await ctx.db.patch(activeHold._id, {
      status: RiskHoldStatus.RELEASED,
      released_by_admin_id: admin._id,
      released_at: releasedAt,
    });

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
