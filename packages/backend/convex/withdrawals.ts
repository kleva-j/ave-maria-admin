import type { PostTransactionOutput } from "@avm-daily/application/dto";

import type { MutationCtx } from "./_generated/server";
import type { AdminRole } from "./shared";
import type {
  UserBankAccountId,
  UserSavingsPlanId,
  TransactionId,
  WithdrawalId,
  AdminUserId,
  Withdrawal,
  Context,
  UserId,
  User,
} from "./types";

import { DomainError } from "@avm-daily/domain";
import { ConvexError, v } from "convex/values";
import {
  createApproveWithdrawalUseCase,
  createProcessWithdrawalUseCase,
  createRequestWithdrawalUseCase,
  createRejectWithdrawalUseCase,
} from "@avm-daily/application/use-cases";

import { createConvexWithdrawalReservationRepository } from "./adapters/withdrawalReservationAdapter";
import { createManualWithdrawalPayoutService } from "./adapters/withdrawalPayoutAdapter";
import { createConvexBankAccountRepository } from "./adapters/bankAccountAdapter";
import { syncWithdrawalInsert, syncWithdrawalUpdate } from "./aggregateHelpers";
import { createConvexWithdrawalRepository } from "./adapters/withdrawalAdapter";
import { createConvexAuditLogService } from "./adapters/auditLogAdapter";
import { createConvexUserRepository } from "./adapters/userAdapters";
import { postTransactionEntry } from "./transactions";
import { mutation, query } from "./_generated/server";
import { getAdminUser, getUser } from "./utils";

import {
  assertWithdrawalAdminActionAllowed,
  assertWithdrawalRequestAllowed,
  withdrawalRiskSummaryValidator,
  buildWithdrawalRiskSummary,
} from "./risk";

import {
  WithdrawalAction,
  WithdrawalMethod,
  WithdrawalStatus,
  withdrawalMethod,
  withdrawalStatus,
  TABLE_NAMES,
  UserStatus,
} from "./shared";

import {
  getCashWithdrawalRoleBlockedMessage,
  getCashWithdrawalForbiddenData,
  buildWithdrawalCapabilities,
} from "./withdrawalPolicy";

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
  reference: v.string(),
  transaction_id: v.optional(v.id("transactions")),
  transaction_reference: v.optional(v.string()),
  requested_amount_kobo: v.int64(),
  method: withdrawalMethod,
  status: withdrawalStatus,
  requested_at: v.number(),
  requested_by: v.id("users"),
  approved_at: v.optional(v.number()),
  processed_at: v.optional(v.number()),
  rejection_reason: v.optional(v.string()),
  payout_provider: v.optional(v.string()),
  payout_reference: v.optional(v.string()),
  last_processing_error: v.optional(v.string()),
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
  risk: withdrawalRiskSummaryValidator,
  capabilities: withdrawalCapabilitiesValidator,
});

