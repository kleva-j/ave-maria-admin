import type { MutationCtx } from "./_generated/server";
import type {
  UserSavingsPlanId,
  UserSavingsPlan,
  TransactionId,
  AdminUserId,
  Transaction,
  Context,
  UserId,
  User,
} from "./types";

import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";

import { internalMutation, query } from "./_generated/server";
import { getAdminUser, getUser } from "./utils";
import { auditLog } from "./auditLog";

import {
  syncReconciliationIssueInsert,
  syncReconciliationIssueUpdate,
  syncTransactionInsert,
} from "./aggregateHelpers";

import {
  TransactionReconciliationIssueStatus,
  TransactionReconciliationIssueType,
  TransactionReconciliationRunStatus,
  transactionSource,
  TransactionSource,
  WithdrawalMethod,
  RESOURCE_TYPE,
  TABLE_NAMES,
  TxnType,
  txnType,
} from "./shared";

const transactionActorIdValidator = v.optional(
  v.union(v.id("users"), v.id("admin_users"))
);

const transactionMetadataSummaryValidator = v.object({
  source: v.optional(transactionSource),
  actor_id: v.optional(v.string()),
  channel: v.optional(v.string()),
  origin_reference: v.optional(v.string()),
  note: v.optional(v.string()),
  run_id: v.optional(v.string()),
  rate: v.optional(v.number()),
  period_start: v.optional(v.string()),
  period_end: v.optional(v.string()),
  referrer_user_id: v.optional(v.string()),
  referred_user_id: v.optional(v.string()),
  trigger_transaction_reference: v.optional(v.string()),
  withdrawal_status: v.optional(v.string()),
  method: v.optional(v.string()),
  original_transaction_id: v.optional(v.string()),
  original_reference: v.optional(v.string()),
  original_type: v.optional(txnType),
  reason: v.optional(v.string()),
});

const transactionSummaryValidator = v.object({
  _id: v.id("transactions"),
  user_id: v.id("users"),
  user_plan_id: v.optional(v.id("user_savings_plans")),
  type: txnType,
  amount_kobo: v.int64(),
  reference: v.string(),
  reversal_of_transaction_id: v.optional(v.id("transactions")),
  reversal_of_reference: v.optional(v.string()),
  reversal_of_type: v.optional(txnType),
  created_at: v.number(),
  metadata_summary: transactionMetadataSummaryValidator,
});

const paginatedTransactionsValidator = v.object({
  page: v.array(transactionSummaryValidator),
  continueCursor: v.string(),
  isDone: v.boolean(),
});

const reconciliationRunValidator = v.object({
  _id: v.id("transaction_reconciliation_runs"),
  _creationTime: v.number(),
  status: v.string(),
  started_at: v.number(),
  completed_at: v.optional(v.number()),
  issue_count: v.number(),
  user_count: v.number(),
  plan_count: v.number(),
  transaction_count: v.number(),
  created_at: v.number(),
});

const reconciliationIssueValidator = v.object({
  _id: v.id("transaction_reconciliation_issues"),
  _creationTime: v.number(),
  run_id: v.id("transaction_reconciliation_runs"),
  issue_type: v.string(),
  issue_status: v.string(),
  user_id: v.optional(v.id("users")),
  user_plan_id: v.optional(v.id("user_savings_plans")),
  transaction_id: v.optional(v.id("transactions")),
  reference: v.optional(v.string()),
  expected_amount_kobo: v.optional(v.int64()),
  actual_amount_kobo: v.optional(v.int64()),
  details: v.optional(v.any()),
  created_at: v.number(),
  resolved_at: v.optional(v.number()),
});

const postArgsValidator = {
  userId: v.id("users"),
  userPlanId: v.optional(v.id("user_savings_plans")),
  type: txnType,
  amountKobo: v.int64(),
  reference: v.string(),
  metadata: v.optional(v.any()),
  source: transactionSource,
  actorId: transactionActorIdValidator,
  createdAt: v.optional(v.number()),
  reversalOfTransactionId: v.optional(v.id("transactions")),
};

const reverseArgsValidator = {
  originalTransactionId: v.id("transactions"),
  reference: v.string(),
  reason: v.string(),
  metadata: v.optional(v.any()),
  source: transactionSource,
  actorId: transactionActorIdValidator,
  createdAt: v.optional(v.number()),
};

type TransactionActorId = UserId | AdminUserId;

type TransactionPostArgs = {
  userId: UserId;
  userPlanId?: UserSavingsPlanId;
  type: TxnType;
  amountKobo: bigint;
  reference: string;
  metadata?: unknown;
  source: TransactionSource;
  actorId?: TransactionActorId;
  createdAt?: number;
  reversalOfTransactionId?: TransactionId;
};

type TransactionReverseArgs = {
  originalTransactionId: TransactionId;
  reference: string;
  reason: string;
  metadata?: unknown;
  source: TransactionSource;
  actorId?: TransactionActorId;
  createdAt?: number;
};

type PreparedPostArgs = {
  user: User;
  userPlan?: UserSavingsPlan;
  type: TxnType;
  effectiveType: TxnType;
  amountKobo: bigint;
  reference: string;
  metadata: Record<string, unknown>;
  source: TransactionSource;
  actorId?: TransactionActorId;
  createdAt: number;
  reversalOfTransaction?: Transaction;
  reversalOfReference?: string;
  reversalOfType?: TxnType;
};

type PostTransactionResult = {
  transaction: Transaction;
  idempotent: boolean;
};

type ProjectionTotals = {
  totalBalanceKobo: bigint;
  savingsBalanceKobo: bigint;
};

