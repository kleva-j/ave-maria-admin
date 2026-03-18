import { defineTable } from "convex/server";
import { v } from "convex/values";

export const admin_dashboard_kpis = defineTable({
  total_aum_kobo: v.int64(),
  active_users: v.number(),
  active_plans: v.number(),
  total_savings_kobo: v.int64(),
  computed_at: v.number(),
}).index("by_computed_at", ["computed_at"]);
