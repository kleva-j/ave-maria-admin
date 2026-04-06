import { defineTable } from "convex/server";
import { v } from "convex/values";

import { adminAlertReceiptState } from "../shared";

export const admin_alert_receipts = defineTable({
  alert_id: v.id("admin_alerts"),
  admin_user_id: v.id("admin_users"),
  delivery_state: adminAlertReceiptState,
  delivered_at: v.number(),
  seen_at: v.optional(v.number()),
  acknowledged_at: v.optional(v.number()),
  last_notified_at: v.number(),
})
  .index("by_admin_user_id_and_delivery_state", [
    "admin_user_id",
    "delivery_state",
  ])
  .index("by_admin_user_id_and_delivered_at", [
    "admin_user_id",
    "delivered_at",
  ])
  .index("by_alert_id_and_admin_user_id", ["alert_id", "admin_user_id"]);
