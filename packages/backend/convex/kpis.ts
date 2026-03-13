import { v } from "convex/values";

import { internalMutation } from "./_generated/server";

const PAGE_SIZE = 500;

export const refreshDashboardKpis = internalMutation({
  args: {},
  returns: v.object({
    total_aum_kobo: v.int64(),
    active_users: v.number(),
    active_plans: v.number(),
    total_savings_kobo: v.int64(),
    computed_at: v.number(),
  }),
  handler: async (ctx) => {
    let totalAumKobo = 0n;
    let activeUsers = 0;

    let cursor: string | null = null;
    for (;;) {
      const page = await ctx.db
        .query("users")
        .paginate({ numItems: PAGE_SIZE, cursor });

      for (const user of page.page) {
        totalAumKobo += user.total_balance_kobo;
        if (user.status === "active") {
          activeUsers += 1;
        }
      }

      if (page.isDone) break;
      cursor = page.continueCursor;
    }

    let totalSavingsKobo = 0n;
    let activePlans = 0;

    cursor = null;
    for (;;) {
      const page = await ctx.db
        .query("user_savings_plans")
        .paginate({ numItems: PAGE_SIZE, cursor });

      for (const plan of page.page) {
        totalSavingsKobo += plan.current_amount_kobo;
        if (plan.status === "active") {
          activePlans += 1;
        }
      }

      if (page.isDone) break;
      cursor = page.continueCursor;
    }

    const computedAt = Date.now();

    const existing = await ctx.db.query("mv_dashboard_kpis").collect();
    if (existing.length === 0) {
      await ctx.db.insert("mv_dashboard_kpis", {
        total_aum_kobo: totalAumKobo,
        active_users: activeUsers,
        active_plans: activePlans,
        total_savings_kobo: totalSavingsKobo,
        computed_at: computedAt,
      });
    } else {
      await ctx.db.patch(existing[0]._id, {
        total_aum_kobo: totalAumKobo,
        active_users: activeUsers,
        active_plans: activePlans,
        total_savings_kobo: totalSavingsKobo,
        computed_at: computedAt,
      });

      for (const extra of existing.slice(1)) {
        await ctx.db.delete(extra._id);
      }
    }

    return {
      total_aum_kobo: totalAumKobo,
      active_users: activeUsers,
      active_plans: activePlans,
      total_savings_kobo: totalSavingsKobo,
      computed_at: computedAt,
    };
  },
});
