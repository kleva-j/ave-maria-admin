import { defineTable } from "convex/server";
import { v } from "convex/values";

export const savings_plan_templates = defineTable({
  name: v.string(),
  description: v.optional(v.string()),
  default_target_kobo: v.int64(),
  duration_days: v.number(),
  interest_rate: v.number(),
  automation_type: v.optional(v.string()),
  is_active: v.boolean(),
  created_at: v.number(),
})
  .index("by_name", ["name"])
  .index("by_is_active", ["is_active"])
  .index("by_is_active_and_created_at", ["is_active", "created_at"]);
