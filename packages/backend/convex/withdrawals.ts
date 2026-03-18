import type { MutationCtx } from "./_generated/server";
import type {
  UserBankAccountId,
  UserBankAccount,
  Withdrawal,
  Context,
  User,
} from "./types";

import { ConvexError, v } from "convex/values";

import { postTransactionEntry, reverseTransactionEntry } from "./transactions";
import { mutation, query } from "./_generated/server";
import { getAdminUser, getUser } from "./utils";
import { auditLog } from "./auditLog";
import {
  BankAccountVerificationStatus,
  TransactionSource,
  WithdrawalMethod,
  withdrawalMethod,
  WithdrawalStatus,
  withdrawalStatus,
  WithdrawalAction,
  RESOURCE_TYPE,
  TABLE_NAMES,
  UserStatus,
  AdminRole,
  TxnType,
} from "./shared";

const cashWithdrawalAllowedRoles = [
  AdminRole.SUPER_ADMIN,
  AdminRole.OPERATIONS,
  AdminRole.FINANCE,
] as const;

const cashWithdrawalAdminRoles = new Set<string>(cashWithdrawalAllowedRoles);

const withdrawalActionPastTense = {
  [WithdrawalAction.APPROVE]: WithdrawalStatus.APPROVED,
  [WithdrawalAction.REJECT]: WithdrawalStatus.REJECTED,
  [WithdrawalAction.PROCESS]: WithdrawalStatus.PROCESSED,
} as const;

const bankAccountDetailsValidator = v.object({
  account_id: v.optional(v.id("user_bank_accounts")),
  bank_name: v.string(),
  account_name: v.optional(v.string()),
  account_number_last4: v.string(),
});

const cashDetailsValidator = v.object({
  recipient_name: v.string(),
  recipient_phone: v.string(),
  pickup_note: v.optional(v.string()),
});

const withdrawalActionCapabilityValidator = v.object({
  allowed: v.boolean(),
  reason: v.optional(v.string()),
});

const withdrawalCapabilitiesValidator = v.object({
  approve: withdrawalActionCapabilityValidator,
  reject: withdrawalActionCapabilityValidator,
  process: withdrawalActionCapabilityValidator,
});

