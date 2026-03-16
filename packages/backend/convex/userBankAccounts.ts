/**
 * User Bank Accounts Module
 *
 * Manages user bank accounts with full audit trail support.
 * Features:
 * - CRUD operations for bank accounts
 * - Primary account management (one primary per user)
 * - Verification status tracking
 * - Complete event logging for compliance
 * - Audit log integration
 *
 * Database Tables:
 * - user_bank_accounts: Stores bank account details
 * - user_bank_account_events: Immutable event log for all account changes
 */
import type { VerificationStatus, EventType } from "./utils";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

import { ConvexError, v } from "convex/values";

import { auditLog } from "./auditLog";
import {
  // Enums
  VERFICATION_STATUS,
  verificationStatus,
  DOCUMENT_TYPES,
  RESOURCE_TYPE,
  EVENT_TYPE,
  // Functions
  sortAccounts,
  eventType,
  getAdmin,
  getUser,
} from "./utils";

import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

/**
 * Validator schema for bank account records
 * Used for type-safe validation and return type inference
 */
const bankAccountValidator = v.object({
  _id: v.id("user_bank_accounts"),
  _creationTime: v.number(),
  user_id: v.id("users"),
  bank_name: v.string(),
  account_number: v.string(),
  account_name: v.optional(v.string()),
  is_primary: v.boolean(),
  created_at: v.number(),
  updated_at: v.number(),
  verification_status: verificationStatus,
  verified_at: v.optional(v.number()),
});

const maskedBankAccountValidator = v.object({
  _id: v.id("user_bank_accounts"),
  _creationTime: v.number(),
  user_id: v.id("users"),
  bank_name: v.string(),
  account_number_last4: v.string(),
  account_name: v.optional(v.string()),
  is_primary: v.boolean(),
  created_at: v.number(),
  updated_at: v.number(),
  verification_status: verificationStatus,
  verified_at: v.optional(v.number()),
});

const bankAccountEventValidator = v.object({
  _id: v.id("user_bank_account_events"),
  _creationTime: v.number(),
  user_id: v.id("users"),
  account_id: v.id("user_bank_accounts"),
  event_type: eventType,
  previous_values: v.optional(v.any()),
  new_values: v.optional(v.any()),
  actor_user_id: v.optional(v.id("users")),
  actor_admin_id: v.optional(v.id("admin_users")),
  created_at: v.number(),
});

/**
 * Creates a sanitized snapshot of account data for logging
 * Excludes sensitive fields like full account number (only keeps last 4 digits)
 *
 * SECURITY: Never log full account numbers - compliance requirement
 *
 * @param account - Bank account data to snapshot
 * @returns Sanitized object suitable for audit logs
 */
function accountSnapshot(account: {
  bank_name: string;
  account_number: string;
  account_name?: string;
  is_primary: boolean;
  verification_status: VerificationStatus;
}) {
  return {
    bank_name: account.bank_name,
    account_name: account.account_name ?? null,
    account_number_last4: account.account_number.slice(-4), // Only log last 4 digits
    is_primary: account.is_primary,
    verification_status: account.verification_status,
  };
}

/**
 * Converts a full bank account record to a masked version for client display
 * Replaces full account number with last 4 digits only
 *
 * SECURITY: Prevents exposure of sensitive account information to clients
 *
 * @param account - Full bank account record from database
 * @returns Masked account record safe for client consumption
 */
function toMaskedAccount(account: {
  _id: Id<"user_bank_accounts">;
  _creationTime: number;
  user_id: Id<"users">;
  bank_name: string;
  account_number: string;
  account_name?: string;
  is_primary: boolean;
  created_at: number;
  updated_at: number;
  verification_status: VerificationStatus;
  verified_at?: number;
}) {
  return {
    _id: account._id,
    _creationTime: account._creationTime,
    user_id: account.user_id,
    bank_name: account.bank_name,
    account_number_last4: account.account_number.slice(-4),
    account_name: account.account_name,
    is_primary: account.is_primary,
    created_at: account.created_at,
    updated_at: account.updated_at,
    verification_status: account.verification_status,
    verified_at: account.verified_at,
  };
}