function normalizeBankAccountDetails(details: unknown): {
  account_id?: UserBankAccountId;
  bank_name: string;
  account_name?: string;
  account_number_last4: string;
} {
  const fallback = {
    account_id: undefined,
    bank_name: "Unknown bank",
    account_name: undefined,
    account_number_last4: "----",
  };

  if (!details || typeof details !== "object") {
    return fallback;
  }

  const candidate = details as {
    account_id?: string;
    bank_name?: string;
    account_name?: string;
    account_number_last4?: string;
  };

  return {
    account_id: candidate.account_id as UserBankAccountId | undefined,
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

function normalizeWithdrawalMethodValue(withdrawal: Withdrawal) {
  switch (withdrawal.method) {
    case WithdrawalMethod.CASH:
      return WithdrawalMethod.CASH;
    case undefined:
    case WithdrawalMethod.BANK_TRANSFER:
      return WithdrawalMethod.BANK_TRANSFER;
    default:
      throw new Error(`Unknown withdrawal method: ${String(withdrawal.method)}`);
  }
}

function fallbackWithdrawalReference(
  withdrawal: Withdrawal,
  transaction?: { reference: string } | null,
) {
  return (
    withdrawal.reference ??
    transaction?.reference ??
    `legacy_${String(withdrawal._id)}`
  );
}

function toUserId(id: string): UserId {
  return id as UserId;
}

function toAdminUserId(id: string): AdminUserId {
  return id as AdminUserId;
}

function toOptionalUserSavingsPlanId(
  id?: string,
): UserSavingsPlanId | undefined {
  return id ? (id as UserSavingsPlanId) : undefined;
}

function toOptionalTransactionId(id?: string): TransactionId | undefined {
  return id ? (id as TransactionId) : undefined;
}

function toPostTransactionOutput(
  result: Awaited<ReturnType<typeof postTransactionEntry>>,
): PostTransactionOutput {
  const metadata = result.transaction.metadata;
  const normalizedMetadata =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...metadata }
      : {};

  if (Array.isArray(metadata)) {
    console.warn(
      "[withdrawals] transaction metadata was an array; coercing to empty object",
      {
        reference: result.transaction.reference,
        length: metadata.length,
        preview: JSON.stringify(metadata.slice(0, 3)),
      },
    );
  }

  return {
    idempotent: result.idempotent,
    transaction: {
      _id: String(result.transaction._id),
      user_id: String(result.transaction.user_id),
      user_plan_id: result.transaction.user_plan_id
        ? String(result.transaction.user_plan_id)
        : undefined,
      type: result.transaction.type,
      amount_kobo: result.transaction.amount_kobo,
      reference: result.transaction.reference,
      reversal_of_transaction_id: result.transaction.reversal_of_transaction_id
        ? String(result.transaction.reversal_of_transaction_id)
        : undefined,
      reversal_of_reference: result.transaction.reversal_of_reference,
      reversal_of_type: result.transaction.reversal_of_type,
      metadata: normalizedMetadata,
      created_at: result.transaction.created_at,
    },
  };
}

async function buildWithdrawalSummary(ctx: Context, withdrawal: Withdrawal) {
  const transaction = withdrawal.transaction_id
    ? await ctx.db.get(withdrawal.transaction_id)
    : null;
  const method = normalizeWithdrawalMethodValue(withdrawal);

  return {
    _id: withdrawal._id,
    reference: fallbackWithdrawalReference(withdrawal, transaction),
    transaction_id: withdrawal.transaction_id,
    transaction_reference: transaction?.reference,
    requested_amount_kobo: withdrawal.requested_amount_kobo,
    method,
    status: withdrawal.status,
    requested_at: withdrawal.requested_at,
    requested_by: withdrawal.requested_by,
    approved_at: withdrawal.approved_at,
    processed_at: withdrawal.processed_at,
    rejection_reason: withdrawal.rejection_reason,
    payout_provider: withdrawal.payout_provider,
    payout_reference: withdrawal.payout_reference,
    last_processing_error: withdrawal.last_processing_error,
    bank_account:
      method === WithdrawalMethod.BANK_TRANSFER
        ? normalizeBankAccountDetails(withdrawal.bank_account_details)
        : undefined,
    cash_details:
      method === WithdrawalMethod.CASH
        ? normalizeCashDetails(withdrawal.cash_details)
        : undefined,
  };
}

function toConvexError(error: unknown): never {
  if (error instanceof DomainError) {
    throw new ConvexError({ code: error.code, message: error.message });
  }

  throw error;
}

async function assertAdminCanHandleAction(
  ctx: MutationCtx,
  input: {
    userId: string;
    adminId: string;
    adminRole: AdminRole;
    action: (typeof WithdrawalAction)[keyof typeof WithdrawalAction];
    withdrawal: {
      status: (typeof WithdrawalStatus)[keyof typeof WithdrawalStatus];
      method: (typeof WithdrawalMethod)[keyof typeof WithdrawalMethod];
    };
  },
) {
  const risk = await buildWithdrawalRiskSummary(ctx, toUserId(input.userId));
  const capabilities = buildWithdrawalCapabilities(
    input.adminRole,
    {
      status: input.withdrawal.status,
      method: input.withdrawal.method,
    },
    risk,
  );
  const capability = capabilities[input.action];
  const cashRoleBlocked =
    !capability.allowed &&
    capability.reason === getCashWithdrawalRoleBlockedMessage(input.action);
  if (cashRoleBlocked) {
    throw new ConvexError(getCashWithdrawalForbiddenData(input.action));
  }

  if (
    input.action === WithdrawalAction.APPROVE ||
    input.action === WithdrawalAction.PROCESS
  ) {
    await assertWithdrawalAdminActionAllowed(ctx, {
      userId: toUserId(input.userId),
      actorAdminId: toAdminUserId(input.adminId),
    });
  }

  if (!capability.allowed) {
    throw new ConvexError({
      code: "withdrawal_action_blocked",
      action: input.action,
      message: capability.reason ?? "Withdrawal action is blocked",
    });
  }
}

async function getWithdrawalDocOrThrow(
  ctx: MutationCtx,
  withdrawalId: WithdrawalId,
) {
  const withdrawal = await ctx.db.get(withdrawalId);
  if (!withdrawal) {
    throw new ConvexError("Withdrawal not found");
  }

  return withdrawal;
}

function buildRequestWithdrawalUseCase(ctx: MutationCtx) {
  return createRequestWithdrawalUseCase({
    userRepository: createConvexUserRepository(ctx),
    withdrawalRepository: createConvexWithdrawalRepository(ctx),
    withdrawalReservationRepository:
      createConvexWithdrawalReservationRepository(ctx),
    bankAccountRepository: createConvexBankAccountRepository(ctx),
    auditLogService: createConvexAuditLogService(ctx),
    assertWithdrawalAllowed: async (input) => {
      const user = await ctx.db.get(toUserId(input.userId));
      if (!user) {
        throw new ConvexError("User not found");
      }

      await assertWithdrawalRequestAllowed(ctx, {
        user: user as User,
        method: input.method,
        amountKobo: input.amountKobo,
        now: input.now ?? Date.now(),
      });
    },
  });
}

function buildAdminActionAssertion(ctx: MutationCtx) {
  return async (input: {
    userId: string;
    adminId: string;
    adminRole: AdminRole;
    action: (typeof WithdrawalAction)[keyof typeof WithdrawalAction];
    withdrawal: {
      status: (typeof WithdrawalStatus)[keyof typeof WithdrawalStatus];
      method: (typeof WithdrawalMethod)[keyof typeof WithdrawalMethod];
    };
  }) => {
    await assertAdminCanHandleAction(ctx, input);
  };
}

export const listMine = query({
  args: {},
  returns: v.array(withdrawalSummaryValidator),
  handler: async (ctx) => {
    const user = await getUser(ctx);

    const withdrawals = await ctx.db
      .query(TABLE_NAMES.WITHDRAWALS)
      .withIndex("by_requested_by_and_requested_at", (q) =>
        q.eq("requested_by", user._id),
      )
      .order("desc")
      .collect();

    return await Promise.all(
      withdrawals.map((withdrawal) => buildWithdrawalSummary(ctx, withdrawal)),
    );
  },
});

export const listForReview = query({
  args: {
    status: v.optional(withdrawalStatus),
  },
  returns: v.array(adminWithdrawalSummaryValidator),
  handler: async (ctx, { status }) => {
    const admin = await getAdminUser(ctx);

    const withdrawals = status
      ? await ctx.db
          .query(TABLE_NAMES.WITHDRAWALS)
          .withIndex("by_status", (q) => q.eq("status", status))
          .collect()
      : await ctx.db.query(TABLE_NAMES.WITHDRAWALS).collect();

    const ordered = withdrawals.sort((a, b) => b.requested_at - a.requested_at);

    return await Promise.all(
      ordered.map(async (withdrawal) => {
        const summary = await buildWithdrawalSummary(ctx, withdrawal);
        const user = await ctx.db.get(withdrawal.requested_by);
        if (!user) {
          throw new ConvexError("User not found for withdrawal");
        }

        const risk = await buildWithdrawalRiskSummary(
          ctx,
          withdrawal.requested_by,
        );

        return {
          withdrawal: summary,
          user: {
            _id: user._id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email ?? undefined,
            phone: user.phone,
            status: user.status,
          },
          risk,
          capabilities: buildWithdrawalCapabilities(
            admin.role,
            {
              status: withdrawal.status,
              method: normalizeWithdrawalMethodValue(withdrawal),
            },
            risk,
          ),
        };
      }),
    );
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

    if (user.status !== UserStatus.ACTIVE) {
      throw new ConvexError("Only active users can request withdrawals");
    }

    try {
      const requestWithdrawal = buildRequestWithdrawalUseCase(ctx);
      const result = await requestWithdrawal({
        userId: String(user._id),
        amountKobo: args.amount_kobo,
        method: args.method,
        bankAccountId: args.bank_account_id
          ? String(args.bank_account_id)
          : undefined,
        pickupNote: args.pickup_note,
      });

      const created = await getWithdrawalDocOrThrow(
        ctx,
        result.withdrawal._id as WithdrawalId,
      );
      await syncWithdrawalInsert(ctx, created);

      return await buildWithdrawalSummary(ctx, created);
    } catch (error) {
      toConvexError(error);
    }
  },
});

export const approve = mutation({
  args: {
    withdrawal_id: v.id("withdrawals"),
  },
  returns: withdrawalSummaryValidator,
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    const before = await getWithdrawalDocOrThrow(ctx, args.withdrawal_id);

    try {
      const approveWithdrawal = createApproveWithdrawalUseCase({
        withdrawalRepository: createConvexWithdrawalRepository(ctx),
        auditLogService: createConvexAuditLogService(ctx),
        assertAdminActionAllowed: buildAdminActionAssertion(ctx),
      });

      const updated = await approveWithdrawal({
        withdrawalId: String(args.withdrawal_id),
        adminId: String(admin._id),
        adminRole: admin.role,
      });

      const after = await getWithdrawalDocOrThrow(
        ctx,
        updated._id as WithdrawalId,
      );
      await syncWithdrawalUpdate(ctx, before, after);
      return await buildWithdrawalSummary(ctx, after);
    } catch (error) {
      toConvexError(error);
    }
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
    const before = await getWithdrawalDocOrThrow(ctx, args.withdrawal_id);

    try {
      const rejectWithdrawal = createRejectWithdrawalUseCase({
        withdrawalRepository: createConvexWithdrawalRepository(ctx),
        withdrawalReservationRepository:
          createConvexWithdrawalReservationRepository(ctx),
        auditLogService: createConvexAuditLogService(ctx),
        assertAdminActionAllowed: buildAdminActionAssertion(ctx),
      });

      const result = await rejectWithdrawal({
        withdrawalId: String(args.withdrawal_id),
        adminId: String(admin._id),
        adminRole: admin.role,
        reason: args.reason,
      });

      const after = await getWithdrawalDocOrThrow(
        ctx,
        result.withdrawal._id as WithdrawalId,
      );
      await syncWithdrawalUpdate(ctx, before, after);
      return await buildWithdrawalSummary(ctx, after);
    } catch (error) {
      toConvexError(error);
    }
  },
});

