import { defineTable } from "convex/server";
import { v } from "convex/values";

import { withdrawalMethod, withdrawalStatus } from "../shared";

export const withdrawals = defineTable({
  transaction_id: v.id("transactions"),
  requested_amount_kobo: v.int64(),
  method: v.optional(withdrawalMethod),
  status: withdrawalStatus,
  requested_at: v.number(),
  approved_by: v.optional(v.id("admin_users")),
  approved_at: v.optional(v.number()),
  rejection_reason: v.optional(v.string()),
  bank_account_details: v.optional(v.any()),
  cash_details: v.optional(v.any()),
})
  .index("by_transaction_id", ["transaction_id"])
  .index("by_status", ["status"])
  .index("by_requested_at", ["requested_at"])
  .index("by_approved_by", ["approved_by"]);