/**
 * Logs a bank account event to the immutable event table
 * Used for audit trail and compliance requirements
 *
 * COMPLIANCE: All account changes must be logged for regulatory audit
 * Events are append-only - never modify or delete events
 *
 * @param ctx - Mutation context
 * @param params - Event parameters
 * @param params.userId - ID of the user who owns the account
 * @param params.accountId - ID of the affected account
 * @param params.eventType - Type of event that occurred
 * @param params.previous - Previous values before the change (optional)
 * @param params.next - New values after the change (optional)
 * @param params.actorUserId - ID of user who triggered the change (if applicable)
 * @param params.actorAdminId - ID of admin who triggered the change (if applicable)
 */
async function logAccountEvent(
  ctx: MutationCtx,
  params: {
    userId: Id<"users">;
    accountId: Id<"user_bank_accounts">;
    eventType: EventType;
    previous?: Record<string, unknown> | null;
    next?: Record<string, unknown> | null;
    actorUserId?: Id<"users">;
    actorAdminId?: Id<"admin_users">;
  },
) {
  await ctx.db.insert("user_bank_account_events", {
    user_id: params.userId,
    account_id: params.accountId,
    event_type: params.eventType,
    created_at: Date.now(),
    // Conditionally include optional fields only if provided
    ...(params.previous && { previous_values: params.previous }),
    ...(params.next && { new_values: params.next }),
    ...(params.actorUserId && { actor_user_id: params.actorUserId }),
    ...(params.actorAdminId && { actor_admin_id: params.actorAdminId }),
  });
}

/**
 * Ensures only one primary bank account per user
 * When setting a new primary, removes primary status from all other accounts
 * and logs events for each change
 *
 * BUSINESS RULE: Each user can have exactly one primary account
 * Primary accounts are used for default withdrawals and notifications
 *
 * @param ctx - Mutation context
 * @param userId - ID of the user whose accounts to update
 * @param keepId - ID of the account to keep as primary
 * @param updatedAt - Timestamp for the update
 * @param actorUserId - ID of user triggering the change
 * @param actorAdminId - ID of admin triggering the change
 */
async function unsetOtherPrimaries(
  ctx: MutationCtx,
  userId: Id<"users">,
  keepId: Id<"user_bank_accounts">,
  updatedAt: number,
  actorUserId?: Id<"users">,
  actorAdminId?: Id<"admin_users">,
) {
  const primaries = await ctx.db
    .query("user_bank_accounts")
    .withIndex("by_user_id_and_is_primary", (q) =>
      q.eq("user_id", userId).eq("is_primary", true),
    )
    .collect();

  // Iterate through all current primary accounts and unset them concurrently
  const unsetPromises = primaries.map(async (account) => {
    if (account._id === keepId) return; // Skip the account we're keeping as primary

    const previous = accountSnapshot(account);
    await ctx.db.patch(account._id, {
      is_primary: false,
      updated_at: updatedAt,
    });

    await logAccountEvent(ctx, {
      userId,
      accountId: account._id,
      eventType: EVENT_TYPE.UPDATED,
      previous,
      next: { ...previous, is_primary: false },
      actorUserId,
      actorAdminId,
    });
  });

  await Promise.all(unsetPromises);
}

/**
 * List all bank accounts for the authenticated user
 * Returns full account details including complete account numbers
 *
 * USAGE: Internal use only - do not expose full account numbers to client
 * For client display, use listMineMasked instead
 *
 * @returns Array of user's bank accounts sorted by primary status then date
 */
export const listMine = internalQuery({
  args: {},
  returns: v.array(bankAccountValidator),
  handler: async (ctx) => {
    const user = await getUser(ctx);

    // Fetch all bank accounts for this user using indexed query for performance
    const accounts = await ctx.db
      .query("user_bank_accounts")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .collect();

    return sortAccounts(accounts);
  },
});

/**
 * List all bank accounts for the authenticated user with masked data
 * Returns sanitized account information safe for client display
 *
 * SECURITY: Account numbers are masked to last 4 digits only
 *
 * @returns Array of masked bank accounts sorted by primary status then date
 */
