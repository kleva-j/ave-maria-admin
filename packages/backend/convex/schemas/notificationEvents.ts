import { defineTable } from "convex/server";
import { v } from "convex/values";

import {
  notificationEventProcessingStatus,
  notificationSourceKind,
  notificationEventType,
  resourceType,
} from "../shared";

export const notification_events = defineTable({
  event_type: notificationEventType,
  source_kind: notificationSourceKind,
  resource_type: resourceType,
  resource_id: v.string(),
  dedupe_key: v.string(),
  payload: v.any(),
  occurred_at: v.number(),
  processing_status: notificationEventProcessingStatus,
  attempt_count: v.number(),
  next_attempt_at: v.number(),
  last_error: v.optional(v.string()),
  processed_at: v.optional(v.number()),
})
  .index("by_processing_status_and_next_attempt_at", [
    "processing_status",
    "next_attempt_at",
  ])
  .index("by_dedupe_key", ["dedupe_key"])
  .index("by_occurred_at", ["occurred_at"]);