type ProjectionDelta = {
  totalBalanceKobo: bigint;
  savingsBalanceKobo: bigint;
  planAmountKobo: bigint;
};

type TransactionListFilters = {
  type?: TxnType;
  planId?: UserSavingsPlanId;
  userId?: UserId;
  reference?: string;
  dateFrom?: number;
  dateTo?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asObject(value: unknown, fieldName = "metadata") {
  if (value === undefined) {
    return {};
  }

  if (!isRecord(value)) {
    throw new ConvexError(`${fieldName} must be an object`);
  }

  return { ...value };
}

function asStringId(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  return String(value);
}

function getRequiredString(
  object: Record<string, unknown>,
  key: string,
  message = `${key} is required`
) {
  const value = object[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ConvexError(message);
  }

  return value.trim();
}

function getOptionalString(object: Record<string, unknown>, key: string) {
  const value = object[key];
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new ConvexError(`${key} must be a string`);
  }

  return value.trim();
}

function getRequiredNumber(object: Record<string, unknown>, key: string) {
  const value = object[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ConvexError(`${key} must be a valid number`);
  }

  return value;
}

function isTxnTypeValue(value: unknown): value is TxnType {
  return Object.values(TxnType).includes(value as TxnType);
}

function assertReference(reference: string) {
  if (reference.trim().length === 0) {
    throw new ConvexError("reference is required");
  }
}

function assertPositiveAmount(type: TxnType, amountKobo: bigint) {
  if (amountKobo <= 0n) {
    throw new ConvexError(`${type} transactions must have a positive amount`);
  }
}

function assertNegativeAmount(type: TxnType, amountKobo: bigint) {
  if (amountKobo >= 0n) {
    throw new ConvexError(`${type} transactions must have a negative amount`);
  }
}

function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeValue(item));
  }

  if (isRecord(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = canonicalizeValue(value[key]);
        return result;
      }, {});
  }

  return value;
}

function stableStringify(value: unknown) {
  return JSON.stringify(canonicalizeValue(value));
}

function normalizeContributionMetadata(
  metadata: Record<string, unknown>,
  source: TransactionSource,
  actorId?: TransactionActorId
) {
  return {
    source,
    actor_id: actorId ? String(actorId) : undefined,
    channel: getRequiredString(metadata, "channel"),
    origin_reference: getRequiredString(metadata, "origin_reference"),
    note: getOptionalString(metadata, "note"),
  };
}

function normalizeAccrualMetadata(
  metadata: Record<string, unknown>,
  source: TransactionSource,
  actorId: TransactionActorId | undefined
) {
  return {
    source,
    actor_id: actorId ? String(actorId) : undefined,
    period_start: getRequiredString(metadata, "period_start"),
    period_end: getRequiredString(metadata, "period_end"),
    rate: getRequiredNumber(metadata, "rate"),
    run_id: getRequiredString(metadata, "run_id"),
    note: getOptionalString(metadata, "note"),
  };
}

function normalizeReferralBonusMetadata(
  metadata: Record<string, unknown>,
  source: TransactionSource,
  actorId: TransactionActorId | undefined
) {
  return {
    source,
    actor_id: actorId ? String(actorId) : undefined,
    referrer_user_id: getRequiredString(metadata, "referrer_user_id"),
    referred_user_id: getRequiredString(metadata, "referred_user_id"),
    trigger_transaction_reference: getRequiredString(
      metadata,
      "trigger_transaction_reference"
    ),
    note: getOptionalString(metadata, "note"),
  };
}

function normalizeWithdrawalMetadata(
  metadata: Record<string, unknown>,
  source: TransactionSource,
  actorId: TransactionActorId | undefined
) {
  const method = getRequiredString(metadata, "method");
  const withdrawalStatus = getRequiredString(metadata, "withdrawal_status");
  const bankAccount = metadata.bank_account;
  const cashDetails = metadata.cash_details;

  if (method === WithdrawalMethod.BANK_TRANSFER && !isRecord(bankAccount)) {
    throw new ConvexError(
      "withdrawal metadata.bank_account is required for bank transfer withdrawals"
    );
  }

  if (method === WithdrawalMethod.CASH && !isRecord(cashDetails)) {
    throw new ConvexError(
      "withdrawal metadata.cash_details is required for cash withdrawals"
    );
  }

  return {
    source,
    actor_id: actorId ? String(actorId) : undefined,
    method,
    withdrawal_status: withdrawalStatus,
    bank_account: isRecord(bankAccount) ? bankAccount : undefined,
    cash_details: isRecord(cashDetails) ? cashDetails : undefined,
    note: getOptionalString(metadata, "note"),
  };
}

function normalizeReversalMetadata(
  metadata: Record<string, unknown>,
  source: TransactionSource,
  actorId: TransactionActorId | undefined
) {
  const originalType = metadata.original_type;
  if (!isTxnTypeValue(originalType)) {
    throw new ConvexError("reversal metadata.original_type must be valid");
  }

  return {
    source,
    actor_id: actorId ? String(actorId) : undefined,
    original_transaction_id: getRequiredString(
      metadata,
      "original_transaction_id"
    ),
    original_reference: getRequiredString(metadata, "original_reference"),
    original_type: originalType,
    reason: getRequiredString(metadata, "reason"),
  };
}

