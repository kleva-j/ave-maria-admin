import { defineTable } from "convex/server";
import { v } from "convex/values";

import { txnType } from "../shared";

export const transactions = defineTable({
  user_id: v.id("users"),
  user_plan_id: v.optional(v.id("user_savings_plans")),
  type: txnType,
  amount_kobo: v.int64(),
  reference: v.string(),
  reversal_of_transaction_id: v.optional(v.id("transactions")),
  reversal_of_reference: v.optional(v.string()),
  reversal_of_type: v.optional(txnType),
  metadata: v.optional(v.any()),
  created_at: v.number(),
})
  .index("by_user_id", ["user_id"])
  .index("by_user_plan_id", ["user_plan_id"])
  .index("by_created_at", ["created_at"])
  .index("by_reference", ["reference"])
  .index("by_type", ["type"])
  .index("by_type_and_created_at", ["type", "created_at"])
  .index("by_user_plan_id_and_created_at", ["user_plan_id", "created_at"])
  .index("by_reversal_of_transaction_id", ["reversal_of_transaction_id"])
  .index("by_user_id_and_created_at", ["user_id", "created_at"]);
