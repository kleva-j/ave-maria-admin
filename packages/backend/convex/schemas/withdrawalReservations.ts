import { defineTable } from "convex/server";
import { v } from "convex/values";

import { withdrawalReservationStatus } from "../shared";

export const withdrawal_reservations = defineTable({
  withdrawal_id: v.id("withdrawals"),
  user_id: v.id("users"),
  amount_kobo: v.int64(),
  reference: v.string(),
  status: withdrawalReservationStatus,
  created_at: v.number(),
  released_at: v.optional(v.number()),
  consumed_at: v.optional(v.number()),
})
  .index("by_withdrawal_id", ["withdrawal_id"])
  .index("by_user_id", ["user_id"])
  .index("by_reference", ["reference"])
  .index("by_status", ["status"])
  .index("by_user_id_and_status", ["user_id", "status"]);