function normalizeTransactionMetadata(
  type: TxnType,
  metadata: unknown,
  source: TransactionSource,
  actorId?: TransactionActorId
) {
  const object = asObject(metadata);

  switch (type) {
    case TxnType.CONTRIBUTION:
      return normalizeContributionMetadata(object, source, actorId);
    case TxnType.INTEREST_ACCRUAL:
    case TxnType.INVESTMENT_YIELD:
      return normalizeAccrualMetadata(object, source, actorId);
    case TxnType.REFERRAL_BONUS:
      return normalizeReferralBonusMetadata(object, source, actorId);
    case TxnType.WITHDRAWAL:
      return normalizeWithdrawalMetadata(object, source, actorId);
    case TxnType.REVERSAL:
      return normalizeReversalMetadata(object, source, actorId);
  }
}

function summarizeTransactionMetadata(metadata: unknown) {
  const object = asObject(metadata);

  return {
    source:
      object.source === TransactionSource.USER ||
      object.source === TransactionSource.ADMIN ||
      object.source === TransactionSource.SYSTEM
        ? object.source
        : undefined,
    actor_id: asStringId(object.actor_id),
    channel: getOptionalString(object, "channel"),
    origin_reference: getOptionalString(object, "origin_reference"),
    note: getOptionalString(object, "note"),
    run_id: getOptionalString(object, "run_id"),
    rate: typeof object.rate === "number" ? object.rate : undefined,
    period_start: getOptionalString(object, "period_start"),
    period_end: getOptionalString(object, "period_end"),
    referrer_user_id: getOptionalString(object, "referrer_user_id"),
    referred_user_id: getOptionalString(object, "referred_user_id"),
    trigger_transaction_reference: getOptionalString(
      object,
      "trigger_transaction_reference"
    ),
    withdrawal_status: getOptionalString(object, "withdrawal_status"),
    method: getOptionalString(object, "method"),
    original_transaction_id: getOptionalString(
      object,
      "original_transaction_id"
    ),
    original_reference: getOptionalString(object, "original_reference"),
    original_type: isTxnTypeValue(object.original_type)
      ? object.original_type
      : undefined,
    reason: getOptionalString(object, "reason"),
  };
}

function buildTransactionSummary(transaction: Transaction) {
  return {
    _id: transaction._id,
    user_id: transaction.user_id,
    user_plan_id: transaction.user_plan_id,
    type: transaction.type,
    amount_kobo: transaction.amount_kobo,
    reference: transaction.reference,
    reversal_of_transaction_id: transaction.reversal_of_transaction_id,
    reversal_of_reference: transaction.reversal_of_reference,
    reversal_of_type: transaction.reversal_of_type,
    created_at: transaction.created_at,
    metadata_summary: summarizeTransactionMetadata(transaction.metadata),
  };
}

async function getUserPlan(
  ctx: Context,
  userId: UserId,
  userPlanId?: UserSavingsPlanId
) {
  if (!userPlanId) {
    return undefined;
  }

  const plan = await ctx.db.get(userPlanId);
  if (!plan) {
    throw new ConvexError("Savings plan not found");
  }

  if (plan.user_id !== userId) {
    throw new ConvexError("Savings plan does not belong to the user");
  }

  return plan;
}

async function getTransactionsByReference(ctx: Context, reference: string) {
  return await ctx.db
    .query(TABLE_NAMES.TRANSACTIONS)
    .withIndex("by_reference", (q) => q.eq("reference", reference))
    .collect();
}

function buildComparableTransactionPayload(input: {
  userId: UserId;
  userPlanId?: UserSavingsPlanId;
  type: TxnType;
  amountKobo: bigint;
  reference: string;
  reversalOfTransactionId?: TransactionId;
  reversalOfReference?: string;
  reversalOfType?: TxnType;
  metadata: Record<string, unknown>;
}) {
  return {
    user_id: String(input.userId),
    user_plan_id: input.userPlanId ? String(input.userPlanId) : undefined,
    type: input.type,
    amount_kobo: input.amountKobo.toString(),
    reference: input.reference,
    reversal_of_transaction_id: input.reversalOfTransactionId
      ? String(input.reversalOfTransactionId)
      : undefined,
    reversal_of_reference: input.reversalOfReference,
    reversal_of_type: input.reversalOfType,
    metadata: input.metadata,
  };
}

function comparableTransactionFromDoc(transaction: Transaction) {
  return buildComparableTransactionPayload({
    userId: transaction.user_id,
    userPlanId: transaction.user_plan_id,
    type: transaction.type,
    amountKobo: transaction.amount_kobo,
    reference: transaction.reference,
    reversalOfTransactionId: transaction.reversal_of_transaction_id,
    reversalOfReference: transaction.reversal_of_reference,
    reversalOfType: transaction.reversal_of_type,
    metadata: asObject(transaction.metadata),
  });
}

function getEffectiveType(transaction: Transaction) {
  if (transaction.type !== TxnType.REVERSAL) {
    return transaction.type;
  }

  if (!transaction.reversal_of_type) {
    throw new ConvexError(
      `Reversal transaction ${transaction._id} is missing reversal_of_type`
    );
  }

  return transaction.reversal_of_type;
}

function computeProjectionDelta(
  effectiveType: TxnType,
  amountKobo: bigint,
  userPlanId?: UserSavingsPlanId
): ProjectionDelta {
  switch (effectiveType) {
    case TxnType.CONTRIBUTION:
    case TxnType.INTEREST_ACCRUAL:
    case TxnType.INVESTMENT_YIELD:
      return {
        totalBalanceKobo: amountKobo,
        savingsBalanceKobo: amountKobo,
        planAmountKobo: userPlanId ? amountKobo : 0n,
      };
    case TxnType.REFERRAL_BONUS:
      return {
        totalBalanceKobo: amountKobo,
        savingsBalanceKobo: amountKobo,
        planAmountKobo: 0n,
      };
    case TxnType.WITHDRAWAL:
      return {
        totalBalanceKobo: amountKobo,
        savingsBalanceKobo: amountKobo,
        planAmountKobo: userPlanId ? amountKobo : 0n,
      };
    case TxnType.REVERSAL:
      throw new ConvexError("effectiveType cannot be reversal");
  }
}