export const listMineMasked = query({
  args: {},
  returns: v.array(maskedBankAccountValidator),
  handler: async (ctx) => {
    const user = await getUser(ctx);

    // Fetch all accounts and mask sensitive data before returning
    const accounts = await ctx.db
      .query("user_bank_accounts")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .collect();

    const sorted = sortAccounts(accounts);

    // Transform to masked format - safe for client display
    return sorted.map((account) => toMaskedAccount(account));
  },
});

/**
 * List all audit events for the authenticated user's bank accounts
 * Provides complete history of all banking activity
 *
 * COMPLIANCE: Users can view complete audit trail of their accounts
 *
 * @returns Array of all user's bank account events
 */
export const listMyEvents = query({
  args: {},
  returns: v.array(bankAccountEventValidator),
  handler: async (ctx) => {
    const user = await getUser(ctx);

    // Return complete audit trail for this user's accounts
    return await ctx.db
      .query("user_bank_account_events")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .collect();
  },
});

/**
 * List all events for a specific bank account
 * Provides a complete audit trail of all banking activity for that account
 *
 * SECURITY: Verifies account ownership before allowing access
 *
 * @param ctx - Query context
 * @param args - Query arguments
 * @param args.account_id - ID of the account to get events for
 * @returns Array of all user's bank account events
 */
export const listEventsForAccount = query({
  args: { account_id: v.id("user_bank_accounts") },
  returns: v.array(bankAccountEventValidator),
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const account = await ctx.db.get(args.account_id);

    // Verify ownership before allowing access to event history
    if (!account || account.user_id !== user._id) {
      throw new ConvexError("Bank account not found");
    }

    return await ctx.db
      .query("user_bank_account_events")
      .withIndex("by_account_id", (q) => q.eq("account_id", args.account_id))
      .collect();
  },
});

/**
 * Create a new bank account for a user
 * Handles primary account logic automatically:
 * - If this is the user's first account, it becomes primary
 * - If make_primary is specified, sets it as primary and unsets others
 * - Prevents duplicate accounts (same account number)
 *
 * BUSINESS LOGIC:
 * - First account automatically becomes primary
 * - Duplicate account numbers are rejected
 * - Verification starts in "pending" state
 *
 * @param ctx - Mutation context
 * @param args - Mutation arguments
 * @param args.bank_name - Name of the bank
 * @param args.account_number - Full account number
 * @param args.account_name - Optional name on the account
 * @param args.make_primary - Optionally force this to be the primary account
 * @returns The created bank account record
 * @throws ConvexError if duplicate account exists or creation fails
 */
export const create = mutation({
  args: {
    bank_name: v.string(),
    account_number: v.string(),
    account_name: v.optional(v.string()),
  },
  returns: maskedBankAccountValidator,
  handler: async (ctx, args) => {
    const user = await getUser(ctx);

    // Check for duplicate account numbers across the entire system
    const duplicate = await ctx.db
      .query("user_bank_accounts")
      .withIndex("by_account_number", (q) =>
        q.eq("account_number", args.account_number),
      )
      .unique();

    if (duplicate) {
      throw new ConvexError("Bank account already exists");
    }

    // Check if user already has a primary account
    const existingPrimary = await ctx.db
      .query("user_bank_accounts")
      .withIndex("by_user_id_and_is_primary", (q) =>
        q.eq("user_id", user._id).eq("is_primary", true),
      )
      .take(1);

    // BUSINESS LOGIC: First account becomes primary
    const shouldBePrimary = existingPrimary.length === 0;
    const now = Date.now();

    // Insert the new account with initial state
    const accountId = await ctx.db.insert("user_bank_accounts", {
      user_id: user._id,
      bank_name: args.bank_name,
      account_number: args.account_number,
      account_name: args.account_name,
      is_primary: shouldBePrimary,
      created_at: now,
      updated_at: now,
      verification_status: VERFICATION_STATUS.PENDING, // Start with pending verification - requires admin approval
    });

    // If this is now primary, remove primary from other accounts
    if (shouldBePrimary) {
      await unsetOtherPrimaries(ctx, user._id, accountId, now, user._id);
    }

    // Retrieve the created account for return value
    const account = await ctx.db.get(accountId);
    if (!account) {
      throw new ConvexError("Failed to create bank account");
    }

    // Log to audit system
    await auditLog.log(ctx, {
      action: "bank_account.created",
      actorId: user._id,
      resourceType: RESOURCE_TYPE.BANK_ACCOUNTS,
      resourceId: account._id,
      severity: "info",
      metadata: accountSnapshot(account),
    });

    // Log event for compliance trail
    await logAccountEvent(ctx, {
      userId: user._id,
      accountId: account._id,
      eventType: EVENT_TYPE.CREATED,
      next: accountSnapshot(account),
      actorUserId: user._id,
    });

    return toMaskedAccount(account);
  },
});

