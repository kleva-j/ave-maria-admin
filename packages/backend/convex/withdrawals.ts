import type { MutationCtx, QueryCtx } from "./_generated/server";
import type {
  UserBankAccountId,
  UserBankAccount,
  Withdrawal,
  User,
} from "./types";

import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getAdminUser, getUser } from "./utils";
import { auditLog } from "./auditLog";
import {
  BankAccountVerificationStatus,
  WithdrawalStatus,
  withdrawalStatus,
  RESOURCE_TYPE,
  UserStatus,
  TxnType,
} from "./shared";

const bankAccountDetailsValidator = v.object({
  account_id: v.optional(v.id("user_bank_accounts")),
  bank_name: v.string(),
  account_name: v.optional(v.string()),
  account_number_last4: v.string(),
});

const withdrawalSummaryValidator = v.object({
  _id: v.id("withdrawals"),
  transaction_id: v.id("transactions"),
  transaction_reference: v.string(),
  requested_amount_kobo: v.int64(),
  status: withdrawalStatus,
  requested_at: v.number(),
  approved_at: v.optional(v.number()),
  rejection_reason: v.optional(v.string()),
  bank_account: bankAccountDetailsValidator,
});

const adminWithdrawalSummaryValidator = v.object({
  withdrawal: withdrawalSummaryValidator,
  user: v.object({
    _id: v.id("users"),
    first_name: v.string(),
    last_name: v.string(),
    email: v.optional(v.string()),
    phone: v.string(),
    status: v.string(),
  }),
});