async function applyProjectionDelta(
  ctx: MutationCtx,
  user: User,
  userPlan: UserSavingsPlan | undefined,
  delta: ProjectionDelta,
  updatedAt: number
) {
  const nextTotalBalance = user.total_balance_kobo + delta.totalBalanceKobo;
  const nextSavingsBalance =
    user.savings_balance_kobo + delta.savingsBalanceKobo;

  if (nextTotalBalance < 0n || nextSavingsBalance < 0n) {
    throw new ConvexError(
      "Transaction would result in a negative user balance"
    );
  }

  if (userPlan) {
    const nextPlanAmount = userPlan.current_amount_kobo + delta.planAmountKobo;
    if (nextPlanAmount < 0n) {
      throw new ConvexError(
        "Transaction would result in a negative plan balance"
      );
    }

    await ctx.db.patch(userPlan._id, {
      current_amount_kobo: nextPlanAmount,
      updated_at: updatedAt,
    });
  }

  await ctx.db.patch(user._id, {
    total_balance_kobo: nextTotalBalance,
    savings_balance_kobo: nextSavingsBalance,
    updated_at: updatedAt,
  });
}

async function preparePostArgs(
  ctx: MutationCtx,
  args: TransactionPostArgs
): Promise<PreparedPostArgs> {
  assertReference(args.reference);

  const user = await ctx.db.get(args.userId);
  if (!user) {
    throw new ConvexError("User not found");
  }

  let userPlan = await getUserPlan(ctx, args.userId, args.userPlanId);
  let reversalOfTransaction: Transaction | undefined;

  if (args.type === TxnType.REVERSAL) {
    if (!args.reversalOfTransactionId) {
      throw new ConvexError(
        "reversalOfTransactionId is required for reversal transactions"
      );
    }

    const originalTransaction = await ctx.db.get(args.reversalOfTransactionId);
    if (!originalTransaction) {
      throw new ConvexError("Original transaction not found");
    }
    reversalOfTransaction = originalTransaction;

    if (reversalOfTransaction.type === TxnType.REVERSAL) {
      throw new ConvexError("Reversing a reversal is not supported");
    }

    if (reversalOfTransaction.user_id !== args.userId) {
      throw new ConvexError(
        "Reversal must target the original transaction user"
      );
    }

    if (
      args.amountKobo !== -reversalOfTransaction.amount_kobo ||
      args.amountKobo === 0n
    ) {
      throw new ConvexError(
        "Reversal amount must be the exact inverse of the original transaction amount"
      );
    }

    if (
      args.userPlanId &&
      args.userPlanId !== reversalOfTransaction.user_plan_id
    ) {
      throw new ConvexError(
        "Reversal savings plan must match the original transaction"
      );
    }

    if (!userPlan && reversalOfTransaction.user_plan_id) {
      userPlan = await getUserPlan(
        ctx,
        args.userId,
        reversalOfTransaction.user_plan_id
      );
    }
  } else {
    if (args.reversalOfTransactionId) {
      throw new ConvexError(
        "reversalOfTransactionId can only be used with reversal transactions"
      );
    }

    switch (args.type) {
      case TxnType.CONTRIBUTION:
      case TxnType.INTEREST_ACCRUAL:
      case TxnType.INVESTMENT_YIELD:
      case TxnType.REFERRAL_BONUS:
        assertPositiveAmount(args.type, args.amountKobo);
        break;
      case TxnType.WITHDRAWAL:
        assertNegativeAmount(args.type, args.amountKobo);
        break;
    }

    if (args.type === TxnType.REFERRAL_BONUS && userPlan) {
      throw new ConvexError(
        "Referral bonus transactions cannot be linked to a savings plan"
      );
    }
  }

  const metadata =
    args.type === TxnType.REVERSAL && reversalOfTransaction
      ? normalizeTransactionMetadata(
          TxnType.REVERSAL,
          {
            ...asObject(args.metadata),
            original_transaction_id: String(reversalOfTransaction._id),
            original_reference: reversalOfTransaction.reference,
            original_type: reversalOfTransaction.type,
          },
          args.source,
          args.actorId
        )
      : normalizeTransactionMetadata(
          args.type,
          args.metadata,
          args.source,
          args.actorId
        );

  return {
    user,
    userPlan,
    type: args.type,
    effectiveType:
      args.type === TxnType.REVERSAL && reversalOfTransaction
        ? reversalOfTransaction.type
        : args.type,
    amountKobo: args.amountKobo,
    reference: args.reference.trim(),
    metadata,
    source: args.source,
    actorId: args.actorId,
    createdAt: args.createdAt ?? Date.now(),
    reversalOfTransaction,
    reversalOfReference: reversalOfTransaction?.reference,
    reversalOfType: reversalOfTransaction?.type,
  };
}

function matchesIdempotentPayload(
  transaction: Transaction,
  prepared: PreparedPostArgs
) {
  return (
    stableStringify(comparableTransactionFromDoc(transaction)) ===
    stableStringify(
      buildComparableTransactionPayload({
        userId: prepared.user._id,
        userPlanId: prepared.userPlan?._id,
        type: prepared.type,
        amountKobo: prepared.amountKobo,
        reference: prepared.reference,
        reversalOfTransactionId: prepared.reversalOfTransaction?._id,
        reversalOfReference: prepared.reversalOfReference,
        reversalOfType: prepared.reversalOfType,
        metadata: prepared.metadata,
      })
    )
  );
}

