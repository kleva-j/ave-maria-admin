/**
 * KYC Identity Verification Pipeline
 *
 * Implements automated identity verification through simulated third-party providers
 * and manual admin review workflows. Handles user status transitions based on
 * KYC results with comprehensive audit logging and aggregate synchronization.
 *
 * @module kyc
 */
import type { KycData, KycDocument, KycDocumentId, UserId } from "./types";
import type { KycDocumentType } from "./shared";

import { ConvexError, v } from "convex/values";

import { syncUserUpdate } from "./aggregateHelpers";
import { getAdminUser, getUser } from "./utils";
import { internal } from "./_generated/api";
import { auditLog } from "./auditLog";
import {
  DOCUMENT_TYPES,
  RESOURCE_TYPE,
  TABLE_NAMES,
  UserStatus,
  KYCStatus,
} from "./shared";

import {
  internalAction,
  internalQuery,
  mutation,
  action,
  query,
} from "./_generated/server";

// Document types required for KYC verification (must all be submitted)
const REQUIRED_KYC_DOCUMENTS = [
  DOCUMENT_TYPES.GOVERNMENT_ID,
  DOCUMENT_TYPES.SELFIE_WITH_ID,
] as const;

/**
 * Main action to trigger the complete KYC identity verification process
 *
 * Workflow:
 * 1. Fetch user data and pending documents
 * 2. Validate document requirements (government ID + selfie with ID)
 * 3. Call external KYC provider (simulated)
 * 4. Process verification result
 * 5. Update user status and sync aggregates
 *
 * @action
 * @requires User authentication
 * @returns Verification result with approval status and reason
 * @throws If no documents, missing required docs, or user not in PENDING_KYC
 */
export const verifyIdentity = action({
  args: {},
  returns: v.object({
    approved: v.boolean(),
    reason: v.string(),
    userId: v.id("users"),
  }),
  handler: async (ctx) => {
    // Step 1: Fetch user data and pending documents for authenticated user
    const data: KycData = await ctx.runQuery(internal.kyc.getViewerKycData);

    // Validate documents exist
    if (data.documents.length === 0) {
      throw new ConvexError("No pending KYC documents found to verify");
    }

    // Validate user is in correct status
    if (data.user.status !== UserStatus.PENDING_KYC) {
      throw new ConvexError("User is not in pending_kyc status");
    }

    // Step 2: Validate required documents are present
    const submittedTypes = new Set(
      data.documents.map((d: KycDocument) => d.document_type),
    );
    const missingRequired = REQUIRED_KYC_DOCUMENTS.filter(
      (docType) => !submittedTypes.has(docType),
    );

    if (missingRequired.length > 0) {
      throw new ConvexError(
        `Missing required KYC documents: ${missingRequired.join(", ")}`,
      );
    }

    // Step 3: Call external provider (simulated with 80% approval rate)
    const result: { approved: boolean; reason: string } = await ctx.runAction(
      internal.kyc.simulateKycProvider,
      {
        userId: data.user._id,
        documentTypes: data.documents.map((d: KycDocument) => d.document_type),
      },
    );

    // Step 4: Process KYC result via internal mutation (updates user status)
    await ctx.runMutation(internal.users.processKycResult, {
      userId: data.user._id,
      approved: result.approved,
      reason: result.reason,
    });

    // Step 5: Return verification outcome to caller
    return { ...result, userId: data.user._id };
  },
});

/**
 * Simulates a third-party KYC provider API call (e.g., Smile Identity, Dojah)
 *
 * Simulation characteristics:
 * - 2 second network latency simulation
 * - 80% automatic approval rate
 * - Random rejection reasons for denials
 *
 * @internalAction
 * @param userId - User being verified
 * @param documentTypes - Array of document types submitted
 * @returns Verification result with approval status and reason
 */
export const simulateKycProvider = internalAction({
  args: {
    userId: v.id("users"),
    documentTypes: v.array(v.string()),
  },
  returns: v.object({
    approved: v.boolean(),
    reason: v.string(),
  }),
  handler: async () => {
    // Simulate network latency (2 seconds)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Simulate 80% approval rate
    const isApproved = Math.random() < 0.8;

    if (isApproved) {
      return { approved: true, reason: "Automatically verified by provider" };
    }

    const reasons = [
      "Document illegible or blurry",
      "Face mismatch with government ID",
      "ID expired or invalid",
      "Suspected fraudulent document",
    ];
    return {
      approved: false,
      reason: reasons[Math.floor(Math.random() * reasons.length)],
    };
  },
});

/**
 * Internal query to fetch authenticated user's KYC data safely for actions
 *
 * @internalQuery
 * @returns User record and pending KYC documents
 */
export const getViewerKycData = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Get authenticated user
    const user = await getUser(ctx);

    const documents = await ctx.db
      .query(TABLE_NAMES.KYC_DOCUMENTS)
      .withIndex("by_user_id_and_status", (q) =>
        q.eq("user_id", user._id).eq("status", KYCStatus.PENDING),
      )
      .collect();

    return { user, documents };
  },
});

/**
 * Admin query to list all users awaiting KYC review
 *
 * Returns users grouped by their pending documents, sorted by
 * oldest submission first (first-come-first-serve queue).
 *
 * @query
 * @requires Admin authentication
 * @returns Array of users with their pending document details
 */
