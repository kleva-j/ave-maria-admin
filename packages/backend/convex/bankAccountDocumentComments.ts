/**
 * Bank Account Document Comments Module
 *
 * Enables admin reviewers to add detailed comments and reviews to uploaded documents.
 * Features:
 * - Threaded comments (replies to existing comments)
 * - Comment types (general, issue, approval_note, rejection_reason)
 * - Internal vs user-visible comments
 * - Issue resolution tracking
 * - Full audit trail
 *
 * Use Cases:
 * - Admin reviewers can discuss document quality/issues
 * - Add specific feedback for users (visible comments)
 * - Track issues that need resolution before approval
 * - Document approval/rejection rationale
 */
import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getAdminUser, getUser } from "./utils";
import { auditLog } from "./auditLog";
import {
  KYC_VERIFICATION_STATUS,
  RESOURCE_TYPE,
  COMMENT_TYPE,
  TABLE_NAMES,
  commentType,
  EVENT_TYPE,
} from "./shared";

// const COMMENT_TYPE = {
//   GENERAL: "general",
//   ISSUE: "issue",
//   APPROVAL_NOTE: "approval_note",
//   REJECTION_REASON: "rejection_reason",
// } as const;

// const commentType = v.union(
//   v.literal(COMMENT_TYPE.GENERAL),
//   v.literal(COMMENT_TYPE.ISSUE),
//   v.literal(COMMENT_TYPE.APPROVAL_NOTE),
//   v.literal(COMMENT_TYPE.REJECTION_REASON),
// );

// export type CommentType = typeof commentType.type;

/**
 * Add a comment to a document
 * Supports threaded discussions via parent_comment_id
 *
 * @param ctx - Mutation context
 * @param args - Mutation arguments
 * @param args.documentId - ID of the document to comment on
 * @param args.content - Comment text (markdown supported)
 * @param args.commentType - Type of comment (default: general)
 * @param args.isInternal - Whether comment is internal only (default: true)
 * @param args.parentCommentId - Optional parent comment for threading
 * @returns Created comment record
 */
export const addComment = mutation({
  args: {
    documentId: v.id("bank_account_documents"),
    content: v.string(),
    commentType: v.optional(commentType),
    isInternal: v.optional(v.boolean()),
    parentCommentId: v.optional(v.id("bank_account_document_comments")),
  },
  returns: v.object({
    _id: v.id("bank_account_document_comments"),
    document_id: v.id("bank_account_documents"),
    content: v.string(),
    comment_type: v.string(),
    is_internal: v.boolean(),
    created_at: v.number(),
    admin_id: v.id("admin_users"),
  }),
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);

    // Get document details
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // If replying to a parent comment, verify it exists and belongs to same document
    if (args.parentCommentId) {
      const parent = await ctx.db.get(args.parentCommentId);
      if (!parent || parent.document_id !== args.documentId) {
        throw new ConvexError("Invalid parent comment");
      }
    }

    const now = Date.now();
    const commentType = args.commentType ?? COMMENT_TYPE.GENERAL;
    const isInternal = args.isInternal ?? true;

    // Create comment
    const commentId = await ctx.db.insert(
      TABLE_NAMES.BANK_ACCOUNT_DOCUMENT_COMMENTS,
      {
        user_id: document.user_id,
        account_id: document.account_id,
        document_id: args.documentId,
        admin_id: admin._id,
        comment_type: commentType,
        content: args.content,
        is_internal: isInternal,
        status: KYC_VERIFICATION_STATUS.PENDING,
        parent_comment_id: args.parentCommentId,
        created_at: now,
      },
    );

    const comment = await ctx.db.get(commentId);
    if (!comment) {
      throw new ConvexError("Failed to create comment");
    }

    // Log to audit system
    await auditLog.log(ctx, {
      action: "bank_account.document_comment_added",
      actorId: admin._id,
      resourceType: RESOURCE_TYPE.BANK_ACCOUNT_DOCUMENT_COMMENT,
      resourceId: comment._id,
      severity: "info",
      metadata: {
        document_id: args.documentId,
        account_id: document.account_id,
        comment_type: commentType,
        is_internal: isInternal,
        has_parent: !!args.parentCommentId,
      },
    });

    // Log event for compliance trail
    await ctx.db.insert(TABLE_NAMES.USER_BANK_ACCOUNT_EVENTS, {
      user_id: document.user_id,
      account_id: document.account_id,
      event_type: EVENT_TYPE.DOCUMENT_COMMENT_ADDED,
      created_at: now,
      new_values: {
        comment_type: commentType,
        is_internal: isInternal,
        admin_id: admin._id,
      },
      actor_admin_id: admin._id,
    });

    return {
      _id: comment._id,
      document_id: comment.document_id,
      content: comment.content,
      comment_type: comment.comment_type,
      is_internal: comment.is_internal,
      created_at: comment.created_at,
      admin_id: comment.admin_id,
    };
  },
});

