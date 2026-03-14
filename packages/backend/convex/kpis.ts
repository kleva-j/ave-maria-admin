import type { UserStatus, PlanStatus } from "./schema";

import { v } from "convex/values";

import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

import { isSameDay } from "date-fns";

const PAGE_SIZE = 500;

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

type PageResult<T> = {
  page: Array<T>;
  continueCursor: string;
  isDone: boolean;
};

type UserKpiItem = {
  total_balance_kobo: bigint;
  status: UserStatus;
};

type PlanKpiItem = {
  current_amount_kobo: bigint;
  status: PlanStatus;
};

// ---------------------------------------------------------------------------
// Internal queries — readable from actions without a transaction limit concern
// ---------------------------------------------------------------------------

export const _getUsersPage = internalQuery({
  args: {
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.object({
    page: v.array(
      v.object({
        total_balance_kobo: v.int64(),
        status: v.union(
          v.literal("active"),
          v.literal("pending_kyc"),
          v.literal("suspended"),
          v.literal("closed"),
        ),
      }),
    ),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("users")
      .paginate({ numItems: PAGE_SIZE, cursor: args.cursor });

    return {
      page: result.page.map((u) => ({
        total_balance_kobo: u.total_balance_kobo,
        status: u.status,
      })),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const _getPlansPage = internalQuery({
  args: {
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.object({
    page: v.array(
      v.object({
        current_amount_kobo: v.int64(),
        status: v.union(
          v.literal("active"),
          v.literal("paused"),
          v.literal("completed"),
          v.literal("expired"),
        ),
      }),
    ),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("user_savings_plans")
      .paginate({ numItems: PAGE_SIZE, cursor: args.cursor });

    return {
      page: result.page.map((p) => ({
        current_amount_kobo: p.current_amount_kobo,
        status: p.status,
      })),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

// ---------------------------------------------------------------------------
// Internal mutation — single upsert, no heavy reads
// ---------------------------------------------------------------------------

export const _setDashboardKpis = internalMutation({
  args: {
    total_aum_kobo: v.int64(),
    active_users: v.number(),
    active_plans: v.number(),
    total_savings_kobo: v.int64(),
    computed_at: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Query the most recent KPI row by computed_at descending.
    const existing = await ctx.db
      .query("mv_dashboard_kpis")
      .withIndex("by_computed_at")
      .order("desc")
      .first();

    if (!existing || !isSameDay(existing.computed_at, args.computed_at)) {
      // New day (or first run) — insert a fresh snapshot.
      await ctx.db.insert("mv_dashboard_kpis", args);
    } else {
      // Same day — update in place.
      await ctx.db.patch(existing._id, args);
    }
    return null;
  },
});

// ---------------------------------------------------------------------------
// Internal action — orchestrates reads then writes; called from cron
// ---------------------------------------------------------------------------

export const refreshDashboardKpis = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // --- Aggregate users ---
    let totalAumKobo = 0n;
    let activeUsers = 0;
    let userCursor: string | null = null;

    for (;;) {
      const result: PageResult<UserKpiItem> = await ctx.runQuery(internal.kpis._getUsersPage, {
        cursor: userCursor,
      });

      for (const user of result.page) {
        totalAumKobo += user.total_balance_kobo;
        if (user.status === "active") {
          activeUsers += 1;
        }
      }

      if (result.isDone) break;
      userCursor = result.continueCursor;
    }

    // --- Aggregate savings plans ---
    let totalSavingsKobo = 0n;
    let activePlans = 0;
    let planCursor: string | null = null;

    for (;;) {
      const result: PageResult<PlanKpiItem> = await ctx.runQuery(internal.kpis._getPlansPage, {
        cursor: planCursor,
      });

      for (const plan of result.page) {
        totalSavingsKobo += plan.current_amount_kobo;
        if (plan.status === "active") {
          activePlans += 1;
        }
      }

      if (result.isDone) break;
      planCursor = result.continueCursor;
    }

    // --- Write results ---
    await ctx.runMutation(internal.kpis._setDashboardKpis, {
      total_aum_kobo: totalAumKobo,
      active_users: activeUsers,
      active_plans: activePlans,
      total_savings_kobo: totalSavingsKobo,
      computed_at: Date.now(),
    });

    return null;
  },
});