async function resolveExistingReference(
  ctx: MutationCtx,
  prepared: PreparedPostArgs
) {
  const existing = await getTransactionsByReference(ctx, prepared.reference);
  if (existing.length === 0) {
    return null;
  }

  if (existing.length > 1) {
    throw new ConvexError("Multiple transactions share the same reference");
  }

  if (!matchesIdempotentPayload(existing[0], prepared)) {
    throw new ConvexError(
      "Transaction reference already exists with different payload"
    );
  }

  return existing[0];
}

function shouldAuditTransaction(source: TransactionSource) {
  return (
    source === TransactionSource.ADMIN || source === TransactionSource.SYSTEM
  );
}

async function auditPostedTransaction(
  ctx: MutationCtx,
  transaction: Transaction,
  source: TransactionSource,
  actorId?: TransactionActorId
) {
  if (!shouldAuditTransaction(source)) {
    return;
  }

  await auditLog.log(ctx, {
    action:
      transaction.type === TxnType.REVERSAL
        ? "transaction.reversed"
        : "transaction.posted",
    actorId,
    resourceType: RESOURCE_TYPE.TRANSACTIONS,
    resourceId: transaction._id,
    severity: transaction.type === TxnType.REVERSAL ? "warning" : "info",
    metadata: {
      reference: transaction.reference,
      type: transaction.type,
      amount_kobo: transaction.amount_kobo,
      source,
    },
  });
}

export async function postTransactionEntry(
  ctx: MutationCtx,
  args: TransactionPostArgs
): Promise<PostTransactionResult> {
  const prepared = await preparePostArgs(ctx, args);
  const existing = await resolveExistingReference(ctx, prepared);

  if (existing) {
    return { transaction: existing, idempotent: true };
  }

  if (prepared.reversalOfTransaction) {
    const reversalTarget = prepared.reversalOfTransaction;
    const existingReversals = await ctx.db
      .query(TABLE_NAMES.TRANSACTIONS)
      .withIndex("by_reversal_of_transaction_id", (q) =>
        q.eq("reversal_of_transaction_id", reversalTarget._id)
      )
      .collect();

    if (existingReversals.length > 0) {
      throw new ConvexError("Original transaction has already been reversed");
    }
  }

  const delta = computeProjectionDelta(
    prepared.effectiveType,
    prepared.amountKobo,
    prepared.userPlan?._id
  );

  await applyProjectionDelta(
    ctx,
    prepared.user,
    prepared.userPlan,
    delta,
    prepared.createdAt
  );

  const transactionId = await ctx.db.insert(TABLE_NAMES.TRANSACTIONS, {
    user_id: prepared.user._id,
    user_plan_id: prepared.userPlan?._id,
    type: prepared.type,
    amount_kobo: prepared.amountKobo,
    reference: prepared.reference,
    reversal_of_transaction_id: prepared.reversalOfTransaction?._id,
    reversal_of_reference: prepared.reversalOfReference,
    reversal_of_type: prepared.reversalOfType,
    metadata: prepared.metadata,
    created_at: prepared.createdAt,
  });

  const transaction = await ctx.db.get(transactionId);
  if (!transaction) {
    throw new ConvexError("Failed to create transaction");
  }

  // Sync with aggregate tables for O(log n) queries
  await syncTransactionInsert(ctx, transaction);

  await auditPostedTransaction(
    ctx,
    transaction,
    prepared.source,
    prepared.actorId
  );

  return { transaction, idempotent: false };
}

export async function reverseTransactionEntry(
  ctx: MutationCtx,
  args: TransactionReverseArgs
): Promise<PostTransactionResult> {
  const originalTransaction = await ctx.db.get(args.originalTransactionId);
  if (!originalTransaction) {
    throw new ConvexError("Original transaction not found");
  }

  return await postTransactionEntry(ctx, {
    userId: originalTransaction.user_id,
    userPlanId: originalTransaction.user_plan_id,
    type: TxnType.REVERSAL,
    amountKobo: -originalTransaction.amount_kobo,
    reference: args.reference,
    metadata: {
      ...asObject(args.metadata),
      reason: args.reason,
    },
    source: args.source,
    actorId: args.actorId,
    createdAt: args.createdAt,
    reversalOfTransactionId: originalTransaction._id,
  });
}

async function buildProjectedUserBalances(
  ctx: MutationCtx,
  userId: UserId
): Promise<ProjectionTotals> {
  const transactions = await ctx.db
    .query(TABLE_NAMES.TRANSACTIONS)
    .withIndex("by_user_id", (q) => q.eq("user_id", userId))
    .collect();

  let totalBalanceKobo = 0n;
  let savingsBalanceKobo = 0n;

  for (const transaction of transactions) {
    const effectiveType = getEffectiveType(transaction);
    const delta = computeProjectionDelta(
      effectiveType,
      transaction.amount_kobo,
      transaction.user_plan_id
    );
    totalBalanceKobo += delta.totalBalanceKobo;
    savingsBalanceKobo += delta.savingsBalanceKobo;
  }

  return {
    totalBalanceKobo,
    savingsBalanceKobo,
  };
}

async function buildProjectedPlanAmount(
  ctx: MutationCtx,
  userPlanId: UserSavingsPlanId
) {
  const transactions = await ctx.db
    .query(TABLE_NAMES.TRANSACTIONS)
    .withIndex("by_user_plan_id", (q) => q.eq("user_plan_id", userPlanId))
    .collect();

  let currentAmountKobo = 0n;

  for (const transaction of transactions) {
    const effectiveType = getEffectiveType(transaction);
    const delta = computeProjectionDelta(
      effectiveType,
      transaction.amount_kobo,
      transaction.user_plan_id
    );
    currentAmountKobo += delta.planAmountKobo;
  }

  return currentAmountKobo;
}