/**
 * Update bank account details (bank name or account name)
 * Does not allow changing account number (would require delete + recreate)
 *
 * SECURITY: Account number changes not allowed - prevents fraud by changing
 * destination account mid-transaction
 *
 * @param ctx - Mutation context
 * @param args - Mutation arguments
 * @param args.account_id - ID of the account to update
 * @param args.bank_name - New bank name (optional)
 * @param args.account_name - New account name (optional)
 * @returns Updated bank account record
 * @throws ConvexError if account not found or user doesn't own it
 */
export const updateDetails = mutation({
  args: {
    account_id: v.id("user_bank_accounts"),
    bank_name: v.optional(v.string()),
    account_name: v.optional(v.string()),
  },
  returns: maskedBankAccountValidator,
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const account = await ctx.db.get(args.account_id);

    if (!account || account.user_id !== user._id) {
      throw new ConvexError("Bank account not found");
    }

    const previous = accountSnapshot(account);
    const now = Date.now();

    // Apply updates - only allow changing non-sensitive fields
    await ctx.db.patch(args.account_id, {
      bank_name: args.bank_name ?? account.bank_name,
      account_name: args.account_name ?? account.account_name,
      updated_at: now,
    });

    // Retrieve updated account
    const updated = await ctx.db.get(args.account_id);
    if (!updated) {
      throw new ConvexError("Failed to update bank account");
    }

    // Log change to audit system
    await auditLog.logChange(ctx, {
      action: "bank_account.updated",
      actorId: user._id,
      resourceType: RESOURCE_TYPE.BANK_ACCOUNTS,
      resourceId: args.account_id,
      before: previous,
      after: accountSnapshot(updated),
      severity: "info",
    });

    // Log event for compliance trail
    await logAccountEvent(ctx, {
      userId: user._id,
      accountId: args.account_id,
      eventType: EVENT_TYPE.UPDATED,
      previous,
      next: accountSnapshot(updated),
      actorUserId: user._id,
    });

    return toMaskedAccount(updated);
  },
});

/**
 * Set a bank account as the user's primary account
 * Automatically removes primary status from other accounts
 *
 * BUSINESS RULE: Only one primary account allowed per user
 * This operation is idempotent - no-op if already primary
 *
 * @param ctx - Mutation context
 * @param args - Mutation arguments
 * @param args.account_id - ID of the account to set as primary
 * @returns Updated bank account record
 * @throws ConvexError if account not found or user doesn't own it
 */
export const setPrimary = mutation({
  args: {
    account_id: v.id("user_bank_accounts"),
  },
  returns: maskedBankAccountValidator,
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const account = await ctx.db.get(args.account_id);

    if (!account || account.user_id !== user._id) {
      throw new ConvexError("Bank account not found");
    }

    // BUSINESS RULE: Only verified accounts can be set as primary
    if (account.verification_status !== "verified") {
      throw new ConvexError("Only verified accounts can be set as primary");
    }

    // No-op if already primary - avoids unnecessary writes and events
    if (account.is_primary) {
      return toMaskedAccount(account);
    }

    const now = Date.now();
    // Set as primary - atomic update
    await ctx.db.patch(account._id, { is_primary: true, updated_at: now });

    // Remove primary from other accounts
    await unsetOtherPrimaries(ctx, user._id, account._id, now, user._id);

    // Retrieve updated account
    const updated = await ctx.db.get(account._id);
    if (!updated) {
      throw new ConvexError("Failed to update bank account");
    }

    // Log change to audit system
    await auditLog.logChange(ctx, {
      action: "bank_account.primary_set",
      actorId: user._id,
      resourceType: RESOURCE_TYPE.BANK_ACCOUNTS,
      resourceId: account._id,
      before: accountSnapshot(account),
      after: accountSnapshot(updated),
      severity: "info",
    });

    // Log event for compliance trail
    await logAccountEvent(ctx, {
      userId: user._id,
      accountId: account._id,
      eventType: EVENT_TYPE.SET_PRIMARY,
      previous: accountSnapshot(account),
      next: accountSnapshot(updated),
      actorUserId: user._id,
    });

    return toMaskedAccount(updated);
  },
});