export const process = mutation({
  args: { withdrawal_id: v.id("withdrawals") },
  returns: withdrawalSummaryValidator,
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    const before = await getWithdrawalDocOrThrow(ctx, args.withdrawal_id);

    try {
      const processWithdrawal = createProcessWithdrawalUseCase({
        withdrawalRepository: createConvexWithdrawalRepository(ctx),
        withdrawalReservationRepository:
          createConvexWithdrawalReservationRepository(ctx),
        payoutService: createManualWithdrawalPayoutService(),
        postTransaction: async (input) =>
          toPostTransactionOutput(
            await postTransactionEntry(ctx, {
              userId: toUserId(input.userId),
              userPlanId: toOptionalUserSavingsPlanId(input.userPlanId),
              type: input.type,
              amountKobo: input.amountKobo,
              reference: input.reference,
              metadata: input.metadata,
              source: input.source,
              actorId: input.actorId ? toAdminUserId(input.actorId) : undefined,
              createdAt: input.createdAt,
              reversalOfTransactionId: toOptionalTransactionId(
                input.reversalOfTransactionId,
              ),
            }),
          ),
        auditLogService: createConvexAuditLogService(ctx),
        assertAdminActionAllowed: buildAdminActionAssertion(ctx),
      });

      const result = await processWithdrawal({
        withdrawalId: String(args.withdrawal_id),
        adminId: String(admin._id),
        adminRole: admin.role,
      });

      const after = await getWithdrawalDocOrThrow(
        ctx,
        result.withdrawal._id as WithdrawalId,
      );
      await syncWithdrawalUpdate(ctx, before, after);
      return await buildWithdrawalSummary(ctx, after);
    } catch (error) {
      toConvexError(error);
    }
  },
});