function transactionMatchesFilters(
  transaction: Transaction,
  filters: TransactionListFilters
) {
  if (filters.type && transaction.type !== filters.type) {
    return false;
  }

  if (filters.planId && transaction.user_plan_id !== filters.planId) {
    return false;
  }

  if (filters.userId && transaction.user_id !== filters.userId) {
    return false;
  }

  if (filters.reference && transaction.reference !== filters.reference) {
    return false;
  }

  if (
    filters.dateFrom !== undefined &&
    transaction.created_at < filters.dateFrom
  ) {
    return false;
  }

  if (filters.dateTo !== undefined && transaction.created_at > filters.dateTo) {
    return false;
  }

  return true;
}

async function paginateTransactionSummaries(
  baseTransactions: Promise<Transaction[]>,
  paginationOpts: { cursor: string | null; numItems: number },
  filters: TransactionListFilters
) {
  const transactions = (await baseTransactions)
    .filter((transaction) => transactionMatchesFilters(transaction, filters))
    .sort((a, b) => {
      if (a.created_at === b.created_at) {
        return String(b._id).localeCompare(String(a._id));
      }

      return b.created_at - a.created_at;
    });

  const offset =
    paginationOpts.cursor === null
      ? 0
      : Number.parseInt(paginationOpts.cursor, 10);

  if (Number.isNaN(offset) || offset < 0) {
    throw new ConvexError("Invalid pagination cursor");
  }

  const page = transactions
    .slice(offset, offset + paginationOpts.numItems)
    .map((transaction) => buildTransactionSummary(transaction));
  const nextOffset = offset + page.length;

  return {
    page,
    continueCursor: String(nextOffset),
    isDone: nextOffset >= transactions.length,
  };
}

function buildReconciliationIssue(details: {
  issueType: TransactionReconciliationIssueType;
  createdAt: number;
  userId?: UserId;
  userPlanId?: UserSavingsPlanId;
  transactionId?: TransactionId;
  reference?: string;
  expectedAmountKobo?: bigint;
  actualAmountKobo?: bigint;
  details?: Record<string, unknown>;
}) {
  return {
    issue_type: details.issueType,
    issue_status: TransactionReconciliationIssueStatus.OPEN,
    user_id: details.userId,
    user_plan_id: details.userPlanId,
    transaction_id: details.transactionId,
    reference: details.reference,
    expected_amount_kobo: details.expectedAmountKobo,
    actual_amount_kobo: details.actualAmountKobo,
    details: details.details,
    created_at: details.createdAt,
  };
}

export const post = internalMutation({
  args: postArgsValidator,
  returns: transactionSummaryValidator,
  handler: async (ctx, args) => {
    const result = await postTransactionEntry(ctx, args);
    return buildTransactionSummary(result.transaction);
  },
});

export const reverse = internalMutation({
  args: reverseArgsValidator,
  returns: transactionSummaryValidator,
  handler: async (ctx, args) => {
    const result = await reverseTransactionEntry(ctx, args);
    return buildTransactionSummary(result.transaction);
  },
});

export const rebuildUserProjection = internalMutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    userId: v.id("users"),
    total_balance_kobo: v.int64(),
    savings_balance_kobo: v.int64(),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    const projected = await buildProjectedUserBalances(ctx, args.userId);

    await ctx.db.patch(args.userId, {
      total_balance_kobo: projected.totalBalanceKobo,
      savings_balance_kobo: projected.savingsBalanceKobo,
      updated_at: Date.now(),
    });

    return {
      userId: args.userId,
      total_balance_kobo: projected.totalBalanceKobo,
      savings_balance_kobo: projected.savingsBalanceKobo,
    };
  },
});

export const rebuildPlanProjection = internalMutation({
  args: {
    userPlanId: v.id("user_savings_plans"),
  },
  returns: v.object({
    userPlanId: v.id("user_savings_plans"),
    current_amount_kobo: v.int64(),
  }),
  handler: async (ctx, args) => {
    const plan = await ctx.db.get(args.userPlanId);
    if (!plan) {
      throw new ConvexError("Savings plan not found");
    }

    const projected = await buildProjectedPlanAmount(ctx, args.userPlanId);

    await ctx.db.patch(args.userPlanId, {
      current_amount_kobo: projected,
      updated_at: Date.now(),
    });

    return {
      userPlanId: args.userPlanId,
      current_amount_kobo: projected,
    };
  },
});

