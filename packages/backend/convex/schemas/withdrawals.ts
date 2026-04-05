import { defineTable } from "convex/server";
import { v } from "convex/values";

import { withdrawalMethod, withdrawalStatus } from "../shared";

export const withdrawals = defineTable({
  reference: v.optional(v.string()),
  transaction_id: v.optional(v.id("transactions")),
  reservation_id: v.optional(v.id("withdrawal_reservations")),
  requested_amount_kobo: v.int64(),
  method: v.optional(withdrawalMethod),
  status: withdrawalStatus,
  requested_at: v.number(),
  requested_by: v.id("users"),
  approved_by: v.optional(v.id("admin_users")),
  approved_at: v.optional(v.number()),
  processed_by: v.optional(v.id("admin_users")),
  processed_at: v.optional(v.number()),
  payout_provider: v.optional(v.string()),
  payout_reference: v.optional(v.string()),
  rejection_reason: v.optional(v.string()),
  last_processing_error: v.optional(v.string()),
  bank_account_details: v.optional(v.any()),
  cash_details: v.optional(v.any()),
})
  .index("by_transaction_id", ["transaction_id"])
  .index("by_reference", ["reference"])
  .index("by_reservation_id", ["reservation_id"])
  .index("by_requested_by", ["requested_by"])
  .index("by_requested_by_and_requested_at", ["requested_by", "requested_at"])
  .index("by_status", ["status"])
  .index("by_requested_at", ["requested_at"])
  .index("by_approved_by", ["approved_by"])
  .index("by_processed_by", ["processed_by"]);