/**
 * List all comments for a document
 * Returns threaded structure with admin details
 *
 * @param ctx - Query context
 * @param args - Query arguments
 * @param args.documentId - ID of the document
 * @param args.includeInternal - Whether to include internal comments (admin only)
 * @returns Array of comments sorted by creation date
 */
export const listComments = query({
  args: {
    documentId: v.id("bank_account_documents"),
    includeInternal: v.optional(v.boolean()),
  },
  returns: v.array(
    v.object({
      _id: v.id("bank_account_document_comments"),
      document_id: v.id("bank_account_documents"),
      admin_id: v.id("admin_users"),
      comment_type: v.string(),
      content: v.string(),
      is_internal: v.boolean(),
      status: v.string(),
      parent_comment_id: v.optional(v.id("bank_account_document_comments")),
      resolved_at: v.optional(v.number()),
      resolved_by: v.optional(v.id("admin_users")),
      edited_at: v.optional(v.number()),
      created_at: v.number(),
      // Admin details
      admin: v.object({
        _id: v.id("admin_users"),
        first_name: v.string(),
        last_name: v.string(),
        email: v.string(),
        role: v.string(),
      }),
    }),
  ),
  handler: async (ctx, args) => {
    const viewer = await getUser(ctx).catch(() => null);
    const admin = await getAdminUser(ctx).catch(() => null);

    if (!viewer && !admin) {
      throw new ConvexError("Not authenticated");
    }

    // Get document to verify access
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // Users can only see non-internal comments on their own documents
    // Admins can see all comments
    const isOwner = viewer && document.user_id === viewer._id;
    const isAdmin = !!admin;

    if (!isOwner && !isAdmin) {
      throw new ConvexError("Not authorized to view these comments");
    }

    // Fetch comments
    const comments = await ctx.db
      .query(TABLE_NAMES.BANK_ACCOUNT_DOCUMENT_COMMENTS)
      .withIndex("by_document_id_and_created_at", (q) =>
        q.eq("document_id", args.documentId),
      )
      .collect();

    // Filter internal comments if not admin
    const visibleComments = comments.filter((comment) => {
      if (isAdmin) return true;
      return !comment.is_internal;
    });

    // Enrich with admin details
    const enriched = await Promise.all(
      visibleComments.map(async (comment) => {
        const adminUser = await ctx.db.get(comment.admin_id);
        if (!adminUser) {
          throw new ConvexError(
            `Admin ${comment.admin_id} not found for comment ${comment._id}`,
          );
        }

        return {
          ...comment,
          admin: {
            _id: adminUser._id,
            first_name: adminUser.first_name,
            last_name: adminUser.last_name,
            email: adminUser.email,
            role: adminUser.role,
          },
        };
      }),
    );

    // Sort by creation date
    enriched.sort((a, b) => a.created_at - b.created_at);

    return enriched;
  },
});

/**
 * Update a comment (edit content)
 * Only the original author can edit
 *
 * @param ctx - Mutation context
 * @param args - Mutation arguments
 * @param args.commentId - ID of the comment to update
 * @param args.content - New content
 * @returns Updated comment
 */