const withdrawalSummaryValidator = v.object({
  _id: v.id("withdrawals"),
  transaction_id: v.id("transactions"),
  transaction_reference: v.string(),
  requested_amount_kobo: v.int64(),
  method: withdrawalMethod,
  status: withdrawalStatus,
  requested_at: v.number(),
  approved_at: v.optional(v.number()),
  rejection_reason: v.optional(v.string()),
  bank_account: v.optional(bankAccountDetailsValidator),
  cash_details: v.optional(cashDetailsValidator),
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
  capabilities: withdrawalCapabilitiesValidator,
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

function buildCashDetails(user: User, pickupNote?: string) {
  return {
    recipient_name: [user.first_name, user.last_name]
      .filter(Boolean)
      .join(" ")
      .trim(),
    recipient_phone: user.phone,
    pickup_note: pickupNote?.trim() || undefined,
  };
}

function normalizeWithdrawalMethod(method: unknown) {
  return method === WithdrawalMethod.CASH
    ? WithdrawalMethod.CASH
    : WithdrawalMethod.BANK_TRANSFER;
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

function normalizeCashDetails(details: unknown) {
  if (!details || typeof details !== "object") {
    return undefined;
  }

  const candidate = details as {
    recipient_name?: string;
    recipient_phone?: string;
    pickup_note?: string;
  };

  if (!candidate.recipient_name || !candidate.recipient_phone) {
    return undefined;
  }

  return {
    recipient_name: candidate.recipient_name,
    recipient_phone: candidate.recipient_phone,
    pickup_note: candidate.pickup_note,
  };
}

function getCashWithdrawalRoleBlockedMessage(action: WithdrawalAction) {
  return `Cash withdrawals can only be ${withdrawalActionPastTense[action]} by Finance, Operations, or Super Admin.`;
}

function getCashWithdrawalForbiddenData(action: WithdrawalAction) {
  return {
    code: "withdrawal_action_forbidden" as const,
    action,
    method: WithdrawalMethod.CASH,
    allowed_roles: [...cashWithdrawalAllowedRoles],
    message: getCashWithdrawalRoleBlockedMessage(action),
  };
}

function getWithdrawalStatusBlockedReason(
  withdrawal: Withdrawal,
  action: WithdrawalAction
) {
  switch (action) {
    case WithdrawalAction.APPROVE:
      return withdrawal.status === WithdrawalStatus.PENDING
        ? undefined
        : "Only pending withdrawals can be approved";
    case WithdrawalAction.REJECT:
      return withdrawal.status === WithdrawalStatus.PENDING
        ? undefined
        : "Only pending withdrawals can be rejected";
    case WithdrawalAction.PROCESS:
      return withdrawal.status === WithdrawalStatus.APPROVED
        ? undefined
        : "Only approved withdrawals can be processed";
  }
}

function getCashWithdrawalRoleBlockedReason(
  adminRole: AdminRole,
  withdrawal: Withdrawal,
  action: WithdrawalAction
) {
  if (normalizeWithdrawalMethod(withdrawal.method) !== WithdrawalMethod.CASH) {
    return undefined;
  }

  if (cashWithdrawalAdminRoles.has(adminRole)) {
    return undefined;
  }

  return getCashWithdrawalRoleBlockedMessage(action);
}

function buildWithdrawalActionCapability(
  adminRole: AdminRole,
  withdrawal: Withdrawal,
  action: WithdrawalAction
) {
  const statusReason = getWithdrawalStatusBlockedReason(withdrawal, action);
  if (statusReason) {
    return {
      allowed: false,
      reason: statusReason,
    };
  }

  const roleReason = getCashWithdrawalRoleBlockedReason(
    adminRole,
    withdrawal,
    action
  );
  if (roleReason) {
    return {
      allowed: false,
      reason: roleReason,
    };
  }

  return {
    allowed: true,
  };
}

function buildWithdrawalCapabilities(
  adminRole: AdminRole,
  withdrawal: Withdrawal
) {
  return {
    approve: buildWithdrawalActionCapability(
      adminRole,
      withdrawal,
      WithdrawalAction.APPROVE
    ),
    reject: buildWithdrawalActionCapability(
      adminRole,
      withdrawal,
      WithdrawalAction.REJECT
    ),
    process: buildWithdrawalActionCapability(
      adminRole,
      withdrawal,
      WithdrawalAction.PROCESS
    ),
  };
}

function assertCashWithdrawalRole(
  adminRole: AdminRole,
  action: WithdrawalAction
) {
  if (cashWithdrawalAdminRoles.has(adminRole)) {
    return;
  }

  throw new ConvexError(getCashWithdrawalForbiddenData(action));
}

function assertAdminCanHandleCashWithdrawal(
  adminRole: AdminRole,
  withdrawal: Withdrawal,
  action: WithdrawalAction
) {
  if (normalizeWithdrawalMethod(withdrawal.method) !== WithdrawalMethod.CASH) {
    return;
  }

  assertCashWithdrawalRole(adminRole, action);
}

async function resolveWithdrawalBankAccount(
  ctx: MutationCtx,
  user: User,
  bankAccountId?: UserBankAccountId
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
    .query(TABLE_NAMES.USER_BANK_ACCOUNTS)
    .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
    .collect();

  const verifiedPrimary =
    accounts.find(
      (account) =>
        account.is_primary &&
        account.verification_status === BankAccountVerificationStatus.VERIFIED
    ) ??
    accounts.find(
      (account) =>
        account.verification_status === BankAccountVerificationStatus.VERIFIED
    );

  if (!verifiedPrimary) {
    throw new ConvexError("Add and verify a bank account before withdrawing");
  }

  return verifiedPrimary;
}

async function buildWithdrawalSummary(ctx: Context, withdrawal: Withdrawal) {
  const transaction = await ctx.db.get(withdrawal.transaction_id);
  if (!transaction) {
    throw new ConvexError("Linked transaction not found");
  }

  const method = normalizeWithdrawalMethod(
    (withdrawal as Withdrawal & { method?: unknown }).method
  );

  return {
    _id: withdrawal._id,
    transaction_id: withdrawal.transaction_id,
    transaction_reference: transaction.reference,
    requested_amount_kobo: withdrawal.requested_amount_kobo,
    method,
    status: withdrawal.status,
    requested_at: withdrawal.requested_at,
    approved_at: withdrawal.approved_at,
    rejection_reason: withdrawal.rejection_reason,
    bank_account:
      method === WithdrawalMethod.BANK_TRANSFER
        ? normalizeBankAccountDetails(withdrawal.bank_account_details)
        : undefined,
    cash_details:
      method === WithdrawalMethod.CASH
        ? normalizeCashDetails(
            (withdrawal as Withdrawal & { cash_details?: unknown }).cash_details
          )
        : undefined,
  };
}

export const listMine = query({
  args: {},
  returns: v.array(withdrawalSummaryValidator),
  handler: async (ctx) => {
    const user = await getUser(ctx);

    const transactions = await ctx.db
      .query(TABLE_NAMES.TRANSACTIONS)
      .withIndex("by_user_id_and_created_at", (q) => q.eq("user_id", user._id))
      .collect();

    const withdrawalTransactions = transactions
      .filter((transaction) => transaction.type === TxnType.WITHDRAWAL)
      .sort((a, b) => b.created_at - a.created_at);

    const summaries = await Promise.all(
      withdrawalTransactions.map(async (transaction) => {
        const withdrawal = await ctx.db
          .query(TABLE_NAMES.WITHDRAWALS)
          .withIndex("by_transaction_id", (q) =>
            q.eq("transaction_id", transaction._id)
          )
          .unique();

        if (!withdrawal) return null;

        return buildWithdrawalSummary(ctx, withdrawal);
      })
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
    const admin = await getAdminUser(ctx);

    const withdrawals = args.status
      ? await ctx.db
          .query(TABLE_NAMES.WITHDRAWALS)
          .withIndex("by_status", (q) => q.eq("status", args.status!))
          .collect()
      : await ctx.db.query(TABLE_NAMES.WITHDRAWALS).collect();

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
          capabilities: buildWithdrawalCapabilities(admin.role, withdrawal),
        };
      })
    );

    return rows;
  },
});

