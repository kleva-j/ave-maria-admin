/**
 * Novu in-app notification dispatch for END USERS.
 *
 * Second consumer of the notification_events outbox (the first is the
 * admin-alert sweep in adminAlerts.ts). This module never touches that sweep
 * or the events' processing_status — it maintains its own delivery ledger
 * (user_notification_deliveries) with independent status + retry.
 *
 * Pipeline (driven by a 60s cron → `sweep`):
 *   1. _enqueueUserDeliveries — scan recent user-facing events, fan out one
 *      delivery row per event (idempotent via the unique by_event_id index),
 *      denormalizing everything the action needs (subscriberId, first_name,
 *      workflow_id, template payload).
 *   2. _listPendingDeliveries — due pending rows.
 *   3. sweep dispatches each to Novu via fetch, marks sent/failed.
 *
 * All of it is a silent no-op when NOVU_SECRET_KEY is unset.
 *
 * fetch() is available in the Convex default runtime — no "use node" needed,
 * which lets the query/mutation exports live in the same file as the action.
 */
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";

import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { NotificationEventType, NovuDeliveryStatus, TABLE_NAMES } from "./shared";
import { internal } from "./_generated/api";
import { getUser } from "./utils";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** The 7 outcome events that produce a user notification. */
const USER_FACING_EVENT_TYPES = new Set<string>([
  NotificationEventType.WITHDRAWAL_APPROVED,
  NotificationEventType.WITHDRAWAL_REJECTED,
  NotificationEventType.WITHDRAWAL_PROCESSED,
  NotificationEventType.WITHDRAWAL_PROCESSING_FAILED,
  NotificationEventType.KYC_DECISION_APPLIED,
  NotificationEventType.BANK_VERIFICATION_APPROVED,
  NotificationEventType.BANK_VERIFICATION_REJECTED,
]);

/**
 * Novu workflow trigger identifier per event type. These MUST match the
 * workflow IDs created in the Novu dashboard (kebab-case of the event type).
 */
function workflowIdFor(eventType: string): string {
  return eventType.replace(/_/g, "-");
}

const ENQUEUE_SCAN_LIMIT = 200;
const DISPATCH_BATCH = 50;
const MAX_ATTEMPTS = 5;
const RETRY_BACKOFF_MS = 60_000;
const MAX_RETRY_BACKOFF_MS = 30 * 60_000;

// ---------------------------------------------------------------------------
// HMAC (Web Crypto — available in the Convex default runtime)
// ---------------------------------------------------------------------------

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// Public query: inbox auth for the <Inbox/> component
// ---------------------------------------------------------------------------

/**
 * Returns the secure-mode credentials the Novu <Inbox/> needs.
 * subscriberId = the caller's Convex users._id; subscriberHash = HMAC of it
 * keyed by NOVU_SECRET_KEY, computed server-side so the secret never ships.
 *
 * The client supplies applicationIdentifier itself (public VITE/EXPO env).
 * Returns null when Novu is not configured so the client can hide the bell.
 */
export const getNovuInboxAuth = query({
  args: {},
  returns: v.union(
    v.object({ subscriberId: v.string(), subscriberHash: v.string() }),
    v.null(),
  ),
  handler: async (ctx) => {
    const user = await getUser(ctx);
    const secret = process.env.NOVU_SECRET_KEY;
    if (!secret) return null;
    const subscriberId = String(user._id);
    const subscriberHash = await hmacSha256Hex(secret, subscriberId);
    return { subscriberId, subscriberHash };
  },
});

// ---------------------------------------------------------------------------
// Internal: enqueue deliveries from recent events
// ---------------------------------------------------------------------------

