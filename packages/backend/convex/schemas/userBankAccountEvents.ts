import { defineTable } from "convex/server";
import { v } from "convex/values";

import { bankAccountEventType } from "../shared";

export const user_bank_account_events = defineTable({
  user_id: v.id("users"),
  account_id: v.id("user_bank_accounts"),
  event_type: bankAccountEventType,
  previous_values: v.optional(v.any()),
  new_values: v.optional(v.any()),
  actor_user_id: v.optional(v.id("users")),
  actor_admin_id: v.optional(v.id("admin_users")),
  created_at: v.number(),
})
  .index("by_user_id", ["user_id"])
  .index("by_account_id", ["account_id"])
  .index("by_event_type", ["event_type"]);