export const request = mutation({
  args: {
    amount_kobo: v.int64(),
    method: v.optional(withdrawalMethod),
    bank_account_id: v.optional(v.id("user_bank_accounts")),
    pickup_note: v.optional(v.string()),
  },
  returns: withdrawalSummaryValidator,
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const method = args.method ?? WithdrawalMethod.BANK_TRANSFER;

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

    const now = Date.now();
    const transactionReference = createReference(
      method === WithdrawalMethod.CASH ? "cwdr" : "wdr"
    );
    let bankAccountDetails: ReturnType<typeof maskBankAccount> | undefined =
      undefined;
    let cashDetails: ReturnType<typeof buildCashDetails> | undefined =
      undefined;

    if (method === WithdrawalMethod.BANK_TRANSFER) {
      const bankAccount = await resolveWithdrawalBankAccount(
        ctx,
        user,
        args.bank_account_id
      );
      bankAccountDetails = maskBankAccount(bankAccount);
    } else {
      if (args.bank_account_id) {
        throw new ConvexError("Cash withdrawals do not require a bank account");
      }
      cashDetails = buildCashDetails(user, args.pickup_note);
    }

    const postedTransaction = await postTransactionEntry(ctx, {
      userId: user._id,
      type: TxnType.WITHDRAWAL,
      amountKobo: -args.amount_kobo,
      reference: transactionReference,
      metadata: {
        withdrawal_status: WithdrawalStatus.PENDING,
        method,
        bank_account: bankAccountDetails,
        cash_details: cashDetails,
      },
      source: TransactionSource.USER,
      actorId: user._id,
      createdAt: now,
    });

    const withdrawalId = await ctx.db.insert(TABLE_NAMES.WITHDRAWALS, {
      transaction_id: postedTransaction.transaction._id,
      requested_amount_kobo: args.amount_kobo,
      method,
      status: WithdrawalStatus.PENDING,
      requested_at: now,
      bank_account_details: bankAccountDetails,
      cash_details: cashDetails,
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
        method,
        transaction_reference: transactionReference,
        bank_account: bankAccountDetails,
        cash_details: cashDetails,
      },
    });

    return {
      _id: withdrawal._id,
      transaction_id: postedTransaction.transaction._id,
      transaction_reference: transactionReference,
      requested_amount_kobo: withdrawal.requested_amount_kobo,
      method,
      status: withdrawal.status,
      requested_at: withdrawal.requested_at,
      approved_at: withdrawal.approved_at,
      rejection_reason: withdrawal.rejection_reason,
      bank_account: bankAccountDetails,
      cash_details: cashDetails,
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

    assertAdminCanHandleCashWithdrawal(
      admin.role,
      withdrawal,
      WithdrawalAction.APPROVE
    );

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

    assertAdminCanHandleCashWithdrawal(
      admin.role,
      withdrawal,
      WithdrawalAction.REJECT
    );

    const transaction = await ctx.db.get(withdrawal.transaction_id);
    if (!transaction) {
      throw new ConvexError("Linked transaction not found");
    }

    const summaryBefore = await buildWithdrawalSummary(ctx, withdrawal);
    const now = Date.now();
    const reversalReference = createReference("rev");

    await reverseTransactionEntry(ctx, {
      originalTransactionId: transaction._id,
      reference: reversalReference,
      reason: args.reason,
      metadata: {
        withdrawal_id: String(withdrawal._id),
      },
      source: TransactionSource.ADMIN,
      actorId: admin._id,
      createdAt: now,
    });

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

    assertAdminCanHandleCashWithdrawal(
      admin.role,
      withdrawal,
      WithdrawalAction.PROCESS
    );

    const summaryBefore = await buildWithdrawalSummary(ctx, withdrawal);

    await ctx.db.patch(withdrawal._id, { status: WithdrawalStatus.PROCESSED });

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