export const updateComment = mutation({
  args: {
    commentId: v.id("bank_account_document_comments"),
    content: v.string(),
  },
  returns: v.object({
    _id: v.id("bank_account_document_comments"),
    content: v.string(),
    edited_at: v.number(),
  }),
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);

    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new ConvexError("Comment not found");
    }

    // Only the author can edit
    if (comment.admin_id !== admin._id) {
      throw new ConvexError("Only the original author can edit this comment");
    }

    const now = Date.now();
    await ctx.db.patch(args.commentId, {
      content: args.content,
      edited_at: now,
    });

    const updated = await ctx.db.get(args.commentId);
    if (!updated) {
      throw new ConvexError("Failed to update comment");
    }

    return {
      _id: updated._id,
      content: updated.content,
      edited_at: updated.edited_at!,
    };
  },
});

/**
 * Resolve an issue comment
 * Marks the issue as resolved with optional resolution notes
 *
 * @param ctx - Mutation context
 * @param args - Mutation arguments
 * @param args.commentId - ID of the issue to resolve
 * @param args.resolutionNotes - Optional notes about the resolution
 * @returns Updated comment
 */
export const resolveIssue = mutation({
  args: {
    commentId: v.id("bank_account_document_comments"),
    resolutionNotes: v.optional(v.string()),
  },
  returns: v.object({
    _id: v.id("bank_account_document_comments"),
    status: v.string(),
    resolved_at: v.number(),
    resolved_by: v.id("admin_users"),
  }),
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);

    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new ConvexError("Comment not found");
    }

    if (comment.comment_type !== COMMENT_TYPE.ISSUE) {
      throw new ConvexError("Only issue comments can be resolved");
    }

    const now = Date.now();
    await ctx.db.patch(args.commentId, {
      status: KYC_VERIFICATION_STATUS.APPROVED,
      resolved_at: now,
      resolved_by: admin._id,
    });

    const updated = await ctx.db.get(args.commentId);
    if (!updated) {
      throw new ConvexError("Failed to resolve issue");
    }

    // Log event
    await ctx.db.insert(TABLE_NAMES.USER_BANK_ACCOUNT_EVENTS, {
      user_id: comment.user_id,
      account_id: comment.account_id,
      event_type: EVENT_TYPE.DOCUMENT_ISSUE_RESOLVED,
      created_at: now,
      new_values: {
        comment_id: args.commentId,
        resolved_by: admin._id,
        resolution_notes: args.resolutionNotes ?? null,
      },
      actor_admin_id: admin._id,
    });

    return {
      _id: updated._id,
      status: updated.status,
      resolved_at: updated.resolved_at!,
      resolved_by: updated.resolved_by!,
    };
  },
});

/**
 * Delete a comment
 * Only admins can delete, and only if no replies exist
 *
 * @param ctx - Mutation context
 * @param args - Mutation arguments
 * @param args.commentId - ID of the comment to delete
 * @returns null
 */
export const deleteComment = mutation({
  args: {
    commentId: v.id("bank_account_document_comments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);

    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new ConvexError("Comment not found");
    }

    // Check if comment has replies
    const replies = await ctx.db
      .query(TABLE_NAMES.BANK_ACCOUNT_DOCUMENT_COMMENTS)
      .withIndex("by_parent_comment_id", (q) =>
        q.eq("parent_comment_id", args.commentId),
      )
      .first();

    if (replies) {
      throw new ConvexError(
        "Cannot delete comment with replies. Please delete replies first.",
      );
    }

    // Delete the comment
    await ctx.db.delete(args.commentId);

    // Log deletion
    await auditLog.log(ctx, {
      action: "bank_account.document_comment_deleted",
      actorId: admin._id,
      resourceType: RESOURCE_TYPE.BANK_ACCOUNT_DOCUMENT_COMMENT,
      resourceId: args.commentId,
      severity: "warning",
      metadata: {
        document_id: comment.document_id,
        comment_type: comment.comment_type,
        was_internal: comment.is_internal,
      },
    });

    return null;
  },
});