export const runReconciliation = internalMutation({
  args: {},
  returns: reconciliationRunValidator,
  handler: async (ctx) => {
    const startedAt = Date.now();
    const runId = await ctx.db.insert(
      TABLE_NAMES.TRANSACTION_RECONCILIATION_RUNS,
      {
        status: TransactionReconciliationRunStatus.RUNNING,
        started_at: startedAt,
        completed_at: undefined,
        issue_count: 0,
        user_count: 0,
        plan_count: 0,
        transaction_count: 0,
        created_at: startedAt,
      }
    );

    try {
      const previousOpenIssues = await ctx.db
        .query(TABLE_NAMES.TRANSACTION_RECONCILIATION_ISSUES)
        .withIndex("by_issue_status", (q) =>
          q.eq("issue_status", TransactionReconciliationIssueStatus.OPEN)
        )
        .collect();

      const users = await ctx.db.query(TABLE_NAMES.USERS).collect();
      const plans = await ctx.db
        .query(TABLE_NAMES.USER_SAVINGS_PLANS)
        .collect();
      const allTransactions = await ctx.db
        .query(TABLE_NAMES.TRANSACTIONS)
        .collect();
      const reversals = allTransactions.filter(
        (transaction) => transaction.type === TxnType.REVERSAL
      );

      const issues: Array<ReturnType<typeof buildReconciliationIssue>> = [];

      for (const user of users) {
        const projected = await buildProjectedUserBalances(ctx, user._id);

        if (projected.totalBalanceKobo !== user.total_balance_kobo) {
          issues.push(
            buildReconciliationIssue({
              issueType:
                TransactionReconciliationIssueType.USER_TOTAL_BALANCE_MISMATCH,
              createdAt: startedAt,
              userId: user._id,
              expectedAmountKobo: projected.totalBalanceKobo,
              actualAmountKobo: user.total_balance_kobo,
            })
          );
        }

        if (projected.savingsBalanceKobo !== user.savings_balance_kobo) {
          issues.push(
            buildReconciliationIssue({
              issueType:
                TransactionReconciliationIssueType.USER_SAVINGS_BALANCE_MISMATCH,
              createdAt: startedAt,
              userId: user._id,
              expectedAmountKobo: projected.savingsBalanceKobo,
              actualAmountKobo: user.savings_balance_kobo,
            })
          );
        }
      }

      for (const plan of plans) {
        const projectedAmount = await buildProjectedPlanAmount(ctx, plan._id);
        if (projectedAmount !== plan.current_amount_kobo) {
          issues.push(
            buildReconciliationIssue({
              issueType:
                TransactionReconciliationIssueType.PLAN_CURRENT_AMOUNT_MISMATCH,
              createdAt: startedAt,
              userId: plan.user_id,
              userPlanId: plan._id,
              expectedAmountKobo: projectedAmount,
              actualAmountKobo: plan.current_amount_kobo,
            })
          );
        }
      }

      const reversalsByOriginalId = new Map<string, Transaction[]>();

      for (const reversal of reversals) {
        if (
          !reversal.reversal_of_transaction_id ||
          !reversal.reversal_of_reference ||
          !reversal.reversal_of_type
        ) {
          issues.push(
            buildReconciliationIssue({
              issueType: TransactionReconciliationIssueType.ORPHANED_REVERSAL,
              createdAt: startedAt,
              transactionId: reversal._id,
              reference: reversal.reference,
              details: {
                reason: "Reversal is missing original transaction linkage",
              },
            })
          );
          continue;
        }

        const original = await ctx.db.get(reversal.reversal_of_transaction_id);
        if (
          !original ||
          original.reference !== reversal.reversal_of_reference
        ) {
          issues.push(
            buildReconciliationIssue({
              issueType: TransactionReconciliationIssueType.ORPHANED_REVERSAL,
              createdAt: startedAt,
              transactionId: reversal._id,
              reference: reversal.reference,
              details: {
                expected_original_reference: reversal.reversal_of_reference,
                reason:
                  "Original transaction is missing or reference does not match",
              },
            })
          );
          continue;
        }

        const key = String(original._id);
        reversalsByOriginalId.set(key, [
          ...(reversalsByOriginalId.get(key) ?? []),
          reversal,
        ]);
      }

      for (const [
        originalId,
        linkedReversals,
      ] of reversalsByOriginalId.entries()) {
        if (linkedReversals.length <= 1) {
          continue;
        }

        const original = await ctx.db.get(originalId as TransactionId);
        issues.push(
          buildReconciliationIssue({
            issueType: TransactionReconciliationIssueType.DOUBLE_REVERSAL,
            createdAt: startedAt,
            transactionId: original?._id,
            reference: original?.reference,
            details: {
              reversal_transaction_ids: linkedReversals.map((transaction) =>
                String(transaction._id)
              ),
              reversal_references: linkedReversals.map(
                (transaction) => transaction.reference
              ),
            },
          })
        );
      }

      const completedAt = Date.now();

      for (const issue of previousOpenIssues) {
        const oldIssue = await ctx.db.get(issue._id);
        await ctx.db.patch(issue._id, {
          issue_status: TransactionReconciliationIssueStatus.RESOLVED,
          resolved_at: completedAt,
        });
        const newIssue = await ctx.db.get(issue._id);

        // Sync aggregates - mark as resolved
        if (oldIssue && newIssue) {
          await syncReconciliationIssueUpdate(ctx, oldIssue, newIssue);
        }
      }

      for (const issue of issues) {
        const issueId = await ctx.db.insert(
          TABLE_NAMES.TRANSACTION_RECONCILIATION_ISSUES,
          {
            run_id: runId,
            ...issue,
          }
        );

        // Sync aggregates - add new issue
        const createdIssue = await ctx.db.get(issueId);
        if (createdIssue) {
          await syncReconciliationIssueInsert(ctx, createdIssue);
        }
      }

      await ctx.db.patch(runId, {
        status: TransactionReconciliationRunStatus.COMPLETED,
        completed_at: completedAt,
        issue_count: issues.length,
        user_count: users.length,
        plan_count: plans.length,
        transaction_count: allTransactions.length,
      });

      const run = await ctx.db.get(runId);
      if (!run) {
        throw new ConvexError("Failed to persist reconciliation run");
      }

      await auditLog.log(ctx, {
        action: "transaction.reconciliation.completed",
        resourceType: RESOURCE_TYPE.TRANSACTION_RECONCILIATION_RUNS,
        resourceId: runId,
        severity: issues.length > 0 ? "warning" : "info",
        metadata: {
          issue_count: issues.length,
          user_count: users.length,
          plan_count: plans.length,
          transaction_count: allTransactions.length,
        },
      });

      return run;
    } catch (error) {
      await ctx.db.patch(runId, {
        status: TransactionReconciliationRunStatus.FAILED,
        completed_at: Date.now(),
      });

      await auditLog.log(ctx, {
        action: "transaction.reconciliation.failed",
        resourceType: RESOURCE_TYPE.TRANSACTION_RECONCILIATION_RUNS,
        resourceId: runId,
        severity: "error",
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });

      throw error;
    }
  },
});