export const adminListPendingKyc = query({
  args: {},
  returns: v.array(
    v.object({
      user_id: v.id("users"),
      first_name: v.string(),
      last_name: v.string(),
      email: v.optional(v.string()),
      phone: v.string(),
      status: v.string(),
      pending_documents: v.array(
        v.object({
          document_id: v.id("kyc_documents"),
          document_type: v.string(),
          created_at: v.number(),
          uploaded_at: v.optional(v.number()),
          file_name: v.optional(v.string()),
          file_size: v.optional(v.number()),
          mime_type: v.optional(v.string()),
        }),
      ),
    }),
  ),
  handler: async (ctx) => {
    // Validate admin authentication
    await getAdminUser(ctx);

    const pendingDocs = await ctx.db
      .query(TABLE_NAMES.KYC_DOCUMENTS)
      .withIndex("by_status", (q) => q.eq("status", KYCStatus.PENDING))
      .collect();

    const grouped = new Map<UserId, KycDocument[]>();
    for (const doc of pendingDocs) {
      const key = doc.user_id;
      const current = grouped.get(key);
      if (current) {
        current.push(doc);
      } else {
        grouped.set(key, [doc]);
      }
    }

    const rows: {
      user_id: UserId;
      first_name: string;
      last_name: string;
      email: string | undefined;
      phone: string;
      status: string;
      pending_documents: {
        document_id: KycDocumentId;
        document_type: KycDocumentType;
        created_at: number;
        uploaded_at: number | undefined;
        file_name: string | undefined;
        file_size: number | undefined;
        mime_type: string | undefined;
      }[];
    }[] = [];

    for (const [userId, docs] of grouped) {
      const user = await ctx.db.get(userId);
      if (!user) continue;

      docs.sort((a, b) => a.created_at - b.created_at);

      rows.push({
        user_id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email ?? undefined,
        phone: user.phone,
        status: user.status,
        pending_documents: docs.map((doc) => ({
          document_id: doc._id,
          document_type: doc.document_type,
          created_at: doc.created_at,
          uploaded_at: doc.uploaded_at,
          file_name: doc.file_name,
          file_size: doc.file_size,
          mime_type: doc.mime_type,
        })),
      });
    }

    rows.sort((a, b) => {
      const aOldest =
        a.pending_documents[0]?.created_at ?? Number.MAX_SAFE_INTEGER;
      const bOldest =
        b.pending_documents[0]?.created_at ?? Number.MAX_SAFE_INTEGER;
      return aOldest - bOldest;
    });

    return rows;
  },
});

/**
 * Admin mutation to manually review and approve/reject KYC submissions
 *
 * Workflow:
 * 1. Validate admin authentication
 * 2. Verify user is in PENDING_KYC status
 * 3. Require rejection reason if denying
 * 4. Process KYC result (updates user status)
 * 5. Sync user aggregates for analytics
 * 6. Log comprehensive audit trail
 *
 * @mutation
 * @requires Admin authentication
 * @param userId - User being reviewed
 * @param approved - Approval decision
 * @param reason - Optional reason (required if rejected)
 * @returns Result with new user status and documents reviewed count
 * @throws If user not found, wrong status, or missing rejection reason
 */
export const adminReviewKyc = mutation({
  args: {
    userId: v.id("users"),
    approved: v.boolean(),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    userId: v.id("users"),
    newStatus: v.string(),
    documentsReviewed: v.number(),
  }),
  handler: async (ctx, args) => {
    // Validate admin authentication
    const admin = await getAdminUser(ctx);

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    if (user.status !== UserStatus.PENDING_KYC) {
      throw new ConvexError("User is not in pending_kyc status");
    }

    if (!args.approved && (!args.reason || args.reason.trim().length === 0)) {
      throw new ConvexError("Rejection reason is required");
    }

    const pendingDocs = await ctx.db
      .query(TABLE_NAMES.KYC_DOCUMENTS)
      .withIndex("by_user_id_and_status", (q) =>
        q.eq("user_id", args.userId).eq("status", KYCStatus.PENDING),
      )
      .collect();

    if (pendingDocs.length === 0) {
      throw new ConvexError("No pending KYC documents to review");
    }

    const nextUserStatus = args.approved
      ? UserStatus.ACTIVE
      : UserStatus.CLOSED;

    // Get old user state before updating
    const oldUser = user;

    await ctx.runMutation(internal.users.processKycResult, {
      userId: args.userId,
      approved: args.approved,
      reason: args.reason,
      reviewedBy: admin._id,
    });

    // Get updated user and sync aggregates
    const updatedUser = await ctx.db.get(args.userId);
    if (updatedUser) {
      await syncUserUpdate(ctx, oldUser, updatedUser);
    }

    await auditLog.logChange(ctx, {
      action: "kyc.reviewed",
      actorId: admin._id,
      resourceType: RESOURCE_TYPE.USERS,
      resourceId: user._id,
      before: { status: user.status },
      after: {
        status: nextUserStatus,
        approved: args.approved,
        reason: args.reason,
        documents_reviewed: pendingDocs.length,
      },
      severity: args.approved ? "info" : "warning",
    });

    return {
      userId: user._id,
      newStatus: nextUserStatus,
      documentsReviewed: pendingDocs.length,
    };
  },
});