function createReference(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function maskBankAccount(account: UserBankAccount) {
  return {
    account_id: account._id,
    bank_name: account.bank_name,
    account_name: account.account_name,
    account_number_last4: account.account_number.slice(-4),
  };
}

function normalizeBankAccountDetails(details: unknown) {
  const fallback = {
    bank_name: "Unknown bank",
    account_name: undefined,
    account_number_last4: "----",
  };

  if (!details || typeof details !== "object") {
    return fallback;
  }

  const candidate = details as {
    account_id?: UserBankAccountId;
    bank_name?: string;
    account_name?: string;
    account_number_last4?: string;
  };

  return {
    account_id: candidate.account_id,
    bank_name: candidate.bank_name ?? fallback.bank_name,
    account_name: candidate.account_name,
    account_number_last4:
      candidate.account_number_last4 ?? fallback.account_number_last4,
  };
}

async function resolveWithdrawalBankAccount(
  ctx: MutationCtx,
  user: User,
  bankAccountId?: UserBankAccount["_id"],
) {
  if (bankAccountId) {
    const account = await ctx.db.get(bankAccountId);
    if (!account || account.user_id !== user._id) {
      throw new ConvexError("Bank account not found");
    }
    if (
      account.verification_status !== BankAccountVerificationStatus.VERIFIED
    ) {
      throw new ConvexError("Bank account must be verified for withdrawals");
    }
    return account;
  }

  const accounts = await ctx.db
    .query("user_bank_accounts")
    .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
    .collect();

  const verifiedPrimary =
    accounts.find(
      (account) =>
        account.is_primary &&
        account.verification_status === BankAccountVerificationStatus.VERIFIED,
    ) ??
    accounts.find(
      (account) =>
        account.verification_status === BankAccountVerificationStatus.VERIFIED,
    );

  if (!verifiedPrimary) {
    throw new ConvexError("Add and verify a bank account before withdrawing");
  }

  return verifiedPrimary;
}

async function applyUserBalanceDelta(
  ctx: MutationCtx,
  user: User,
  totalDelta: bigint,
  savingsDelta: bigint,
) {
  const nextTotal = user.total_balance_kobo + totalDelta;
  const nextSavings = user.savings_balance_kobo + savingsDelta;

  if (nextTotal < 0n || nextSavings < 0n) {
    throw new ConvexError("Insufficient balance");
  }

  await ctx.db.patch(user._id, {
    total_balance_kobo: nextTotal,
    savings_balance_kobo: nextSavings,
    updated_at: Date.now(),
  });
}

async function buildWithdrawalSummary(
  ctx: QueryCtx | MutationCtx,
  withdrawal: Withdrawal,
) {
  const transaction = await ctx.db.get(withdrawal.transaction_id);
  if (!transaction) {
    throw new ConvexError("Linked transaction not found");
  }

  return {
    _id: withdrawal._id,
    transaction_id: withdrawal.transaction_id,
    transaction_reference: transaction.reference,
    requested_amount_kobo: withdrawal.requested_amount_kobo,
    status: withdrawal.status,
    requested_at: withdrawal.requested_at,
    approved_at: withdrawal.approved_at,
    rejection_reason: withdrawal.rejection_reason,
    bank_account: normalizeBankAccountDetails(withdrawal.bank_account_details),
  };
}

export const listMine = query({
  args: {},
  returns: v.array(withdrawalSummaryValidator),
  handler: async (ctx) => {
    const user = await getUser(ctx);

    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_user_id_and_created_at", (q) => q.eq("user_id", user._id))
      .collect();

    const withdrawalTransactions = transactions
      .filter((transaction) => transaction.type === TxnType.WITHDRAWAL)
      .sort((a, b) => b.created_at - a.created_at);

    const summaries = await Promise.all(
      withdrawalTransactions.map(async (transaction) => {
        const withdrawal = await ctx.db
          .query("withdrawals")
          .withIndex("by_transaction_id", (q) =>
            q.eq("transaction_id", transaction._id),
          )
          .unique();

        if (!withdrawal) return null;

        return {
          _id: withdrawal._id,
          transaction_id: withdrawal.transaction_id,
          transaction_reference: transaction.reference,
          requested_amount_kobo: withdrawal.requested_amount_kobo,
          status: withdrawal.status,
          requested_at: withdrawal.requested_at,
          approved_at: withdrawal.approved_at,
          rejection_reason: withdrawal.rejection_reason,
          bank_account: normalizeBankAccountDetails(
            withdrawal.bank_account_details,
          ),
        };
      }),
    );

    return summaries.filter((withdrawal) => withdrawal !== null);
  },
});

export const listForReview = query({
  args: {
    status: v.optional(withdrawalStatus),
  },
  returns: v.array(adminWithdrawalSummaryValidator),
  handler: async (ctx, args) => {
    await getAdminUser(ctx);

    const withdrawals = args.status
      ? await ctx.db
          .query("withdrawals")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
          .collect()
      : await ctx.db.query("withdrawals").collect();

    const ordered = withdrawals.sort((a, b) => b.requested_at - a.requested_at);

    const rows = await Promise.all(
      ordered.map(async (withdrawal) => {
        const summary = await buildWithdrawalSummary(ctx, withdrawal);
        const transaction = await ctx.db.get(withdrawal.transaction_id);
        if (!transaction) {
          throw new ConvexError("Linked transaction not found");
        }

        const user = await ctx.db.get(transaction.user_id);
        if (!user) {
          throw new ConvexError("User not found for withdrawal");
        }

        return {
          withdrawal: summary,
          user: {
            _id: user._id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            phone: user.phone,
            status: user.status,
          },
        };
      }),
    );

    return rows;
  },
});

export const request = mutation({
  args: {
    amount_kobo: v.int64(),
    bank_account_id: v.optional(v.id("user_bank_accounts")),
  },
  returns: withdrawalSummaryValidator,
  handler: async (ctx, args) => {
    const user = await getUser(ctx);

    if (user.status !== UserStatus.ACTIVE) {
      throw new ConvexError("Only active users can request withdrawals");
    }

    if (args.amount_kobo <= 0n) {
      throw new ConvexError("Withdrawal amount must be greater than zero");
    }

    if (
      user.total_balance_kobo < args.amount_kobo ||
      user.savings_balance_kobo < args.amount_kobo
    ) {
      throw new ConvexError("Insufficient balance");
    }

    const bankAccount = await resolveWithdrawalBankAccount(
      ctx,
      user,
      args.bank_account_id,
    );
    const now = Date.now();
    const transactionReference = createReference("wdr");
    const bankAccountDetails = maskBankAccount(bankAccount);

    const transactionId = await ctx.db.insert("transactions", {
      user_id: user._id,
      type: TxnType.WITHDRAWAL,
      amount_kobo: -args.amount_kobo,
      reference: transactionReference,
      metadata: {
        withdrawal_status: WithdrawalStatus.PENDING,
        bank_account: bankAccountDetails,
      },
      created_at: now,
    });

    await applyUserBalanceDelta(
      ctx,
      user,
      -args.amount_kobo,
      -args.amount_kobo,
    );

    const withdrawalId = await ctx.db.insert("withdrawals", {
      transaction_id: transactionId,
      requested_amount_kobo: args.amount_kobo,
      status: WithdrawalStatus.PENDING,
      requested_at: now,
      bank_account_details: bankAccountDetails,
    });

    const withdrawal = await ctx.db.get(withdrawalId);
    if (!withdrawal) {
      throw new ConvexError("Failed to create withdrawal");
    }

    await auditLog.log(ctx, {
      action: "withdrawal.requested",
      actorId: user._id,
      resourceType: RESOURCE_TYPE.WITHDRAWALS,
      resourceId: withdrawal._id,
      severity: "info",
      metadata: {
        amount_kobo: args.amount_kobo,
        transaction_reference: transactionReference,
        bank_account: bankAccountDetails,
      },
    });

    return {
      _id: withdrawal._id,
      transaction_id: transactionId,
      transaction_reference: transactionReference,
      requested_amount_kobo: withdrawal.requested_amount_kobo,
      status: withdrawal.status,
      requested_at: withdrawal.requested_at,
      approved_at: withdrawal.approved_at,
      rejection_reason: withdrawal.rejection_reason,
      bank_account: bankAccountDetails,
    };
  },
});

export const approve = mutation({
  args: {
    withdrawal_id: v.id("withdrawals"),
  },
  returns: withdrawalSummaryValidator,
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    const withdrawal = await ctx.db.get(args.withdrawal_id);

    if (!withdrawal) {
      throw new ConvexError("Withdrawal not found");
    }

    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new ConvexError("Only pending withdrawals can be approved");
    }

    const summaryBefore = await buildWithdrawalSummary(ctx, withdrawal);
    const now = Date.now();

    await ctx.db.patch(withdrawal._id, {
      status: WithdrawalStatus.APPROVED,
      approved_by: admin._id,
      approved_at: now,
      rejection_reason: undefined,
    });

    const updated = await ctx.db.get(withdrawal._id);
    if (!updated) {
      throw new ConvexError("Failed to update withdrawal");
    }

    const summaryAfter = await buildWithdrawalSummary(ctx, updated);

    await auditLog.logChange(ctx, {
      action: "withdrawal.approved",
      actorId: admin._id,
      resourceType: RESOURCE_TYPE.WITHDRAWALS,
      resourceId: updated._id,
      before: summaryBefore,
      after: summaryAfter,
      severity: "info",
    });

    return summaryAfter;
  },
});

