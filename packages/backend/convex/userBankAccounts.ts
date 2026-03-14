import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

import { ConvexError, v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";
import { auditLog } from "./auditLog";
import { ensureUser } from "./utils";

const verificationStatus = v.union(
  v.literal("pending"),
  v.literal("verified"),
  v.literal("rejected"),
);

const eventType = v.union(
  v.literal("created"),
  v.literal("updated"),
  v.literal("set_primary"),
  v.literal("verification_status_changed"),
  v.literal("deleted"),
);

type EventType = typeof eventType.type;
type VerificationStatus = typeof verificationStatus.type;

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
    account_number_last4: account.account_number.slice(-4),
    is_primary: account.is_primary,
    verification_status: account.verification_status,
  };
}

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
    previous_values: params.previous ?? undefined,
    new_values: params.next ?? undefined,
    actor_user_id: params.actorUserId ?? undefined,
    actor_admin_id: params.actorAdminId ?? undefined,
  });
}

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

  for (const account of primaries) {
    if (account._id === keepId) continue;

    const previous = accountSnapshot(account);
    await ctx.db.patch(account._id, {
      is_primary: false,
      updated_at: updatedAt,
    });

    await logAccountEvent(ctx, {
      userId,
      accountId: account._id,
      eventType: "updated",
      previous,
      next: { ...previous, is_primary: false },
      actorUserId,
      actorAdminId,
    });
  }
}

export const listByUser = query({
  args: { user_id: v.id("users") },
  returns: v.array(bankAccountValidator),
  handler: async (ctx, args) => {
    const accounts = await ctx.db
      .query("user_bank_accounts")
      .withIndex("by_user_id", (q) => q.eq("user_id", args.user_id))
      .collect();

    return accounts.sort((a, b) => {
      if (a.is_primary !== b.is_primary) {
        return a.is_primary ? -1 : 1;
      }
      return b.created_at - a.created_at;
    });
  },
});

export const listEventsByAccount = query({
  args: { account_id: v.id("user_bank_accounts") },
  returns: v.array(bankAccountEventValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("user_bank_account_events")
      .withIndex("by_account_id", (q) => q.eq("account_id", args.account_id))
      .collect();
  },
});

export const listEventsByUser = query({
  args: { user_id: v.id("users") },
  returns: v.array(bankAccountEventValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("user_bank_account_events")
      .withIndex("by_user_id", (q) => q.eq("user_id", args.user_id))
      .collect();
  },
});

export const create = mutation({
  args: {
    user_id: v.id("users"),
    bank_name: v.string(),
    account_number: v.string(),
    account_name: v.optional(v.string()),
    make_primary: v.optional(v.boolean()),
  },
  returns: bankAccountValidator,
  handler: async (ctx, args) => {
    await ensureUser(ctx, args.user_id);

    const duplicate = await ctx.db
      .query("user_bank_accounts")
      .withIndex("by_account_number", (q) =>
        q.eq("account_number", args.account_number),
      )
      .filter((q) => q.eq(q.field("user_id"), args.user_id))
      .take(1);

    if (duplicate.length > 0) {
      throw new ConvexError("Bank account already exists for this user");
    }

    const existingPrimary = await ctx.db
      .query("user_bank_accounts")
      .withIndex("by_user_id_and_is_primary", (q) =>
        q.eq("user_id", args.user_id).eq("is_primary", true),
      )
      .take(1);

    const shouldBePrimary = args.make_primary ?? existingPrimary.length === 0;
    const now = Date.now();

    const accountId = await ctx.db.insert("user_bank_accounts", {
      user_id: args.user_id,
      bank_name: args.bank_name,
      account_number: args.account_number,
      account_name: args.account_name,
      is_primary: shouldBePrimary,
      created_at: now,
      updated_at: now,
      verification_status: "pending",
    });

    if (shouldBePrimary) {
      await unsetOtherPrimaries(
        ctx,
        args.user_id,
        accountId,
        now,
        args.user_id,
      );
    }

    const account = await ctx.db.get(accountId);
    if (!account) {
      throw new ConvexError("Failed to create bank account");
    }

    await auditLog.log(ctx, {
      action: "bank_account.created",
      actorId: args.user_id,
      resourceType: "user_bank_accounts",
      resourceId: account._id,
      severity: "info",
      metadata: accountSnapshot(account),
    });

    await logAccountEvent(ctx, {
      userId: args.user_id,
      accountId: account._id,
      eventType: "created",
      next: accountSnapshot(account),
      actorUserId: args.user_id,
    });

    return account;
  },
});

