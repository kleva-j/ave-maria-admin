import { deliveryMethod, deliveryStatus, notificationType } from "../shared";

import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Document Review Notifications Table
 *
 * Tracks notifications sent to users about document reviews.
 * Can be extended to support email, push, SMS notifications.
 */
export const document_review_notifications = defineTable({
  user_id: v.id("users"),
  account_id: v.id("user_bank_accounts"),
  document_id: v.id("bank_account_documents"),
  comment_id: v.optional(v.id("bank_account_document_comments")),

  // Notification type
  notification_type: notificationType,

  // Delivery tracking
  delivery_status: deliveryStatus,

  delivery_method: deliveryMethod,

  // Content
  title: v.string(),
  message: v.string(),
  metadata: v.optional(v.any()),

  // Timestamps
  sent_at: v.optional(v.number()),
  created_at: v.number(),
})
  .index("by_user_id", ["user_id"])
  .index("by_account_id", ["account_id"])
  .index("by_document_id", ["document_id"])
  .index("by_delivery_status", ["delivery_status"])
  .index("by_created_at", ["created_at"]);
