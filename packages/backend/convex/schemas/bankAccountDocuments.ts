import { defineTable } from "convex/server";
import { v } from "convex/values";

import { bankAccountDocumentType, kycStatus } from "../shared";

export const bank_account_documents = defineTable({
  user_id: v.id("users"),
  account_id: v.id("user_bank_accounts"),
  document_type: bankAccountDocumentType,
  storage_id: v.id("_storage"), // Convex file storage ID
  file_name: v.string(), // Original file name
  file_size: v.number(), // Size in bytes
  mime_type: v.string(), // File MIME type
  status: kycStatus, // pending, approved, rejected
  uploaded_at: v.number(),
  reviewed_by: v.optional(v.id("admin_users")),
  reviewed_at: v.optional(v.number()),
  rejection_reason: v.optional(v.string()),
})
  .index("by_user_id", ["user_id"])
  .index("by_account_id", ["account_id"])
  .index("by_status", ["status"])
  .index("by_user_id_and_status", ["user_id", "status"])
  .index("by_account_id_and_status", ["account_id", "status"])
  .index("by_reviewed_by", ["reviewed_by"]);
