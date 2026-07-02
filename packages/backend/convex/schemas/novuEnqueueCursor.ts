import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Single-row watermark for the Novu delivery enqueue sweep.
 *
 * The enqueue step drains notification_events ascending by occurred_at from
 * this watermark, so a backlog larger than one sweep's page is drained
 * deterministically across sweeps instead of relying on a fixed-size head
 * sample (which could permanently skip older user-facing events when the
 * outbox is dominated by other event types).
 *
 * There is exactly one row. `last_occurred_at` is the occurred_at of the most
 * recently scanned event; the next sweep resumes at `>= last_occurred_at`
 * (inclusive, so same-millisecond ties are never skipped — the delivery
 * ledger's by_event_id read-before-write makes the small overlap idempotent).
 */
export const novu_enqueue_cursor = defineTable({
  last_occurred_at: v.number(),
  updated_at: v.number(),
});