/**
 * Delete a bank account
 * If the deleted account was primary, automatically promotes the oldest remaining account
 *
 * BUSINESS LOGIC:
 * - Ensures user always has a primary account if any remain
 * - Oldest account becomes new primary (most established)
 * - All deletions are logged for audit
 *
 * @param ctx - Mutation context
 * @param args - Mutation arguments
 * @param args.account_id - ID of the account to delete
 * @returns null
 * @throws ConvexError if account not found or user doesn't own it
 */
export const remove = mutation({
  args: {
    account_id: v.id("user_bank_accounts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const account = await ctx.db.get(args.account_id);

    if (!account || account.user_id !== user._id) {
      throw new ConvexError("Bank account not found");
    }

    const wasPrimary = account.is_primary;
    const snapshot = accountSnapshot(account);

    // Log deletion to audit system
    await auditLog.log(ctx, {
      action: "bank_account.deleted",
      actorId: user._id,
      resourceType: RESOURCE_TYPE.BANK_ACCOUNTS,
      resourceId: account._id,
      severity: "warning", // Higher severity for deletions
      metadata: snapshot,
    });

    // Delete the account
    await ctx.db.delete(account._id);

    // Log event for compliance trail
    await logAccountEvent(ctx, {
      userId: user._id,
      accountId: account._id,
      eventType: EVENT_TYPE.DELETED,
      previous: snapshot,
      actorUserId: user._id,
    });

    // If deleted account was primary, auto-promote oldest remaining account
    // This ensures user always has a primary account if any remain
    if (wasPrimary) {
      const remaining = await ctx.db
        .query("user_bank_accounts")
        .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
        .collect();

      if (remaining.length > 0) {
        // BUSINESS LOGIC: Oldest account becomes new primary (most established)
        // Only promote verified accounts
        const verifiedRemaining = remaining.filter(
          (a) => a.verification_status === VERFICATION_STATUS.VERIFIED,
        );

        if (verifiedRemaining.length > 0) {
          // Sort by creation date ascending (oldest first)
          verifiedRemaining.sort((a, b) => a.created_at - b.created_at);
          const nextPrimary = verifiedRemaining[0];
          const now = Date.now();
          await ctx.db.patch(nextPrimary._id, {
            is_primary: true,
            updated_at: now,
          });

          // Log the automatic primary change
          await logAccountEvent(ctx, {
            userId: user._id,
            accountId: nextPrimary._id,
            eventType: EVENT_TYPE.SET_PRIMARY,
            previous: accountSnapshot(nextPrimary),
            next: { ...accountSnapshot(nextPrimary), is_primary: true },
            actorUserId: user._id,
          });
        }
      }
    }

    return null;
  },
});

/**
 * Update bank account verification status (internal use only)
 * Used by admin/system to verify or reject bank accounts
 *
 * ADMIN ONLY: Requires admin authentication
 * SECURITY: Verification status changes are high-priority audit events
 *
 * @param ctx - Internal mutation context
 * @param args - Mutation arguments
 * @param args.account_id - ID of the account to update
 * @param args.status - New verification status
 * @returns Updated bank account record
 * @throws ConvexError if account not found
 */
export const setVerificationStatus = internalMutation({
  args: {
    account_id: v.id("user_bank_accounts"),
    status: verificationStatus,
  },
  returns: bankAccountValidator,
  handler: async (ctx, args) => {
    // ADMIN ONLY: Requires admin authentication
    const admin = await getAdmin(ctx);

    const account = await ctx.db.get(args.account_id);
    if (!account) {
      throw new ConvexError("Bank account not found");
    }

    const previous = accountSnapshot(account);
    const now = Date.now();

    // Build patch dynamically based on new status
    const patch: Record<string, unknown> = {
      verification_status: args.status,
      updated_at: now,
    };

    // Track when account was verified - important for compliance
    if (args.status === VERFICATION_STATUS.VERIFIED) {
      patch.verified_at = now;
    }

    // Apply the update
    await ctx.db.patch(account._id, patch);

    // Retrieve updated account
    const updated = await ctx.db.get(account._id);
    if (!updated) {
      throw new ConvexError("Failed to update verification status");
    }

    // SECURITY: Verification status changes are high-priority audit events
    // Log change to audit system with higher severity
    await auditLog.logChange(ctx, {
      action: "bank_account.verification_status_changed",
      actorId: admin._id,
      resourceType: RESOURCE_TYPE.BANK_ACCOUNTS,
      resourceId: updated._id,
      before: previous,
      after: accountSnapshot(updated),
      severity: "warning", // Important security-related change - requires monitoring
    });

    // Log event for compliance trail
    await logAccountEvent(ctx, {
      userId: updated.user_id,
      accountId: updated._id,
      eventType: EVENT_TYPE.VERIFICATION_STATUS_CHANGED,
      previous,
      next: accountSnapshot(updated),
      actorAdminId: admin._id,
    });

    return updated;
  },
});

/**
 * Submit a bank account for verification
 * Validates that required documents are uploaded before submission
 *
 * BUSINESS LOGIC:
 * - Requires at least the minimum required documents
 * - Changes verification status to "pending"
 * - Locks account from further document deletion during review
 *
 * @param ctx - Mutation context
 * @param args - Mutation arguments
 * @param args.account_id - ID of the account to submit
 * @returns Updated bank account record
 * @throws ConvexError if account not found, missing documents, or already submitted
 */
export const submitForVerification = mutation({
  args: {
    account_id: v.id("user_bank_accounts"),
  },
  returns: bankAccountValidator,
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const account = await ctx.db.get(args.account_id);

    if (!account || account.user_id !== user._id) {
      throw new ConvexError("Bank account not found");
    }

    // Prevent duplicate submissions
    if (account.verification_status === VERFICATION_STATUS.VERIFIED) {
      throw new ConvexError("Account is already verified");
    }

    if (
      account.verification_submitted_at &&
      account.verification_status === VERFICATION_STATUS.PENDING
    ) {
      throw new ConvexError("Account already submitted for verification");
    }

    // Check for required documents
    const documents = await ctx.db
      .query("bank_account_documents")
      .withIndex("by_account_id", (q) => q.eq("account_id", args.account_id))
      .filter((q) => q.eq(q.field("status"), VERFICATION_STATUS.PENDING))
      .collect();

    const uploadedDocTypes = documents.map((d) => d.document_type);
    const requiredDocs = [DOCUMENT_TYPES.GOVERNMENT_ID] as const; // Minimum requirement

    const missingDocs = requiredDocs.filter(
      (req) => !uploadedDocTypes.includes(req),
    );

    if (missingDocs.length > 0) {
      throw new ConvexError(
        `Missing required documents: ${missingDocs.join(", ")}`,
      );
    }

    const now = Date.now();
    const previous = accountSnapshot(account);

    // Update account status to pending verification
    await ctx.db.patch(args.account_id, {
      verification_status: VERFICATION_STATUS.PENDING,
      verification_submitted_at: now,
      updated_at: now,
    });

    const updated = await ctx.db.get(args.account_id);
    if (!updated) {
      throw new ConvexError("Failed to update account status");
    }

    // Log to audit system
    await auditLog.log(ctx, {
      action: "bank_account.verification_submitted",
      actorId: user._id,
      resourceType: RESOURCE_TYPE.BANK_ACCOUNTS,
      resourceId: updated._id,
      severity: "info",
      metadata: {
        ...accountSnapshot(updated),
        documents_submitted: uploadedDocTypes,
      },
    });

    // Log event for compliance trail
    await logAccountEvent(ctx, {
      userId: user._id,
      accountId: updated._id,
      eventType: EVENT_TYPE.VERIFICATION_SUBMITTED,
      previous,
      next: {
        ...accountSnapshot(updated),
        verification_status: VERFICATION_STATUS.PENDING,
        documents_submitted: uploadedDocTypes,
      },
      actorUserId: user._id,
    });

    return updated;
  },
});
