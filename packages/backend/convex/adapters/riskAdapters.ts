/**
 * Convex adapter factories for Risk port interfaces.
 * Implements RiskHoldRepository, RiskEventService, and BankAccountEventRepository
 * using Convex database context.
 */
import type {
  BankAccountEventRepository,
  RiskEventRepository,
  RiskHoldRepository,
  RiskEventService,
} from "@avm-daily/application/ports";

import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { RiskEventType, RiskSeverity } from "../shared";
import type {
  Context as AnyCtx,
  UserRiskHoldId,
  AdminUserId,
  RiskEventId,
  UserId,
} from "../types";

import {
  BankAccountEventType,
  RiskHoldStatus,
  RiskHoldScope,
  TABLE_NAMES,
} from "../shared";

export function createConvexRiskHoldRepository(
  ctx: QueryCtx & MutationCtx,
): RiskHoldRepository {
  return {
    async findActiveWithdrawalHold(userId: UserId): Promise<{
      _id: UserRiskHoldId;
      user_id: UserId;
      scope: RiskHoldScope;
      status: RiskHoldStatus;
      reason: string;
      placed_by_admin_id: AdminUserId;
      placed_at: number;
    } | null> {
      const hold = await ctx.db
        .query(TABLE_NAMES.USER_RISK_HOLDS)
        .withIndex("by_user_id_and_status", (q) =>
          q.eq("user_id", userId).eq("status", RiskHoldStatus.ACTIVE),
        )
        .filter((q) => q.eq(q.field("scope"), RiskHoldScope.WITHDRAWALS))
        .unique();

      if (!hold) return null;

      return {
        _id: hold._id,
        user_id: hold.user_id,
        scope: hold.scope,
        status: hold.status,
        reason: hold.reason,
        placed_by_admin_id: hold.placed_by_admin_id,
        placed_at: hold.placed_at,
      };
    },

    async create(hold: {
      user_id: UserId;
      scope: RiskHoldScope;
      status: RiskHoldStatus;
      reason: string;
      placed_by_admin_id: AdminUserId;
      placed_at: number;
    }): Promise<{ _id: UserRiskHoldId }> {
      const id = await ctx.db.insert(TABLE_NAMES.USER_RISK_HOLDS, {
        user_id: hold.user_id,
        scope: hold.scope,
        status: hold.status,
        reason: hold.reason,
        placed_by_admin_id: hold.placed_by_admin_id,
        placed_at: hold.placed_at,
      });
      return { _id: id };
    },

    async release(
      id: UserRiskHoldId,
      releasedByAdminId: AdminUserId,
      releasedAt: number,
    ): Promise<void> {
      await ctx.db.patch(id, {
        status: RiskHoldStatus.RELEASED,
        released_by_admin_id: releasedByAdminId,
        released_at: releasedAt,
      });
    },
  };
}

export function createConvexRiskEventService(
  ctx: MutationCtx,
): RiskEventService {
  return {
    async record(event: {
      userId: UserId;
      scope: RiskHoldScope;
      eventType: RiskEventType;
      severity: RiskSeverity;
      message: string;
      details?: Record<string, unknown>;
      actorAdminId?: AdminUserId;
    }): Promise<{ id: RiskEventId }> {
      const id = await ctx.db.insert(TABLE_NAMES.RISK_EVENTS, {
        user_id: event.userId,
        scope: event.scope,
        event_type: event.eventType,
        severity: event.severity,
        message: event.message,
        details: event.details,
        actor_admin_id: event.actorAdminId,
        created_at: Date.now(),
      });
      return { id };
    },
  };
}

export function createConvexRiskEventRepository(
  ctx: AnyCtx,
): RiskEventRepository {
  return {
    async findLatestByUserId(userId: UserId): Promise<{
      event_type: RiskEventType;
      severity: RiskSeverity;
      message: string;
      created_at: number;
    } | null> {
      const events = await ctx.db
        .query(TABLE_NAMES.RISK_EVENTS)
        .withIndex("by_user_id", (q) => q.eq("user_id", userId))
        .order("desc")
        .take(1);

      if (events.length === 0) return null;

      return {
        event_type: events[0].event_type,
        severity: events[0].severity,
        message: events[0].message,
        created_at: events[0].created_at,
      };
    },
  };
}

export function createConvexBankAccountEventRepository(
  ctx: AnyCtx,
): BankAccountEventRepository {
  return {
    async getLastBankAccountChangeAt(
      userId: UserId,
    ): Promise<number | undefined> {
      const latestEvent = await ctx.db
        .query(TABLE_NAMES.USER_BANK_ACCOUNT_EVENTS)
        .withIndex("by_user_id", (q) => q.eq("user_id", userId))
        .order("desc")
        .filter((q) =>
          q.or(
            q.eq(q.field("event_type"), BankAccountEventType.CREATED),
            q.eq(q.field("event_type"), BankAccountEventType.UPDATED),
            q.eq(q.field("event_type"), BankAccountEventType.SET_PRIMARY),
          ),
        )
        .first();

      return latestEvent?.created_at;
    },
  };
}
