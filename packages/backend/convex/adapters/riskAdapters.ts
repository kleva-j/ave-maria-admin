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

import type { MutationCtx } from "../_generated/server";
import type { RiskEventType, RiskSeverity } from "../shared";
import type {
  Context,
  UserRiskHoldId,
  UserRiskHold,
  AdminUserId,
  RiskEventId,
  UserId,
} from "../types";

import { DomainError } from "@avm-daily/domain";
import {
  BankAccountEventType,
  RiskHoldStatus,
  RiskHoldScope,
  TABLE_NAMES,
} from "../shared";

function activeWithdrawalHoldQuery(ctx: Context, userId: UserId) {
  return ctx.db
    .query(TABLE_NAMES.USER_RISK_HOLDS)
    .withIndex("by_user_id_and_status", (q) =>
      q.eq("user_id", userId).eq("status", RiskHoldStatus.ACTIVE),
    )
    .filter((q) => q.eq(q.field("scope"), RiskHoldScope.WITHDRAWALS));
}

function assertSingleActiveWithdrawalHold(
  userId: UserId,
  holds: UserRiskHold[],
): void {
  if (holds.length > 1) {
    throw new DomainError(
      `Multiple active withdrawal holds found for user ${String(userId)}`,
      "risk_hold_invariant_violation",
    );
  }
}

function getInsertDb(ctx: Context): Pick<MutationCtx["db"], "insert"> {
  const mutationDb = ctx.db as Partial<MutationCtx["db"]>;

  if (typeof mutationDb.insert !== "function") {
    throw new DomainError(
      "Risk hold mutations require a mutation context",
      "risk_hold_mutation_context_required",
    );
  }

  return mutationDb as Pick<MutationCtx["db"], "insert">;
}

function getPatchDb(ctx: Context): Pick<MutationCtx["db"], "patch"> {
  const mutationDb = ctx.db as Partial<MutationCtx["db"]>;

  if (typeof mutationDb.patch !== "function") {
    throw new DomainError(
      "Risk hold mutations require a mutation context",
      "risk_hold_mutation_context_required",
    );
  }

  return mutationDb as Pick<MutationCtx["db"], "patch">;
}

export function createConvexRiskHoldRepository(
  ctx: Context,
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
      const hold = await activeWithdrawalHoldQuery(ctx, userId).first();

      if (!hold) return null;

      const matchingHolds = await activeWithdrawalHoldQuery(ctx, userId).take(
        2,
      );
      assertSingleActiveWithdrawalHold(userId, matchingHolds);

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
      const mutationDb = getInsertDb(ctx);

      if (
        hold.status === RiskHoldStatus.ACTIVE &&
        hold.scope === RiskHoldScope.WITHDRAWALS
      ) {
        const matchingHolds = await activeWithdrawalHoldQuery(
          ctx,
          hold.user_id,
        ).take(2);
        assertSingleActiveWithdrawalHold(hold.user_id, matchingHolds);

        if (matchingHolds.length === 1) {
          throw new DomainError(
            `User already has an active withdrawal hold: ${String(hold.user_id)}`,
            "hold_already_active",
          );
        }
      }

      const id = await mutationDb.insert(TABLE_NAMES.USER_RISK_HOLDS, {
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
      const mutationDb = getPatchDb(ctx);

      await mutationDb.patch(id, {
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
      createdAt?: number;
    }): Promise<{ id: RiskEventId }> {
      const id = await ctx.db.insert(TABLE_NAMES.RISK_EVENTS, {
        user_id: event.userId,
        scope: event.scope,
        event_type: event.eventType,
        severity: event.severity,
        message: event.message,
        details: event.details,
        actor_admin_id: event.actorAdminId,
        created_at: event.createdAt ?? Date.now(),
      });
      return { id };
    },
  };
}

export function createConvexRiskEventRepository(
  ctx: Context,
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
        .withIndex("by_user_id_and_created_at", (q) =>
          q.eq("user_id", userId),
        )
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
  ctx: Context,
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