function buildTemplatePayload(
  event: Doc<"notification_events">,
  withdrawal: Doc<"withdrawals"> | null,
): Record<string, unknown> {
  const p = (event.payload ?? {}) as Record<string, unknown>;
  switch (event.event_type) {
    case NotificationEventType.WITHDRAWAL_APPROVED:
    case NotificationEventType.WITHDRAWAL_REJECTED:
    case NotificationEventType.WITHDRAWAL_PROCESSED:
    case NotificationEventType.WITHDRAWAL_PROCESSING_FAILED:
      return {
        status: p.status ?? withdrawal?.status,
        // amount as string — kobo is int64 (bigint) and not JSON-serializable.
        amount_kobo:
          withdrawal != null ? String(withdrawal.requested_amount_kobo) : null,
        reference: withdrawal?.reference ?? null,
        path: `/withdrawals/${String(p.withdrawal_id ?? "")}`,
      };
    case NotificationEventType.KYC_DECISION_APPLIED:
      return {
        approved: p.approved ?? null,
        new_status: p.new_status ?? null,
        path: "/kyc",
      };
    case NotificationEventType.BANK_VERIFICATION_APPROVED:
      return { path: "/bank-accounts" };
    case NotificationEventType.BANK_VERIFICATION_REJECTED:
      return {
        rejection_reason: p.rejection_reason ?? null,
        path: "/bank-accounts",
      };
    default:
      return { path: "/" };
  }
}

export const _enqueueUserDeliveries = internalMutation({
  args: {},
  returns: v.object({ enqueued: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();

    // Drain deterministically from a watermark instead of head-sampling the
    // most recent N events (which could permanently skip older user-facing
    // events when the outbox is dominated by other types). Resume at
    // occurred_at >= watermark (inclusive): same-millisecond ties are never
    // skipped, and the by_event_id read-before-write below makes the small
    // re-scan overlap idempotent.
    const cursor = await ctx.db
      .query(TABLE_NAMES.NOVU_ENQUEUE_CURSOR)
      .first();
    const watermark = cursor?.last_occurred_at ?? 0;

    const batch = await ctx.db
      .query(TABLE_NAMES.NOTIFICATION_EVENTS)
      .withIndex("by_occurred_at", (q) => q.gte("occurred_at", watermark))
      .order("asc")
      .take(ENQUEUE_SCAN_LIMIT);

    let enqueued = 0;
    let maxOccurredAt = watermark;
    for (const event of batch) {
      if (event.occurred_at > maxOccurredAt) maxOccurredAt = event.occurred_at;
      if (!USER_FACING_EVENT_TYPES.has(event.event_type)) continue;

      const existing = await ctx.db
        .query(TABLE_NAMES.USER_NOTIFICATION_DELIVERIES)
        .withIndex("by_event_id", (q) => q.eq("event_id", event._id))
        .unique();
      if (existing) continue;

      const payload = (event.payload ?? {}) as Record<string, unknown>;
      const rawUserId = payload.user_id;
      if (typeof rawUserId !== "string") continue; // unresolvable → skip silently

      const userId = rawUserId as Id<"users">;
      const user = await ctx.db.get(userId);

      // Withdrawal display fields (amount/reference) aren't in the event
      // payload — read the doc to enrich the Novu template.
      let withdrawal: Doc<"withdrawals"> | null = null;
      const withdrawalId = payload.withdrawal_id;
      if (typeof withdrawalId === "string") {
        withdrawal = await ctx.db.get(withdrawalId as Id<"withdrawals">);
      }

      await ctx.db.insert(TABLE_NAMES.USER_NOTIFICATION_DELIVERIES, {
        event_id: event._id,
        user_id: userId,
        subscriber_first_name: user?.first_name ?? "",
        workflow_id: workflowIdFor(event.event_type),
        payload: buildTemplatePayload(event, withdrawal),
        // No user row → nothing to notify; record as skipped so we don't rescan.
        novu_status: user
          ? NovuDeliveryStatus.PENDING
          : NovuDeliveryStatus.SKIPPED,
        attempt_count: 0,
        next_attempt_at: now,
        last_error: user ? undefined : "user not found",
        created_at: now,
      });
      enqueued++;
    }

    // Advance the watermark to the newest occurred_at scanned this batch, so
    // the next sweep resumes past it. Only moves forward.
    if (maxOccurredAt > watermark) {
      if (cursor) {
        await ctx.db.patch(cursor._id, {
          last_occurred_at: maxOccurredAt,
          updated_at: now,
        });
      } else {
        await ctx.db.insert(TABLE_NAMES.NOVU_ENQUEUE_CURSOR, {
          last_occurred_at: maxOccurredAt,
          updated_at: now,
        });
      }
    }

    return { enqueued };
  },
});

// ---------------------------------------------------------------------------
// Internal: list + mark
// ---------------------------------------------------------------------------

export const _listPendingDeliveries = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args): Promise<Doc<"user_notification_deliveries">[]> => {
    const now = Date.now();
    return await ctx.db
      .query(TABLE_NAMES.USER_NOTIFICATION_DELIVERIES)
      .withIndex("by_novu_status_and_next_attempt_at", (q) =>
        q.eq("novu_status", NovuDeliveryStatus.PENDING).lte("next_attempt_at", now),
      )
      .take(args.limit);
  },
});

