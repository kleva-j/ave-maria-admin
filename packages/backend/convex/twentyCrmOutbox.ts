import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { Infer } from "convex/values";

import { internal } from "./_generated/api";
import { twentyCrmEntityType } from "./schemas/twentyCrmSync";

export type TwentyCrmEntityType = Infer<typeof twentyCrmEntityType>;
export type TwentyCrmOutboxId = Id<"twenty_crm_outbox">;

/**
 * Coalesces a source-record change into a durable outbox row. The payload is
 * intentionally not copied into the queue; delivery reads the current,
 * allow-listed source fields when the worker runs.
 */
export async function enqueueTwentyCrmRecord(
  ctx: MutationCtx,
  entityType: TwentyCrmEntityType,
  entityId: string,
  operation: "upsert" | "delete" = "upsert",
): Promise<void> {
  const now = Date.now();
  const existing = await ctx.db
    .query("twenty_crm_outbox")
    .withIndex("by_entity_type_and_entity_id", (q) =>
      q.eq("entity_type", entityType).eq("entity_id", entityId),
    )
    .unique();

  let outboxId: TwentyCrmOutboxId;
  if (existing) {
    const hasActiveLease =
      existing.status === "processing" &&
      (existing.lease_expires_at ?? 0) > now;
    await ctx.db.patch("twenty_crm_outbox", existing._id, {
      operation,
      revision: existing.revision + 1,
      status: hasActiveLease ? "processing" : "pending",
      attempt_count: hasActiveLease ? existing.attempt_count : 0,
      next_attempt_at: hasActiveLease ? existing.next_attempt_at : now,
      lease_token: hasActiveLease ? existing.lease_token : undefined,
      lease_expires_at: hasActiveLease ? existing.lease_expires_at : undefined,
      last_error: undefined,
      delivered_at: undefined,
      updated_at: now,
    });
    outboxId = existing._id;
  } else {
    outboxId = await ctx.db.insert("twenty_crm_outbox", {
      entity_type: entityType,
      entity_id: entityId,
      operation,
      revision: 1,
      status: "pending",
      attempt_count: 0,
      next_attempt_at: now,
      created_at: now,
      updated_at: now,
    });
  }

  await ctx.scheduler.runAfter(0, internal.twentySync.deliver, { outboxId });
}
