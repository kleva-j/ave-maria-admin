import { v } from "convex/values";

import { createApplyKycDecisionUseCase } from "@avm-daily/application/use-cases";
import { AuditActions } from "convex-audit-log";

import { RESOURCE_TYPE, TABLE_NAMES, EVENT_TYPE, UserStatus } from "./shared";
import { createConvexKycDocumentRepository } from "./adapters/kycAdapters";
import { createConvexAuditLogService } from "./adapters/auditLogAdapter";
import { internalMutation, mutation, query } from "./_generated/server";
import { createConvexUserRepository } from "./adapters/userAdapters";
import { buildUserProfileSyncAuditChange } from "./userAudit";
import { ensureUser, getAdminUser, getUser } from "./utils";
import { auditLog } from "./auditLog";

import {
  syncUserInsert,
  syncUserUpdate,
  syncUserDelete,
} from "./aggregateHelpers";

/**
 * Get a user profile by ID.
 * Access is restricted to the user themselves or an admin.
 */
export const get = query({
  args: { id: v.id("users"), role: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const regularUser = await getUser(ctx);
    const adminUser = regularUser ? null : await getAdminUser(ctx);

    if (!regularUser && !adminUser) {
      throw new Error("Not authenticated");
    }

    // Regular users can only fetch their own profile; admins can fetch any
    if (regularUser && regularUser._id !== args.id) {
      throw new Error("Unauthorized");
    }

    return await ctx.db.get(args.id);
  },
});

/**
 * Get the current authenticated user's profile.
 */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    return await getUser(ctx);
  },
});

/**
 * Update the current authenticated user's profile.
 * This only allows updating application-specific fields.
 */
export const updateUserProfile = mutation({
  args: {
    onboardingComplete: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    await auditLog.logChange(ctx, {
      action: AuditActions.USER_UPDATED,
      actorId: user._id,
      resourceType: RESOURCE_TYPE.USERS,
      resourceId: user._id,
      before: { onboarding_complete: user.onboarding_complete },
      after: { onboarding_complete: args.onboardingComplete },
      severity: "info",
    });

    await ctx.db.patch(user._id, {
      onboarding_complete: args.onboardingComplete ?? user.onboarding_complete,
    });

    return user._id;
  },
});

/**
 * Internal mutation to create or update a user record when they log in or sync.
 */
export const upsertFromWorkOS = internalMutation({
  args: {
    workosId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
    lastLoginAt: v.nullable(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query(TABLE_NAMES.USERS)
      .withIndex("by_workos_id", (q) => q.eq("workosId", args.workosId))
      .unique();

    if (existing) {
      const oldUser = existing;
      await ctx.db.patch(existing._id, {
        email: args.email,
        first_name: args.firstName,
        last_name: args.lastName,
        profile_picture_url: args.profilePictureUrl,
        last_login_at: args.lastLoginAt,
      });

      // Sync aggregates for user updates
      const updatedUser = (await ctx.db.get(existing._id))!;
      await syncUserUpdate(ctx, oldUser, updatedUser);

      // Audit significant profile changes during external sync
      const profileSyncAuditChange = buildUserProfileSyncAuditChange(
        oldUser,
        updatedUser,
      );
      if (profileSyncAuditChange.changedFields.length > 0) {
        await auditLog.logChange(ctx, {
          action: EVENT_TYPE.USER_PROFILE_SYNCED,
          actorId: updatedUser._id,
          resourceType: RESOURCE_TYPE.USERS,
          resourceId: updatedUser._id,
          before: profileSyncAuditChange.before,
          after: profileSyncAuditChange.after,
          severity: "info",
        });
      }

      return existing._id;
    }
    const userId = await ctx.db.insert(TABLE_NAMES.USERS, {
      workosId: args.workosId,
      email: args.email,
      first_name: args.firstName ?? "",
      last_name: args.lastName ?? "",
      profile_picture_url: args.profilePictureUrl,
      onboarding_complete: false,
      phone: "",
      referral_code: "",
      total_balance_kobo: BigInt(0),
      savings_balance_kobo: BigInt(0),
      status: UserStatus.PENDING_KYC,
      created_at: Date.now(),
      updated_at: Date.now(),
      last_login_at: args.lastLoginAt,
    });

    // Sync aggregates for new user
    const newUser = await ctx.db.get(userId);
    if (newUser) {
      await syncUserInsert(ctx, newUser);
    }

    return userId;
  },
});

/**
 * Internal mutation to delete a user record when they are removed from WorkOS.
 */
export const deleteFromWorkOS = internalMutation({
  args: { workosId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query(TABLE_NAMES.USERS)
      .withIndex("by_workos_id", (q) => q.eq("workosId", args.workosId))
      .unique();

    if (existing) {
      // Sync aggregates before deletion
      await syncUserDelete(ctx, existing);

      await auditLog.log(ctx, {
        action: AuditActions.USER_DELETED,
        actorId: existing._id,
        resourceType: RESOURCE_TYPE.USERS,
        resourceId: existing._id,
        severity: "warning",
      });
      await ctx.db.delete(existing._id);
    }
  },
});

/**
 * Internal mutation to process the result of an automated KYC check.
 */
export const processKycResult = internalMutation({
  args: {
    userId: v.id("users"),
    approved: v.boolean(),
    reason: v.optional(v.string()),
    reviewedBy: v.optional(v.id("admin_users")),
    providerReference: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const oldUser = await ensureUser(ctx, args.userId);
    const applyKycDecision = createApplyKycDecisionUseCase({
      userRepository: createConvexUserRepository(ctx),
      kycDocumentRepository: createConvexKycDocumentRepository(ctx),
      auditLogService: createConvexAuditLogService(ctx),
    });

    const result = await applyKycDecision({
      userId: String(args.userId),
      approved: args.approved,
      reason: args.reason,
      reviewedBy: args.reviewedBy ? String(args.reviewedBy) : undefined,
      providerReference: args.providerReference,
      metadata:
        args.metadata &&
        typeof args.metadata === "object" &&
        !Array.isArray(args.metadata)
          ? { ...args.metadata }
          : undefined,
    });

    const updatedUser = await ensureUser(ctx, args.userId);
    await syncUserUpdate(ctx, oldUser, updatedUser);

    await auditLog.log(ctx, {
      action: args.approved
        ? EVENT_TYPE.KYC_VERIFICATION_COMPLETED
        : EVENT_TYPE.KYC_VERIFICATION_FAILED,
      actorId: args.reviewedBy ?? args.userId,
      resourceType: RESOURCE_TYPE.USERS,
      resourceId: args.userId,
      severity: args.approved ? "info" : "warning",
      metadata: {
        approved: args.approved,
        reason: args.reason,
        documents_reviewed: result.documentsReviewed,
        provider_reference: args.providerReference,
        metadata: args.metadata,
      },
    });

    return result;
  },
});