export const reject = mutation({
  args: {
    withdrawal_id: v.id("withdrawals"),
    reason: v.string(),
  },
  returns: withdrawalSummaryValidator,
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    const withdrawal = await ctx.db.get(args.withdrawal_id);

    if (!withdrawal) {
      throw new ConvexError("Withdrawal not found");
    }

    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new ConvexError("Only pending withdrawals can be rejected");
    }

    const transaction = await ctx.db.get(withdrawal.transaction_id);
    if (!transaction) {
      throw new ConvexError("Linked transaction not found");
    }

    const user = await ctx.db.get(transaction.user_id);
    if (!user) {
      throw new ConvexError("User not found for withdrawal");
    }

    const summaryBefore = await buildWithdrawalSummary(ctx, withdrawal);
    const now = Date.now();
    const reversalReference = createReference("rev");

    await ctx.db.insert("transactions", {
      user_id: user._id,
      type: TxnType.REVERSAL,
      amount_kobo: withdrawal.requested_amount_kobo,
      reference: reversalReference,
      metadata: {
        original_transaction_id: transaction._id,
        original_reference: transaction.reference,
        withdrawal_id: withdrawal._id,
        reason: args.reason,
      },
      created_at: now,
    });

    await applyUserBalanceDelta(
      ctx,
      user,
      withdrawal.requested_amount_kobo,
      withdrawal.requested_amount_kobo,
    );

    await ctx.db.patch(withdrawal._id, {
      status: WithdrawalStatus.REJECTED,
      rejection_reason: args.reason,
    });

    const updated = await ctx.db.get(withdrawal._id);
    if (!updated) {
      throw new ConvexError("Failed to update withdrawal");
    }

    const summaryAfter = await buildWithdrawalSummary(ctx, updated);

    await auditLog.logChange(ctx, {
      action: "withdrawal.rejected",
      actorId: admin._id,
      resourceType: RESOURCE_TYPE.WITHDRAWALS,
      resourceId: updated._id,
      before: summaryBefore,
      after: {
        ...summaryAfter,
        reversal_reference: reversalReference,
      },
      severity: "warning",
    });

    return summaryAfter;
  },
});

export const process = mutation({
  args: {
    withdrawal_id: v.id("withdrawals"),
  },
  returns: withdrawalSummaryValidator,
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    const withdrawal = await ctx.db.get(args.withdrawal_id);

    if (!withdrawal) {
      throw new ConvexError("Withdrawal not found");
    }

    if (withdrawal.status !== WithdrawalStatus.APPROVED) {
      throw new ConvexError("Only approved withdrawals can be processed");
    }

    const summaryBefore = await buildWithdrawalSummary(ctx, withdrawal);

    await ctx.db.patch(withdrawal._id, {
      status: WithdrawalStatus.PROCESSED,
    });

    const updated = await ctx.db.get(withdrawal._id);
    if (!updated) {
      throw new ConvexError("Failed to update withdrawal");
    }

    const summaryAfter = await buildWithdrawalSummary(ctx, updated);

    await auditLog.logChange(ctx, {
      action: "withdrawal.processed",
      actorId: admin._id,
      resourceType: RESOURCE_TYPE.WITHDRAWALS,
      resourceId: updated._id,
      before: summaryBefore,
      after: summaryAfter,
      severity: "info",
    });

    return summaryAfter;
  },
});
