import { defineTable } from "convex/server";
import { v } from "convex/values";

import { novuDeliveryStatus } from "../shared";

/**
 * Novu delivery ledger — the second consumer of the notification_events outbox.
 *
 * One row per (notification_event → user) fan-out. Owns its own status + retry
 * so Novu dispatch is fully independent of the admin-alert sweep that also
 * drains notification_events. The unique index on event_id makes enqueue
 * idempotent: a given event produces at most one delivery row.
 *
 * The dispatcher action has no db access, so every field it needs to call
 * Novu (subscriberId = user_id, first_name, workflow_id, payload) is
 * denormalized onto the row at enqueue time.
 */
export const user_notification_deliveries = defineTable({
  event_id: v.id("notification_events"),
  user_id: v.id("users"), // = Novu subscriberId
  subscriber_first_name: v.string(),
  workflow_id: v.string(), // Novu workflow trigger identifier
  payload: v.any(), // template vars (no BVN/NIN/account#/balance)
  novu_status: novuDeliveryStatus,
  novu_transaction_id: v.optional(v.string()),
  attempt_count: v.number(),
  next_attempt_at: v.number(),
  last_error: v.optional(v.string()),
  created_at: v.number(),
  sent_at: v.optional(v.number()),
})
  .index("by_event_id", ["event_id"])
  .index("by_novu_status_and_next_attempt_at", [
    "novu_status",
    "next_attempt_at",
  ]);
