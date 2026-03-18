import { defineTable } from "convex/server";

import { kycStatus } from "../shared";
import { v } from "convex/values";

export const kyc_documents = defineTable({
  user_id: v.id("users"),
  document_type: v.string(),
  file_url: v.optional(v.string()),
  status: kycStatus,
  reviewed_by: v.optional(v.id("admin_users")),
  reviewed_at: v.optional(v.number()),
  rejection_reason: v.optional(v.string()),
  created_at: v.number(),
})
  .index("by_user_id", ["user_id"])
  .index("by_status", ["status"])
  .index("by_user_id_and_status", ["user_id", "status"])
  .index("by_reviewed_by", ["reviewed_by"]);