export const updateDetails = mutation({
  args: {
    user_id: v.id("users"),
    account_id: v.id("user_bank_accounts"),
    bank_name: v.optional(v.string()),
    account_name: v.optional(v.string()),
  },
  returns: bankAccountValidator,
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.account_id);
    if (!account || account.user_id !== args.user_id) {
      throw new ConvexError("Bank account not found");
    }

    const previous = accountSnapshot(account);
    const now = Date.now();

    await ctx.db.patch(args.account_id, {
      bank_name: args.bank_name ?? account.bank_name,
      account_name: args.account_name ?? account.account_name,
      updated_at: now,
    });

    const updated = await ctx.db.get(args.account_id);
    if (!updated) {
      throw new ConvexError("Failed to update bank account");
    }

    await auditLog.logChange(ctx, {
      action: "bank_account.updated",
      actorId: args.user_id,
      resourceType: "user_bank_accounts",
      resourceId: args.account_id,
      before: previous,
      after: accountSnapshot(updated),
      severity: "info",
    });

    await logAccountEvent(ctx, {
      userId: args.user_id,
      accountId: args.account_id,
      eventType: "updated",
      previous,
      next: accountSnapshot(updated),
      actorUserId: args.user_id,
    });

    return updated;
  },
});

export const setPrimary = mutation({
  args: {
    user_id: v.id("users"),
    account_id: v.id("user_bank_accounts"),
  },
  returns: bankAccountValidator,
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.account_id);
    if (!account || account.user_id !== args.user_id) {
      throw new ConvexError("Bank account not found");
    }

    if (account.is_primary) {
      return account;
    }

    const now = Date.now();
    await ctx.db.patch(account._id, { is_primary: true, updated_at: now });

    await unsetOtherPrimaries(
      ctx,
      args.user_id,
      account._id,
      now,
      args.user_id,
    );

    const updated = await ctx.db.get(account._id);
    if (!updated) {
      throw new ConvexError("Failed to update bank account");
    }

    await auditLog.logChange(ctx, {
      action: "bank_account.primary_set",
      actorId: args.user_id,
      resourceType: "user_bank_accounts",
      resourceId: account._id,
      before: accountSnapshot(account),
      after: accountSnapshot(updated),
      severity: "info",
    });

    await logAccountEvent(ctx, {
      userId: args.user_id,
      accountId: account._id,
      eventType: "set_primary",
      previous: accountSnapshot(account),
      next: accountSnapshot(updated),
      actorUserId: args.user_id,
    });

    return updated;
  },
});

export const remove = mutation({
  args: {
    user_id: v.id("users"),
    account_id: v.id("user_bank_accounts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.account_id);
    if (!account || account.user_id !== args.user_id) {
      throw new ConvexError("Bank account not found");
    }

    const wasPrimary = account.is_primary;
    const snapshot = accountSnapshot(account);

    await auditLog.log(ctx, {
      action: "bank_account.deleted",
      actorId: args.user_id,
      resourceType: "user_bank_accounts",
      resourceId: account._id,
      severity: "warning",
      metadata: snapshot,
    });

    await ctx.db.delete(account._id);

    await logAccountEvent(ctx, {
      userId: args.user_id,
      accountId: account._id,
      eventType: "deleted",
      previous: snapshot,
      actorUserId: args.user_id,
    });

    if (wasPrimary) {
      const remaining = await ctx.db
        .query("user_bank_accounts")
        .withIndex("by_user_id", (q) => q.eq("user_id", args.user_id))
        .collect();

      if (remaining.length > 0) {
        remaining.sort((a, b) => b.created_at - a.created_at);
        const nextPrimary = remaining[0];
        const now = Date.now();
        await ctx.db.patch(nextPrimary._id, {
          is_primary: true,
          updated_at: now,
        });

        await logAccountEvent(ctx, {
          userId: args.user_id,
          accountId: nextPrimary._id,
          eventType: "set_primary",
          previous: accountSnapshot(nextPrimary),
          next: { ...accountSnapshot(nextPrimary), is_primary: true },
          actorUserId: args.user_id,
        });
      }
    }

    return null;
  },
});

export const setVerificationStatus = internalMutation({
  args: {
    account_id: v.id("user_bank_accounts"),
    status: verificationStatus,
    admin_id: v.optional(v.id("admin_users")),
  },
  returns: bankAccountValidator,
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.account_id);
    if (!account) {
      throw new ConvexError("Bank account not found");
    }

    const previous = accountSnapshot(account);
    const now = Date.now();

    const patch: Record<string, unknown> = {
      verification_status: args.status,
      updated_at: now,
    };

    if (args.status === "verified") {
      patch.verified_at = now;
    }

    await ctx.db.patch(account._id, patch);

    const updated = await ctx.db.get(account._id);
    if (!updated) {
      throw new ConvexError("Failed to update verification status");
    }

    await auditLog.logChange(ctx, {
      action: "bank_account.verification_status_changed",
      actorId: args.admin_id,
      resourceType: "user_bank_accounts",
      resourceId: updated._id,
      before: previous,
      after: accountSnapshot(updated),
      severity: "warning",
    });

    await logAccountEvent(ctx, {
      userId: updated.user_id,
      accountId: updated._id,
      eventType: "verification_status_changed",
      previous,
      next: accountSnapshot(updated),
      actorAdminId: args.admin_id,
    });

    return updated;
  },
});
