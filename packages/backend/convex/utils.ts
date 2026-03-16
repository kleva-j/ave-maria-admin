import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

import { ConvexError, v } from "convex/values";

import { authKit } from "./auth";

/**
 * Ensures that a user exists in the database
 *
 * @param ctx - Query or mutation context
 * @param userId - ID of the user to ensure
 * @throws ConvexError if the user does not exist
 */
export async function ensureUser(
  ctx: MutationCtx | QueryCtx,
  userId: Id<"users">,
) {
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError("User not found");
  }
}

/**
 * Retrieves the authenticated user from the database
 * Uses WorkOS authentication ID to lookup user record
 *
 * @param ctx - Query or mutation context
 * @returns User record from database
 * @throws ConvexError if not authenticated or user not found
 */
export async function getUser(ctx: QueryCtx | MutationCtx) {
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
 * Retrieves an authenticated admin user from the database
 * Uses WorkOS authentication ID to lookup admin record
 *
 * SECURITY: Admin-only operations require successful execution
 *
 * @param ctx - Query or mutation context
 * @returns Admin user record from database
 * @throws ConvexError if not authenticated or not an admin
 */
export async function getAdmin(ctx: QueryCtx | MutationCtx) {
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
export function sortAccounts(accounts: Doc<"user_bank_accounts">[]) {
  return [...accounts].sort((a, b) => {
    if (a.is_primary !== b.is_primary) {
      return a.is_primary ? -1 : 1;
    }
    return b.created_at - a.created_at;
  });
}

/**
 * Verification status for bank accounts
 * - pending: Awaiting verification
 * - verified: Successfully verified
 * - rejected: Verification failed or rejected
 */
export const VERFICATION_STATUS = {
  PENDING: "pending",
  VERIFIED: "verified",
  REJECTED: "rejected",
} as const;

export const verificationStatus = v.union(
  v.literal(VERFICATION_STATUS.PENDING),
  v.literal(VERFICATION_STATUS.VERIFIED),
  v.literal(VERFICATION_STATUS.REJECTED),
);

export const KYC_VERIFICATION_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export const kycVerificationStatus = v.union(
  v.literal(KYC_VERIFICATION_STATUS.PENDING),
  v.literal(KYC_VERIFICATION_STATUS.APPROVED),
  v.literal(KYC_VERIFICATION_STATUS.REJECTED),
);

/**
 * Event types for bank account audit trail
 * Tracks all state changes throughout an account's lifecycle
 */
export const EVENT_TYPE = {
  CREATED: "created",
  UPDATED: "updated",
  SET_PRIMARY: "set_primary",
  VERIFICATION_STATUS_CHANGED: "verification_status_changed",
  DELETED: "deleted",
  DOCUMENT_UPLOADED: "document_uploaded",
  VERIFICATION_SUBMITTED: "verification_submitted",
  VERIFICATION_APPROVED: "verification_approved",
  VERIFICATION_REJECTED: "verification_rejected",
} as const;

export const eventType = v.union(
  v.literal(EVENT_TYPE.CREATED),
  v.literal(EVENT_TYPE.UPDATED),
  v.literal(EVENT_TYPE.SET_PRIMARY),
  v.literal(EVENT_TYPE.VERIFICATION_STATUS_CHANGED),
  v.literal(EVENT_TYPE.DELETED),
  v.literal(EVENT_TYPE.DOCUMENT_UPLOADED),
  v.literal(EVENT_TYPE.VERIFICATION_SUBMITTED),
  v.literal(EVENT_TYPE.VERIFICATION_APPROVED),
  v.literal(EVENT_TYPE.VERIFICATION_REJECTED),
);

// Type aliases for validator types
// These extract the TypeScript types from Convex validators for type-safe usage
export type EventType = typeof eventType.type;
export type VerificationStatus = typeof verificationStatus.type;

/**
 * Resource types for audit log
 */
export const RESOURCE_TYPE = {
  USER: "user",
  ADMIN_USER: "admin_user",
  BANK_ACCOUNT: "user_bank_account",
  BANK_ACCOUNTS: "user_bank_accounts",
  BANK_ACCOUNT_DOCUMENT: "bank_account_document",
  BANK_ACCOUNT_DOCUMENTS: "bank_account_documents",
  TRANSACTION: "transaction",
  TRANSACTIONS: "transactions",
  WITHDRAWAL: "withdrawal",
  WITHDRAWALS: "withdrawals",
  SAVINGS_PLAN: "user_savings_plan",
  SAVINGS_PLANS: "user_savings_plans",
  SAVINGS_PLAN_TEMPLATE: "savings_plan_template",
  SAVINGS_PLAN_TEMPLATES: "savings_plan_templates",
} as const;

export const resourceType = v.union(
  v.literal(RESOURCE_TYPE.USER),
  v.literal(RESOURCE_TYPE.ADMIN_USER),
  v.literal(RESOURCE_TYPE.BANK_ACCOUNT),
  v.literal(RESOURCE_TYPE.BANK_ACCOUNTS),
  v.literal(RESOURCE_TYPE.BANK_ACCOUNT_DOCUMENT),
  v.literal(RESOURCE_TYPE.BANK_ACCOUNT_DOCUMENTS),
  v.literal(RESOURCE_TYPE.TRANSACTION),
  v.literal(RESOURCE_TYPE.TRANSACTIONS),
  v.literal(RESOURCE_TYPE.WITHDRAWAL),
  v.literal(RESOURCE_TYPE.WITHDRAWALS),
  v.literal(RESOURCE_TYPE.SAVINGS_PLAN),
  v.literal(RESOURCE_TYPE.SAVINGS_PLANS),
  v.literal(RESOURCE_TYPE.SAVINGS_PLAN_TEMPLATE),
  v.literal(RESOURCE_TYPE.SAVINGS_PLAN_TEMPLATES),
);

export type ResourceType = typeof resourceType.type;

export const DOCUMENT_TYPES = {
  GOVERNMENT_ID: "government_id",
  PROOF_OF_ADDRESS: "proof_of_address",
  BANK_STATEMENT: "bank_statement",
  SELFIE_WITH_ID: "selfie_with_id",
} as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[keyof typeof DOCUMENT_TYPES];
