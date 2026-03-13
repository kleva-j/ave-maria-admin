import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

import { v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";
import { authKit } from "./auth";

/**
 * Helper to get the current authenticated user's profile.
 */
async function getViewer(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const user = await authKit.getAuthUser(ctx);
  if (!user) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_workos_id", (q) => q.eq("workosId", user.id))
    .unique();
}

/**
 * Get the current authenticated user's profile.
 */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    return await getViewer(ctx);
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
    const user = await getViewer(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    await ctx.db.patch(user._id, {
      onboardingComplete: args.onboardingComplete ?? user.onboardingComplete,
    });

    return user._id;
  },
});

/**
 * Check if the current user is an admin.
 */
export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    const user = await getViewer(ctx);
    return !!user?.isAdmin;
  },
});

/**
 * List all users (admin only).
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getViewer(ctx);
    if (!user?.isAdmin) {
      throw new Error("Unauthorized");
    }
    return await ctx.db.query("users").collect();
  },
});

/**
 * Get a user profile by ID.
 * Access is restricted to the user themselves or an admin.
 */
export const get = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    const viewer = await getViewer(ctx);
    if (!viewer) {
      throw new Error("Not authenticated");
    }

    if (viewer._id !== args.id && !viewer.isAdmin) {
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
    lastLoginAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", args.workosId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        profilePictureUrl: args.profilePictureUrl,
        lastLoginAt: args.lastLoginAt ?? existing.lastLoginAt,
      });
      return existing._id;
    }
    return await ctx.db.insert("users", {
      workosId: args.workosId,
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      profilePictureUrl: args.profilePictureUrl,
      lastLoginAt: args.lastLoginAt,
      isAdmin: false,
      onboardingComplete: false,
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
      await ctx.db.delete(existing._id);
    }
  },
});
