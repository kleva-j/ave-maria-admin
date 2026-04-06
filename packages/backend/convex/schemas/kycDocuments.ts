import { defineTable } from "convex/server";
import { v } from "convex/values";

import { bankAccountDocumentType, kycStatus } from "../shared";

export const kyc_documents = defineTable({
  user_id: v.id("users"),
  document_type: bankAccountDocumentType,
  file_url: v.optional(v.string()),
  storage_id: v.optional(v.id("_storage")),
  file_name: v.optional(v.string()),
  file_size: v.optional(v.number()),
  mime_type: v.optional(v.string()),
  uploaded_at: v.optional(v.number()),
  status: kycStatus,
  reviewed_by: v.optional(v.id("admin_users")),
  reviewed_at: v.optional(v.number()),
  rejection_reason: v.optional(v.string()),
  supersedes_document_id: v.optional(v.id("kyc_documents")),
  created_at: v.number(),
})
  .index("by_user_id", ["user_id"])
  .index("by_status", ["status"])
  .index("by_status_and_created_at", ["status", "created_at"])
  .index("by_user_id_and_status", ["user_id", "status"])
  .index("by_reviewed_by", ["reviewed_by"]);
