import { defineTable } from "convex/server";
import { v } from "convex/values";

import { planStatus } from "../shared";

export const user_savings_plans = defineTable({
  user_id: v.id("users"),
  template_id: v.id("savings_plan_templates"),
  custom_target_kobo: v.int64(),
  current_amount_kobo: v.int64(),
  start_date: v.string(),
  end_date: v.string(),
  status: planStatus,
  automation_enabled: v.boolean(),
  metadata: v.optional(v.any()),
  created_at: v.number(),
  updated_at: v.number(),
})
  .index("by_user_id", ["user_id"])
  .index("by_user_id_and_status", ["user_id", "status"])
  .index("by_user_id_and_template_id", ["user_id", "template_id"])
  .index("by_template_id", ["template_id"])
  .index("by_status", ["status"])
  .index("by_end_date", ["end_date"]);
