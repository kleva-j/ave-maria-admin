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
  RiskEvent,
  AdminUser,
  Context,
  UserId,
  User,
} from "./types";

import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getAdminUser } from "./utils";

import {
  createPlaceRiskHoldUseCase,
  createReleaseRiskHoldUseCase,
  createEvaluateWithdrawalRiskUseCase,
  createAssertWithdrawalAllowedUseCase,
} from "@avm-daily/application/use-cases";

import {
  createConvexBankAccountEventRepository,
  createConvexRiskEventService,
  createConvexRiskHoldRepository,
} from "./adapters/riskAdapters";

import { createConvexWithdrawalRepository } from "./adapters/withdrawalAdapter";
import { createConvexAuditLogService } from "./adapters/auditLogAdapter";

import {
  DomainError,
  WithdrawalBlockedError,
  WITHDRAWAL_DAILY_LIMIT_KOBO,
  WITHDRAWAL_DAILY_COUNT_LIMIT,
  WITHDRAWAL_VELOCITY_COUNT_LIMIT,
  BANK_ACCOUNT_COOLDOWN_MS,
} from "@avm-daily/domain";

import type { WithdrawalMethod } from "./shared";

import {
  RiskHoldStatus,
  riskHoldStatus,
  RiskHoldScope,
  riskEventType,
  riskHoldScope,
  riskSeverity,
  TABLE_NAMES,
  RiskEventType,
  RiskSeverity,
} from "./shared";

// Re-export constants from domain (single source of truth)
export {
  WITHDRAWAL_DAILY_LIMIT_KOBO,
  WITHDRAWAL_DAILY_COUNT_LIMIT,
  WITHDRAWAL_VELOCITY_COUNT_LIMIT,
  BANK_ACCOUNT_COOLDOWN_MS,
} from "@avm-daily/domain";

/** Validator for risk hold summary objects returned to clients */
export const riskHoldSummaryValidator = v.object({
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
 * Builds structured error data for blocked withdrawals
 */
function buildWithdrawalRiskErrorData(decision: {
  rule: string;
  message: string;
}) {
  return {
    code: "withdrawal_risk_blocked" as const,
    scope: RiskHoldScope.WITHDRAWALS,
    rule: decision.rule,
    message: decision.message,
  };
}

/**
 * Fetches the active withdrawal hold for a user, if any
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

  return (
    activeHolds.find((hold) => hold.scope === RiskHoldScope.WITHDRAWALS) ?? null
  );
}

/**
 * Converts a UserRiskHold to a summary object for client response
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
 * Fetches the most recent risk event for a user
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
 * Builds a comprehensive risk summary for UI display
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
 * Asserts that a withdrawal request is allowed by evaluating all risk rules via use-case.
 * Delegates to createAssertWithdrawalAllowedUseCase with Convex adapters.
 *
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
  const riskHoldRepository = createConvexRiskHoldRepository(ctx);
  const withdrawalRepository = createConvexWithdrawalRepository(ctx);
  const bankAccountEventRepository = createConvexBankAccountEventRepository(ctx);
  const riskEventService = createConvexRiskEventService(ctx);

  const evaluateWithdrawalRisk = createEvaluateWithdrawalRiskUseCase({
    riskHoldRepository,
    withdrawalRepository,
    bankAccountEventRepository,
  });

  const assertWithdrawalAllowed = createAssertWithdrawalAllowedUseCase({
    evaluateWithdrawalRisk,
    riskEventService,
  });

  try {
    await assertWithdrawalAllowed({
      userId: String(args.user._id),
      amountKobo: args.amountKobo,
      method: args.method,
      now: args.now,
    });
  } catch (err) {
    if (err instanceof WithdrawalBlockedError) {
      throw new ConvexError(buildWithdrawalRiskErrorData({ rule: err.rule, message: err.message }));
    }
    if (err instanceof DomainError) {
      throw new ConvexError({ code: err.code, message: err.message });
    }
    throw err;
  }
}

/**
 * Asserts that an admin action is allowed even with active hold.
 * Logs admin override attempt as risk event.
 *
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
  if (!activeHold) {
    return;
  }

  const riskEventService = createConvexRiskEventService(ctx);
  await riskEventService.record({
    userId: String(args.userId),
    scope: RiskHoldScope.WITHDRAWALS,
    eventType: RiskEventType.WITHDRAWAL_BLOCKED_HOLD,
    severity: RiskSeverity.CRITICAL,
    message: `Withdrawals are currently blocked for this user: ${activeHold.reason}`,
    details: {
      hold_id: String(activeHold._id),
      hold_reason: activeHold.reason,
      placed_at: activeHold.placed_at,
    },
    actorAdminId: String(args.actorAdminId),
  });

  throw new ConvexError(buildWithdrawalRiskErrorData({
    rule: "manual_hold",
    message: `Withdrawals are currently blocked for this user: ${activeHold.reason}`,
  }));
}

/**
 * Places a manual withdrawal hold on a user via use-case.
 *
 * @mutation
 * @requires Admin authentication
 */
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

    const placeRiskHold = createPlaceRiskHoldUseCase({
      riskHoldRepository: createConvexRiskHoldRepository(ctx),
      riskEventService: createConvexRiskEventService(ctx),
      auditLogService: createConvexAuditLogService(ctx),
    });

    try {
      await placeRiskHold({
        userId: String(args.userId),
        reason: args.reason,
        adminId: String(admin._id),
      });
    } catch (err) {
      if (err instanceof DomainError) {
        throw new ConvexError(err.message);
      }
      throw err;
    }

    // Fetch the newly created hold to return the summary
    const activeHold = await getActiveWithdrawalHold(ctx, args.userId);
    if (!activeHold) {
      throw new ConvexError("Failed to create risk hold");
    }

    return summarizeRiskHold(activeHold);
  },
});

/**
 * Releases a manual withdrawal hold from a user via use-case.
 *
 * @mutation
 * @requires Admin authentication
 */
export const releaseUserHold = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: riskHoldSummaryValidator,
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);

    // Capture the hold before releasing so we can return it
    const activeHold = await getActiveWithdrawalHold(ctx, args.userId);
    if (!activeHold) {
      throw new ConvexError("User does not have an active withdrawal hold");
    }

    const releaseRiskHold = createReleaseRiskHoldUseCase({
      riskHoldRepository: createConvexRiskHoldRepository(ctx),
      riskEventService: createConvexRiskEventService(ctx),
      auditLogService: createConvexAuditLogService(ctx),
    });

    try {
      await releaseRiskHold({
        userId: String(args.userId),
        adminId: String(admin._id),
      });
    } catch (err) {
      if (err instanceof DomainError) {
        throw new ConvexError(err.message);
      }
      throw err;
    }

    // Fetch the updated hold to return the summary
    const updated = await ctx.db.get(activeHold._id);
    if (!updated) {
      throw new ConvexError("Failed to release risk hold");
    }

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
      const userId = args.userId;
      const events = await ctx.db
        .query(TABLE_NAMES.RISK_EVENTS)
        .withIndex("by_user_id_and_created_at", (q) =>
          q.eq("user_id", userId),
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