export const _markDeliverySent = internalMutation({
  args: {
    id: v.id("user_notification_deliveries"),
    transactionId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      novu_status: NovuDeliveryStatus.SENT,
      novu_transaction_id: args.transactionId,
      sent_at: Date.now(),
      last_error: undefined,
    });
    return null;
  },
});

export const _markDeliveryFailed = internalMutation({
  args: { id: v.id("user_notification_deliveries"), error: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row) return null;
    const attempt = row.attempt_count + 1;
    const exhausted = attempt >= MAX_ATTEMPTS;
    // Exponential backoff (capped) so retries don't hammer Novu during an
    // extended outage: 1m, 2m, 4m, 8m, … capped at 30m.
    const backoff = Math.min(
      RETRY_BACKOFF_MS * 2 ** (attempt - 1),
      MAX_RETRY_BACKOFF_MS,
    );
    await ctx.db.patch(args.id, {
      attempt_count: attempt,
      novu_status: exhausted
        ? NovuDeliveryStatus.FAILED
        : NovuDeliveryStatus.PENDING,
      next_attempt_at: Date.now() + backoff,
      last_error: args.error,
    });
    return null;
  },
});

// ---------------------------------------------------------------------------
// Cron entrypoint: enqueue + dispatch
// ---------------------------------------------------------------------------

export const sweep = internalAction({
  args: {},
  returns: v.object({
    enqueued: v.number(),
    dispatched: v.number(),
    failed: v.number(),
  }),
  handler: async (
    ctx,
  ): Promise<{ enqueued: number; dispatched: number; failed: number }> => {
    const secret = process.env.NOVU_SECRET_KEY;
    if (!secret) {
      console.log("[novu] NOVU_SECRET_KEY not set — skipping user notification sweep.");
      return { enqueued: 0, dispatched: 0, failed: 0 };
    }

    const { enqueued }: { enqueued: number } = await ctx.runMutation(
      internal.userNotifications._enqueueUserDeliveries,
      {},
    );

    const pending: Doc<"user_notification_deliveries">[] = await ctx.runQuery(
      internal.userNotifications._listPendingDeliveries,
      { limit: DISPATCH_BATCH },
    );

    const apiUrl = process.env.NOVU_API_URL ?? "https://api.novu.co";
    let dispatched = 0;
    let failed = 0;

    for (const d of pending) {
      try {
        const resp = await fetch(`${apiUrl}/v1/events/trigger`, {
          method: "POST",
          headers: {
            Authorization: `ApiKey ${secret}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: d.workflow_id,
            to: {
              subscriberId: String(d.user_id),
              firstName: d.subscriber_first_name || undefined,
            },
            payload: d.payload,
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!resp.ok) {
          // Capture a truncated body so failures (invalid workflow id, auth,
          // validation) are diagnosable from last_error without reproducing.
          const detail = (await resp.text().catch(() => "")).slice(0, 500);
          throw new Error(
            `Novu trigger failed (HTTP ${resp.status})${detail ? `: ${detail}` : ""}`,
          );
        }
        const body = (await resp.json().catch(() => ({}))) as {
          data?: { transactionId?: string };
        };
        await ctx.runMutation(internal.userNotifications._markDeliverySent, {
          id: d._id,
          transactionId: body.data?.transactionId,
        });
        dispatched++;
      } catch (err) {
        await ctx.runMutation(internal.userNotifications._markDeliveryFailed, {
          id: d._id,
          error: err instanceof Error ? err.message : String(err),
        });
        failed++;
      }
    }

    return { enqueued, dispatched, failed };
  },
});
