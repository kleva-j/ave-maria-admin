import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

import { AuditActions } from "convex-audit-log";
import { v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";
import { auditLog } from "./auditLog";
import { authKit } from "./auth";

/**
 * Helper to get the current authenticated regular user's profile.
 */
async function getUser(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const authUser = await authKit.getAuthUser(ctx);
  if (!authUser) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_workos_id", (q) => q.eq("workosId", authUser.id))
    .unique();
}

/**
 * Helper to get the current authenticated admin user's profile.
 */
async function getAdminUser(ctx: QueryCtx): Promise<Doc<"admin_users"> | null> {
  const authUser = await authKit.getAuthUser(ctx);
  if (!authUser) return null;

  return await ctx.db
    .query("admin_users")
    .withIndex("by_workos_id", (q) => q.eq("workosId", authUser.id))
    .unique();
}

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
      resourceType: "users",
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
 * List all users (admin only).
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await authKit.getAuthUser(ctx);
    if (!user) return null;

    const adminUser = await ctx.db
      .query("admin_users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", user.id))
      .unique();

    if (!adminUser) {
      throw new Error("Not authorized to view users");
    }

    return await ctx.db.query("users").collect();
  },
});

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
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", args.workosId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        first_name: args.firstName,
        last_name: args.lastName,
        profile_picture_url: args.profilePictureUrl,
        last_login_at: args.lastLoginAt,
      });
      return existing._id;
    }
    return await ctx.db.insert("users", {
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
      status: "pending_kyc",
      created_at: Date.now(),
      updated_at: Date.now(),
      last_login_at: args.lastLoginAt,
    });
  },
});

/**
 * Internal mutation to delete a user record when they are removed from WorkOS.
 */
export const deleteUser = internalMutation({
  args: { workosId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", args.workosId))
      .unique();

    if (existing) {
      await auditLog.log(ctx, {
        action: AuditActions.USER_DELETED,
        actorId: existing._id,
        resourceType: "users",
        resourceId: existing._id,
        severity: "warning",
      });
      await ctx.db.delete(existing._id);
    }
  },
});
