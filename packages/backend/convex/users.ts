import { v } from "convex/values";

import { AuditActions } from "convex-audit-log";

import { internalMutation, mutation, query } from "./_generated/server";
import { ensureUser, getAdminUser, getUser } from "./utils";
import { auditLog } from "./auditLog";

import {
  KYC_VERIFICATION_STATUS,
  RESOURCE_TYPE,
  TABLE_NAMES,
  EVENT_TYPE,
  UserStatus,
} from "./shared";

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
      const updatedUser = await ctx.db.get(existing._id);
      if (updatedUser) {
        await syncUserUpdate(ctx, oldUser, updatedUser);
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
  },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx, args.userId);

    const newStatus = args.approved ? "active" : "closed";
    const docNewStatus = args.approved
      ? KYC_VERIFICATION_STATUS.APPROVED
      : KYC_VERIFICATION_STATUS.REJECTED;

    const documents = await ctx.db
      .query(TABLE_NAMES.KYC_DOCUMENTS)
      .withIndex("by_user_id_and_status", (q) =>
        q
          .eq("user_id", args.userId)
          .eq("status", KYC_VERIFICATION_STATUS.PENDING),
      )
      .collect();

    const now = Date.now();

    // Update the user's status
    await ctx.db.patch(args.userId, { status: newStatus, updated_at: now });

    // Update all pending documents concurrently
    await Promise.all(
      documents.map((doc) =>
        ctx.db.patch(doc._id, {
          status: docNewStatus,
          reviewed_by: args.reviewedBy,
          reviewed_at: now,
          rejection_reason: args.approved ? undefined : args.reason,
        }),
      ),
    );

    // Log the result using system event types
    await auditLog.logChange(ctx, {
      action: args.approved
        ? EVENT_TYPE.KYC_VERIFICATION_COMPLETED
        : EVENT_TYPE.KYC_VERIFICATION_FAILED,
      actorId: args.userId, // System action, but attributing to user context
      resourceType: RESOURCE_TYPE.USERS,
      resourceId: args.userId,
      before: { status: user.status },
      after: { status: newStatus, reason: args.reason },
      severity: args.approved ? "info" : "warning",
    });

    return { success: true };
  },
});
