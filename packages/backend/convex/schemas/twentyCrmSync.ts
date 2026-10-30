import { defineTable } from "convex/server";
import { v } from "convex/values";

export const twentyCrmEntityType = v.union(
  v.literal("person"),
  v.literal("withdrawal"),
  v.literal("kyc_document"),
  v.literal("risk_hold"),
  v.literal("savings_plan"),
  v.literal("bank_account"),
  v.literal("transaction"),
);

export const twentyCrmOutboxStatus = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("retry"),
  v.literal("failed"),
  v.literal("delivered"),
);

export const twenty_crm_outbox = defineTable({
  entity_type: twentyCrmEntityType,
  entity_id: v.string(),
  operation: v.union(v.literal("upsert"), v.literal("delete")),
  revision: v.number(),
  status: twentyCrmOutboxStatus,
  attempt_count: v.number(),
  next_attempt_at: v.number(),
  lease_token: v.optional(v.string()),
  lease_expires_at: v.optional(v.number()),
  last_error: v.optional(v.string()),
  created_at: v.number(),
  updated_at: v.number(),
  delivered_at: v.optional(v.number()),
})
  .index("by_entity_type_and_entity_id", ["entity_type", "entity_id"])
  .index("by_status_and_next_attempt_at", ["status", "next_attempt_at"])
  .index("by_status_and_created_at", ["status", "created_at"])
  .index("by_status_and_lease_expires_at", ["status", "lease_expires_at"]);

export const twenty_crm_record_links = defineTable({
  entity_type: twentyCrmEntityType,
  entity_id: v.string(),
  twenty_record_id: v.string(),
  synced_at: v.number(),
})
  .index("by_entity_type_and_entity_id", ["entity_type", "entity_id"])
  .index("by_entity_type_and_twenty_record_id", [
    "entity_type",
    "twenty_record_id",
  ]);
