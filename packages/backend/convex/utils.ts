import type {
  UserBankAccount,
  AdminUserId,
  AdminUser,
  Context,
  UserId,
  User,
} from "./types";

import { ConvexError } from "convex/values";

import { UserStatus } from "./shared";
import { authKit } from "./auth";

export function withUser(
  func: (ctx: Context & { user: User }, ...args: any[]) => Promise<any>,
) {
  return async (ctx: Context, ...args: any[]) => {
    const user = await getUser(ctx);
    return await func({ ...ctx, user }, ...args);
  };
}

export function withActiveUser(
  func: (ctx: Context & { user: User }, ...args: any[]) => Promise<any>,
) {
  return async (ctx: Context, ...args: any[]) => {
    const user = await getUserWithStatus(ctx, "active");
    return await func({ ...ctx, user }, ...args);
  };
}

export function withAdminUser(
  func: (
    ctx: Context & { adminUser: AdminUser },
    ...args: any[]
  ) => Promise<any>,
) {
  return async (ctx: Context, ...args: any[]) => {
    const adminUser = await getAdminUser(ctx);
    return await func({ ...ctx, adminUser }, ...args);
  };
}

/**
 * Ensures that a user exists in the database
 *
 * @param ctx - Query or mutation context
 * @param userId - ID of the user to ensure
 * @throws ConvexError if the user does not exist
 */
export async function ensureUser(ctx: Context, userId: UserId) {
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError("User not found");
  }
  return user;
}

export async function ensureAuthedUser(ctx: Context) {
  const authUser = await authKit.getAuthUser(ctx);
  if (!authUser) throw new ConvexError("Not authenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_workos_id", (q) => q.eq("workosId", authUser.id))
    .unique();

  if (!user) throw new ConvexError("User not found");
}

/**
 * Retrieves the authenticated user from the database
 * Uses WorkOS authentication ID to lookup user record
 *
 * @param ctx - Query or mutation context
 * @returns User record from database
 * @throws ConvexError if not authenticated or user not found
 */
export async function getUser(ctx: Context) {
  const authUser = await authKit.getAuthUser(ctx);
  if (!authUser) {
    throw new ConvexError("Not authenticated");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_workos_id", (q) => q.eq("workosId", authUser.id))
    .unique();

  if (!user) {
    throw new ConvexError("User not found");
  }

  return user;
}

/**
 * Retrieves the authenticated user from the database
 * Uses WorkOS authentication ID to lookup user record
 *
 * @param ctx - Query or mutation context
 * @returns User record from database
 * @throws ConvexError if not authenticated or user not found
 */
export async function getUserWithStatus(ctx: Context, status: UserStatus) {
  const authUser = await authKit.getAuthUser(ctx);
  if (!authUser) {
    throw new ConvexError("Not authenticated");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_workos_id_and_status", (q) =>
      q.eq("workosId", authUser.id).eq("status", status),
    )
    .unique();

  if (!user) {
    throw new ConvexError("User not found");
  }

  return user;
}

export async function ensureAdminUser(ctx: Context, userId: AdminUserId) {
  const adminUser = await ctx.db.get(userId);

  if (!adminUser) throw new ConvexError("Not authorized");

  return adminUser;
}

/**
 * Retrieves an authenticated admin user from the database
 * Uses WorkOS authentication ID to lookup admin record
 *
 * SECURITY: Admin-only operations require successful execution
 *
 * @param ctx - Query or mutation context
 * @returns Admin user record from database
 * @throws ConvexError if not authenticated or not an admin
 */
export async function getAdminUser(ctx: Context) {
  const authUser = await authKit.getAuthUser(ctx);
  if (!authUser) {
    throw new ConvexError("Not authenticated");
  }

  const admin = await ctx.db
    .query("admin_users")
    .withIndex("by_workos_id", (q) => q.eq("workosId", authUser.id))
    .unique();

  if (!admin) {
    throw new ConvexError("Not authorized");
  }

  return admin;
}

/**
 * Sorts bank accounts by primary status then by creation date (newest first)
 *
 * @param accounts - List of bank accounts to sort
 * @returns Sorted list of accounts
 */
export function sortAccounts(accounts: UserBankAccount[]) {
  return [...accounts].sort((a, b) => {
    if (a.is_primary !== b.is_primary) {
      return a.is_primary ? -1 : 1;
    }
    return b.created_at - a.created_at;
  });
}