export const listMine = query({
  args: {
    paginationOpts: paginationOptsValidator,
    type: v.optional(txnType),
    planId: v.optional(v.id("user_savings_plans")),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
  },
  returns: paginatedTransactionsValidator,
  handler: async (ctx, args) => {
    const user = await getUser(ctx);

    if (args.planId) {
      const plan = await getUserPlan(ctx, user._id, args.planId);
      if (!plan) {
        throw new ConvexError("Savings plan not found");
      }
    }

    return await paginateTransactionSummaries(
      ctx.db
        .query(TABLE_NAMES.TRANSACTIONS)
        .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
        .collect(),
      args.paginationOpts,
      {
        type: args.type,
        planId: args.planId,
        dateFrom: args.dateFrom,
        dateTo: args.dateTo,
      }
    );
  },
});

export const listByPlan = query({
  args: {
    planId: v.id("user_savings_plans"),
    paginationOpts: paginationOptsValidator,
    type: v.optional(txnType),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
  },
  returns: paginatedTransactionsValidator,
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const plan = await getUserPlan(ctx, user._id, args.planId);

    if (!plan) {
      throw new ConvexError("Savings plan not found");
    }

    return await paginateTransactionSummaries(
      ctx.db
        .query(TABLE_NAMES.TRANSACTIONS)
        .withIndex("by_user_plan_id", (q) => q.eq("user_plan_id", args.planId))
        .collect(),
      args.paginationOpts,
      {
        type: args.type,
        planId: args.planId,
        dateFrom: args.dateFrom,
        dateTo: args.dateTo,
      }
    );
  },
});

export const listForAdmin = query({
  args: {
    paginationOpts: paginationOptsValidator,
    userId: v.optional(v.id("users")),
    type: v.optional(txnType),
    reference: v.optional(v.string()),
    planId: v.optional(v.id("user_savings_plans")),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
  },
  returns: paginatedTransactionsValidator,
  handler: async (ctx, args) => {
    await getAdminUser(ctx);

    if (args.reference) {
      return await paginateTransactionSummaries(
        getTransactionsByReference(ctx, args.reference),
        args.paginationOpts,
        {
          userId: args.userId,
          type: args.type,
          reference: args.reference,
          planId: args.planId,
          dateFrom: args.dateFrom,
          dateTo: args.dateTo,
        }
      );
    }

    if (args.planId) {
      return await paginateTransactionSummaries(
        ctx.db
          .query(TABLE_NAMES.TRANSACTIONS)
          .withIndex("by_user_plan_id", (q) =>
            q.eq("user_plan_id", args.planId)
          )
          .collect(),
        args.paginationOpts,
        {
          userId: args.userId,
          type: args.type,
          planId: args.planId,
          dateFrom: args.dateFrom,
          dateTo: args.dateTo,
        }
      );
    }

    const userId = args.userId;
    if (userId) {
      return await paginateTransactionSummaries(
        ctx.db
          .query(TABLE_NAMES.TRANSACTIONS)
          .withIndex("by_user_id", (q) => q.eq("user_id", userId))
          .collect(),
        args.paginationOpts,
        {
          userId,
          type: args.type,
          dateFrom: args.dateFrom,
          dateTo: args.dateTo,
        }
      );
    }

    const transactionType = args.type;
    if (transactionType) {
      return await paginateTransactionSummaries(
        ctx.db
          .query(TABLE_NAMES.TRANSACTIONS)
          .withIndex("by_type", (q) => q.eq("type", transactionType))
          .collect(),
        args.paginationOpts,
        {
          type: transactionType,
          dateFrom: args.dateFrom,
          dateTo: args.dateTo,
        }
      );
    }

    return await paginateTransactionSummaries(
      ctx.db.query(TABLE_NAMES.TRANSACTIONS).collect(),
      args.paginationOpts,
      {
        dateFrom: args.dateFrom,
        dateTo: args.dateTo,
      }
    );
  },
});

export const getByReference = query({
  args: {
    reference: v.string(),
  },
  returns: v.union(transactionSummaryValidator, v.null()),
  handler: async (ctx, args) => {
    await getAdminUser(ctx);

    const transactions = await getTransactionsByReference(ctx, args.reference);
    if (transactions.length === 0) {
      return null;
    }

    if (transactions.length > 1) {
      throw new ConvexError("Multiple transactions share the same reference");
    }

    return buildTransactionSummary(transactions[0]);
  },
});

export const listReconciliationRuns = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(reconciliationRunValidator),
  handler: async (ctx, args) => {
    await getAdminUser(ctx);

    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);

    return await ctx.db
      .query(TABLE_NAMES.TRANSACTION_RECONCILIATION_RUNS)
      .withIndex("by_started_at")
      .order("desc")
      .take(limit);
  },
});

export const listOpenReconciliationIssues = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(reconciliationIssueValidator),
  handler: async (ctx, args) => {
    await getAdminUser(ctx);

    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);

    return await ctx.db
      .query(TABLE_NAMES.TRANSACTION_RECONCILIATION_ISSUES)
      .withIndex("by_issue_status", (q) =>
        q.eq("issue_status", TransactionReconciliationIssueStatus.OPEN)
      )
      .order("desc")
      .take(limit);
  },
});
