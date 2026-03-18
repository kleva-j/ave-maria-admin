/**
 * Verification Queue Module
 *
 * Admin-facing features for reviewing bank account verification requests.
 * Features:
 * - Paginated queue of pending verifications
 * - Document preview access
 * - Account details with verification history
 * - Filtering and sorting options
 *
 * Access Control:
 * - All endpoints require admin authentication
 * - Documents are accessible via time-limited signed URLs
 */
import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getAdminUser } from "./utils";
import { auditLog } from "./auditLog";
import {
  KYC_VERIFICATION_STATUS,
  verificationStatus,
  VERIFICATION_STATUS,
  RESOURCE_TYPE,
  TABLE_NAMES,
  EVENT_TYPE,
} from "./shared";

const PAGE_SIZE = 50;

/**
 * List pending verification requests for admin review
 * Supports pagination and basic filtering
 *
 * @param ctx - Query context
 * @param args - Query arguments
 * @param args.cursor - Pagination cursor (optional)
 * @param args.status - Filter by verification status (default: pending)
 * @returns Paginated list of accounts pending verification
 */
export const listPendingVerifications = query({
  args: {
    cursor: v.union(v.string(), v.null()),
    status: v.optional(verificationStatus),
  },
  returns: v.object({
    accounts: v.array(
      v.object({
        _id: v.id("user_bank_accounts"),
        user_id: v.id("users"),
        bank_name: v.string(),
        account_number_last4: v.string(),
        account_name: v.optional(v.string()),
        is_primary: v.boolean(),
        verification_status: v.string(),
        verification_submitted_at: v.optional(v.number()),
        created_at: v.number(),
        updated_at: v.number(),
        // User details
        user: v.object({
          _id: v.id("users"),
          first_name: v.string(),
          last_name: v.string(),
          email: v.optional(v.string()),
          phone: v.string(),
        }),
        // Document count by type
        documentCount: v.number(),
      }),
    ),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await getAdminUser(ctx);

    const filterStatus = args.status ?? VERIFICATION_STATUS.PENDING;

    // Query accounts by verification status
    const result = await ctx.db
      .query(TABLE_NAMES.USER_BANK_ACCOUNTS)
      .withIndex("by_verification_status", (q) =>
        q.eq("verification_status", filterStatus),
      )
      .paginate({ numItems: PAGE_SIZE, cursor: args.cursor });

    // Enrich with user details and document counts
    const accounts = await Promise.all(
      result.page.map(async (account) => {
        const user = await ctx.db.get(account.user_id);
        if (!user) {
          throw new ConvexError(
            `User ${account.user_id} not found for account ${account._id}`,
          );
        }

        // Count documents for this account
        const documents = await ctx.db
          .query(TABLE_NAMES.BANK_ACCOUNT_DOCUMENTS)
          .withIndex("by_account_id", (q) => q.eq("account_id", account._id))
          .collect();

        return {
          _id: account._id,
          user_id: account.user_id,
          bank_name: account.bank_name,
          account_number_last4: account.account_number.slice(-4),
          account_name: account.account_name ?? undefined,
          is_primary: account.is_primary,
          verification_status: account.verification_status,
          verification_submitted_at: account.verification_submitted_at,
          created_at: account.created_at,
          updated_at: account.updated_at,
          user: {
            _id: user._id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email ?? undefined,
            phone: user.phone,
          },
          documentCount: documents.length,
        };
      }),
    );

    // Sort by submission date (oldest first for FIFO processing)
    accounts.sort((a, b) => {
      const aTime = a.verification_submitted_at ?? a.created_at;
      const bTime = b.verification_submitted_at ?? b.created_at;
      return aTime - bTime;
    });

    return {
      accounts,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/**
 * Get detailed verification information for a specific account
 * Includes all documents and their metadata
 *
 * @param ctx - Query context
 * @param args - Query arguments
 * @param args.accountId - ID of the account to review
 * @returns Complete verification details with documents
 */
export const getVerificationDetails = query({
  args: {
    accountId: v.id("user_bank_accounts"),
  },
  returns: v.object({
    account: v.object({
      _id: v.id("user_bank_accounts"),
      user_id: v.id("users"),
      bank_name: v.string(),
      account_number_last4: v.string(),
      account_name: v.optional(v.string()),
      is_primary: v.boolean(),
      verification_status: v.string(),
      verification_submitted_at: v.optional(v.number()),
      verified_at: v.optional(v.number()),
      rejection_reason: v.optional(v.string()),
      created_at: v.number(),
      updated_at: v.number(),
    }),
    user: v.object({
      _id: v.id("users"),
      first_name: v.string(),
      last_name: v.string(),
      email: v.optional(v.string()),
      phone: v.string(),
    }),
    documents: v.array(
      v.object({
        _id: v.id("bank_account_documents"),
        document_type: v.string(),
        file_name: v.string(),
        file_size: v.number(),
        mime_type: v.string(),
        status: v.string(),
        uploaded_at: v.number(),
        reviewed_by: v.optional(v.id("admin_users")),
        reviewed_at: v.optional(v.number()),
        rejection_reason: v.optional(v.string()),
        // Comments on this document
        comments: v.array(
          v.object({
            _id: v.id("bank_account_document_comments"),
            admin_id: v.id("admin_users"),
            comment_type: v.string(),
            content: v.string(),
            is_internal: v.boolean(),
            status: v.string(),
            resolved_at: v.optional(v.number()),
            resolved_by: v.optional(v.id("admin_users")),
            created_at: v.number(),
            admin: v.object({
              _id: v.id("admin_users"),
              first_name: v.string(),
              last_name: v.string(),
              email: v.string(),
              role: v.string(),
            }),
          }),
        ),
      }),
    ),
    eventHistory: v.array(
      v.object({
        _id: v.id("user_bank_account_events"),
        event_type: v.string(),
        created_at: v.number(),
        previous_values: v.optional(v.any()),
        new_values: v.optional(v.any()),
        actor_user_id: v.optional(v.id("users")),
        actor_admin_id: v.optional(v.id("admin_users")),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await getAdminUser(ctx);

    const account = await ctx.db.get(args.accountId);
    if (!account) {
      throw new ConvexError("Account not found");
    }

    const user = await ctx.db.get(account.user_id);
    if (!user) {
      throw new ConvexError("User not found");
    }

    if (user.status === "suspended" || user.status === "closed") {
      throw new ConvexError(`User is ${user.status}`);
    }

    const documents = await ctx.db
      .query(TABLE_NAMES.BANK_ACCOUNT_DOCUMENTS)
      .withIndex("by_account_id", (q) => q.eq("account_id", args.accountId))
      .collect();

    // Fetch comments for all documents
    const commentsByDocId = new Map<string, Array<any>>();
    for (const doc of documents) {
      const comments = await ctx.db
        .query(TABLE_NAMES.BANK_ACCOUNT_DOCUMENT_COMMENTS)
        .withIndex("by_document_id_and_created_at", (q) =>
          q.eq("document_id", doc._id),
        )
        .collect();

      // Enrich with admin details
      const enriched = await Promise.all(
        comments.map(async (comment) => {
          const adminUser = await ctx.db.get(comment.admin_id);
          if (!adminUser) {
            throw new ConvexError(
              `Admin ${comment.admin_id} not found for comment ${comment._id}`,
            );
          }

          return {
            _id: comment._id,
            admin_id: comment.admin_id,
            comment_type: comment.comment_type,
            content: comment.content,
            is_internal: comment.is_internal,
            status: comment.status,
            resolved_at: comment.resolved_at,
            resolved_by: comment.resolved_by,
            created_at: comment.created_at,
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

      commentsByDocId.set(doc._id, enriched);
    }

    const events = await ctx.db
      .query(TABLE_NAMES.USER_BANK_ACCOUNT_EVENTS)
      .withIndex("by_account_id", (q) => q.eq("account_id", args.accountId))
      .collect();

    return {
      account: {
        _id: account._id,
        user_id: account.user_id,
        bank_name: account.bank_name,
        account_number_last4: account.account_number.slice(-4),
        account_name: account.account_name ?? undefined,
        is_primary: account.is_primary,
        verification_status: account.verification_status,
        verification_submitted_at: account.verification_submitted_at,
        verified_at: account.verified_at,
        rejection_reason: account.rejection_reason,
        created_at: account.created_at,
        updated_at: account.updated_at,
      },
      user: {
        _id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email ?? undefined,
        phone: user.phone,
      },
      documents: documents.map((doc) => ({
        _id: doc._id,
        document_type: doc.document_type,
        file_name: doc.file_name,
        file_size: doc.file_size,
        mime_type: doc.mime_type,
        status: doc.status,
        uploaded_at: doc.uploaded_at,
        reviewed_by: doc.reviewed_by,
        reviewed_at: doc.reviewed_at,
        rejection_reason: doc.rejection_reason,
        comments: commentsByDocId.get(doc._id) ?? [],
      })),
      eventHistory: events.map((event) => ({
        _id: event._id,
        event_type: event.event_type,
        created_at: event.created_at,
        previous_values: event.previous_values,
        new_values: event.new_values,
        actor_user_id: event.actor_user_id,
        actor_admin_id: event.actor_admin_id,
      })),
    };
  },
});

/**
 * Get statistics for the verification queue
 * Useful for dashboard and workload management
 */
export const getQueueStats = query({
  args: {},
  returns: v.object({
    pending: v.number(),
    verified: v.number(),
    rejected: v.number(),
    totalDocuments: v.number(),
    oldestSubmission: v.optional(v.number()),
  }),
  handler: async (ctx) => {
    await getAdminUser(ctx);

    // Count by status
    const pending = await ctx.db
      .query(TABLE_NAMES.USER_BANK_ACCOUNTS)
      .withIndex("by_verification_status", (q) =>
        q.eq("verification_status", VERIFICATION_STATUS.PENDING),
      )
      .collect()
      .then((r) => r.length);

    const verified = await ctx.db
      .query(TABLE_NAMES.USER_BANK_ACCOUNTS)
      .withIndex("by_verification_status", (q) =>
        q.eq("verification_status", VERIFICATION_STATUS.VERIFIED),
      )
      .collect()
      .then((r) => r.length);

    const rejected = await ctx.db
      .query(TABLE_NAMES.USER_BANK_ACCOUNTS)
      .withIndex("by_verification_status", (q) =>
        q.eq("verification_status", VERIFICATION_STATUS.REJECTED),
      )
      .collect()
      .then((r) => r.length);

    // Total documents
    const totalDocuments = await ctx.db
      .query(TABLE_NAMES.BANK_ACCOUNT_DOCUMENTS)
      .collect()
      .then((r) => r.length);

    // Find oldest pending submission
    const pendingAccounts = await ctx.db
      .query(TABLE_NAMES.USER_BANK_ACCOUNTS)
      .withIndex("by_verification_status", (q) =>
        q.eq("verification_status", VERIFICATION_STATUS.PENDING),
      )
      .collect();

    let oldestSubmission: number | undefined = undefined;
    if (pendingAccounts.length > 0) {
      const oldest = pendingAccounts.reduce((min, acc) => {
        const accTime = acc.verification_submitted_at ?? acc.created_at;
        return accTime < min ? accTime : min;
      }, pendingAccounts[0].verification_submitted_at ?? pendingAccounts[0].created_at);
      oldestSubmission = oldest;
    }

    return {
      pending,
      verified,
      rejected,
      totalDocuments,
      oldestSubmission,
    };
  },
});

/**
 * Approve a bank account verification
 * Sets status to verified, marks all documents as approved, and logs the action
 *
 * @param ctx - Mutation context
 * @param args - Mutation arguments
 * @param args.accountId - ID of the account to approve
 * @param args.notes - Optional approval notes (visible to user)
 * @returns Updated account details
 */
export const approveVerification = mutation({
  args: {
    accountId: v.id("user_bank_accounts"),
    notes: v.optional(v.string()),
  },
  returns: v.object({
    _id: v.id("user_bank_accounts"),
    verification_status: verificationStatus,
    verified_at: v.optional(v.number()),
    updated_at: v.number(),
  }),
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);

    const account = await ctx.db.get(args.accountId);
    if (!account) {
      throw new ConvexError("Account not found");
    }

    const user = await ctx.db.get(account.user_id);
    if (!user || user.status === "suspended" || user.status === "closed") {
      throw new ConvexError(
        `Cannot approve: User is ${user?.status ?? "not found"}`,
      );
    }

    if (account.verification_status === "verified") {
      throw new ConvexError("Account is already verified");
    }

    const now = Date.now();

    // Update account status
    await ctx.db.patch(args.accountId, {
      verification_status: VERIFICATION_STATUS.VERIFIED,
      verified_at: now,
      verified_by_admin_id: admin._id,
      updated_at: now,
      rejection_reason: undefined,
    });

    // Approve all pending documents
    const documents = await ctx.db
      .query(TABLE_NAMES.BANK_ACCOUNT_DOCUMENTS)
      .withIndex("by_account_id", (q) => q.eq("account_id", args.accountId))
      .filter((q) => q.eq(q.field("status"), KYC_VERIFICATION_STATUS.PENDING))
      .collect();

    for (const doc of documents) {
      await ctx.db.patch(doc._id, {
        status: KYC_VERIFICATION_STATUS.APPROVED,
        reviewed_by: admin._id,
        reviewed_at: now,
        rejection_reason: undefined,
      });
    }

    const updated = await ctx.db.get(args.accountId);
    if (!updated) {
      throw new ConvexError("Failed to update account");
    }

    // Log to audit system
    await auditLog.log(ctx, {
      action: "bank_account.verification_approved",
      actorId: admin._id,
      resourceType: RESOURCE_TYPE.BANK_ACCOUNTS,
      resourceId: updated._id,
      severity: "info",
      metadata: {
        previous_status: account.verification_status,
        new_status: KYC_VERIFICATION_STATUS.APPROVED,
        notes: args.notes ?? null,
        documents_approved: documents.length,
      },
    });

    // Log event for compliance trail
    await ctx.db.insert("user_bank_account_events", {
      user_id: account.user_id,
      account_id: args.accountId,
      event_type: EVENT_TYPE.VERIFICATION_APPROVED,
      created_at: now,
      new_values: {
        verification_status: KYC_VERIFICATION_STATUS.APPROVED,
        verified_by_admin_id: admin._id,
        notes: args.notes ?? null,
      },
      actor_admin_id: admin._id,
    });

    return {
      _id: updated._id,
      verification_status: updated.verification_status,
      verified_at: updated.verified_at,
      updated_at: updated.updated_at,
    };
  },
});

/**
 * Reject a bank account verification
 * Sets status to rejected, marks documents as rejected, and requires a reason
 *
 * @param ctx - Mutation context
 * @param args - Mutation arguments
 * @param args.accountId - ID of the account to reject
 * @param args.reason - Required rejection reason (visible to user)
 * @returns Updated account details
 */
export const rejectVerification = mutation({
  args: {
    accountId: v.id("user_bank_accounts"),
    reason: v.string(),
  },
  returns: v.object({
    _id: v.id("user_bank_accounts"),
    verification_status: v.string(),
    rejection_reason: v.optional(v.string()),
    updated_at: v.number(),
  }),
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);

    const account = await ctx.db.get(args.accountId);
    if (!account) {
      throw new ConvexError("Account not found");
    }

    const user = await ctx.db.get(account.user_id);
    if (!user || user.status === "suspended" || user.status === "closed") {
      throw new ConvexError(
        `Cannot reject: User is ${user?.status ?? "not found"}`,
      );
    }

    if (account.verification_status === KYC_VERIFICATION_STATUS.REJECTED) {
      throw new ConvexError("Account is already rejected");
    }

    const now = Date.now();

    // Update account status
    await ctx.db.patch(args.accountId, {
      verification_status: KYC_VERIFICATION_STATUS.REJECTED,
      verified_at: undefined,
      verified_by_admin_id: undefined,
      updated_at: now,
      rejection_reason: args.reason,
    });

    // Reject all pending documents
    const documents = await ctx.db
      .query(TABLE_NAMES.BANK_ACCOUNT_DOCUMENTS)
      .withIndex("by_account_id", (q) => q.eq("account_id", args.accountId))
      .filter((q) => q.eq(q.field("status"), KYC_VERIFICATION_STATUS.PENDING))
      .collect();

    for (const doc of documents) {
      await ctx.db.patch(doc._id, {
        status: KYC_VERIFICATION_STATUS.REJECTED,
        reviewed_by: admin._id,
        reviewed_at: now,
        rejection_reason: args.reason,
      });
    }

    const updated = await ctx.db.get(args.accountId);
    if (!updated) {
      throw new ConvexError("Failed to update account");
    }

    // Log to audit system with warning severity
    await auditLog.log(ctx, {
      action: "bank_account.verification_rejected",
      actorId: admin._id,
      resourceType: RESOURCE_TYPE.BANK_ACCOUNTS,
      resourceId: updated._id,
      severity: "warning",
      metadata: {
        previous_status: account.verification_status,
        new_status: VERIFICATION_STATUS.REJECTED,
        reason: args.reason,
        documents_rejected: documents.length,
      },
    });

    // Log event for compliance trail
    await ctx.db.insert("user_bank_account_events", {
      user_id: account.user_id,
      account_id: args.accountId,
      event_type: EVENT_TYPE.VERIFICATION_REJECTED,
      created_at: now,
      new_values: {
        verification_status: VERIFICATION_STATUS.REJECTED,
        rejection_reason: args.reason,
      },
      actor_admin_id: admin._id,
    });

    return {
      _id: updated._id,
      verification_status: updated.verification_status,
      rejection_reason: updated.rejection_reason,
      updated_at: updated.updated_at,
    };
  },
});
