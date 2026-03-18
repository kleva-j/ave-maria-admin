import { defineTable } from "convex/server";
import { v } from "convex/values";

import { commentType, kycStatus } from "../shared";

/**
 * Document Comments/Reviews Table
 *
 * Allows admins to add detailed reviews and comments to uploaded documents.
 * Supports:
 * - Multiple comments per document (threaded discussions)
 * - Comment types (general, issue, approval_note)
 * - Internal vs visible comments (visible can be shown to users)
 * - Edit history tracking
 */
export const bank_account_document_comments = defineTable({
  user_id: v.id("users"), // Document owner
  account_id: v.id("user_bank_accounts"),
  document_id: v.id("bank_account_documents"),
  admin_id: v.id("admin_users"), // Comment author

  // Comment content
  comment_type: commentType,

  content: v.string(), // Comment text (markdown supported)
  is_internal: v.boolean(), // If true, only visible to admins

  // Status tracking
  status: kycStatus, // Can be used to mark issues as resolved
  resolved_at: v.optional(v.number()),
  resolved_by: v.optional(v.id("admin_users")),

  // Metadata
  parent_comment_id: v.optional(v.id("bank_account_document_comments")), // For threaded replies
  edited_at: v.optional(v.number()),
  created_at: v.number(),
})
  .index("by_document_id", ["document_id"])
  .index("by_account_id", ["account_id"])
  .index("by_admin_id", ["admin_id"])
  .index("by_document_id_and_created_at", ["document_id", "created_at"])
  .index("by_status", ["status"])
  .index("by_parent_comment_id", ["parent_comment_id"]);
