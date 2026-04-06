/**
 * Transaction Ledger Module
 *
 * Core financial transaction processing system for the savings platform.
 * Handles all monetary movements including contributions, withdrawals, interest accrual,
 * investment yields, referral bonuses, and reversals.
 *
 * Key Features:
 * - Idempotent transaction posting (prevents duplicate entries)
 * - Automatic balance projection updates (user & plan levels)
 * - Comprehensive audit logging for compliance
 * - Reversal mechanism with full traceability
 * - Real-time reconciliation issue detection
 * - Aggregate table synchronization for O(log n) analytics queries
 *
 * Transaction Types:
 * - CONTRIBUTION: User deposits into savings
 * - WITHDRAWAL: User withdrawals from savings
 * - INTEREST_ACCRUAL: Periodic interest earned
 * - INVESTMENT_YIELD: Investment returns credited
 * - REFERRAL_BONUS: Bonus for referring new users
 * - REVERSAL: Undoing a previous transaction
 *
 * @module transactions
 */
import type { MutationCtx } from "./_generated/server";
import type {
  TransactionReconciliationIssueId,
  TransactionReconciliationRunId,
  TransactionReconciliationRun,
  UserSavingsPlanId,
  TransactionId,
  AdminUserId,
  Transaction,
  Context,
  UserId,
} from "./types";

import { DomainError, computeProjectionDelta } from "@avm-daily/domain";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";

import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { createConvexSavingsPlanRepository } from "./adapters/savingsPlanAdapters";
import { createConvexEventOutboxService } from "./adapters/eventOutboxAdapter";
import { createConvexUserRepository } from "./adapters/userAdapters";
import { getAdminUser, getUser, isRecord } from "./utils";
import { internal } from "./_generated/api";
import { auditLog } from "./auditLog";

import {
  createReverseTransactionUseCase,
  createPostTransactionUseCase,
} from "@avm-daily/application/use-cases";

import {
  createConvexTransactionWriteRepository,
  createConvexTransactionReadRepository,
} from "./adapters/transactionAdapters";

// Re-export computeProjectionDelta from domain (single source of truth)
export { computeProjectionDelta } from "@avm-daily/domain";

import {
  syncReconciliationIssueDelete,
  syncReconciliationIssueInsert,
  syncReconciliationIssueUpdate,
  syncTransactionInsert,
} from "./aggregateHelpers";

import {
  TransactionReconciliationIssueStatus,
  TransactionReconciliationIssueType,
  TransactionReconciliationRunStatus,
  NotificationEventType,
  transactionReconciliationIssueStatus,
  transactionReconciliationIssueType,
  transactionSource,
  TransactionSource,
  RESOURCE_TYPE,
  TABLE_NAMES,
  TxnType,
  txnType,
} from "./shared";

const transactionActorIdValidator = v.optional(
  v.union(v.id("users"), v.id("admin_users")),
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

const reconciliationUsersPageValidator = v.object({
  page: v.array(
    v.object({
      _id: v.id("users"),
      total_balance_kobo: v.int64(),
      savings_balance_kobo: v.int64(),
    }),
  ),
  continueCursor: v.string(),
  isDone: v.boolean(),
});

const reconciliationPlansPageValidator = v.object({
  page: v.array(
    v.object({
      _id: v.id("user_savings_plans"),
      user_id: v.id("users"),
      current_amount_kobo: v.int64(),
    }),
  ),
  continueCursor: v.string(),
  isDone: v.boolean(),
});

const reconciliationIssueIdsPageValidator = v.object({
  page: v.array(v.id("transaction_reconciliation_issues")),
  continueCursor: v.string(),
  isDone: v.boolean(),
});

const transactionReferenceLookupValidator = v.array(
  v.object({
    _id: v.id("transactions"),
    reference: v.string(),
  }),
);

const reconciliationIssueInputValidator = v.object({
  issue_type: transactionReconciliationIssueType,
  issue_status: transactionReconciliationIssueStatus,
  user_id: v.optional(v.id("users")),
  user_plan_id: v.optional(v.id("user_savings_plans")),
  transaction_id: v.optional(v.id("transactions")),
  reference: v.optional(v.string()),
  expected_amount_kobo: v.optional(v.int64()),
  actual_amount_kobo: v.optional(v.int64()),
  details: v.optional(v.any()),
  created_at: v.number(),
});

const RECONCILIATION_READ_PAGE_SIZE = 500;
const RECONCILIATION_WRITE_BATCH_SIZE = 100;

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

type PostTransactionResult = {
  transaction: Transaction;
  idempotent: boolean;
};

type ProjectionTotals = {
  totalBalanceKobo: bigint;
  savingsBalanceKobo: bigint;
};

type TransactionListFilters = {
  type?: TxnType;
  planId?: UserSavingsPlanId;
  userId?: UserId;
  reference?: string;
  dateFrom?: number;
  dateTo?: number;
};

/**
 * Safely extracts and validates metadata as a record object.
 * Throws ConvexError if the value is not a valid object.
 *
 * @param value - The value to validate (default: undefined)
 * @param fieldName - Name of the field for error messages (default: "metadata")
 * @returns The validated record object or empty object if undefined
 * @throws ConvexError if value is not an object
 */
function asObject(value: unknown, fieldName = "metadata") {
  if (value === undefined) {
    return {};
  }

  if (!isRecord(value)) {
    throw new ConvexError(`${fieldName} must be an object`);
  }

  return { ...value };
}

/**
 * Converts a value to a string ID representation.
 * Handles null, undefined, and converts to string safely.
 *
 * @param value - The value to convert
 * @returns String representation or undefined if null/undefined
 */
function asStringId(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  return String(value);
}

/**
 * Extracts a required string field from a metadata object.
 * Validates presence and trims whitespace.
 *
 * @param object - The metadata object to extract from
 * @param key - The key to look up
 * @param message - Custom error message (default: "{key} is required")
 * @returns The trimmed string value
 * @throws ConvexError if the field is missing, empty, or not a string
 */

/**
 * Extracts an optional string field from a metadata object.
 * Returns undefined for missing/null/empty values.
 *
 * @param object - The metadata object to extract from
 * @param key - The key to look up
 * @returns The trimmed string value or undefined
 * @throws ConvexError if the value exists but is not a string
 */
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

/**
 * Extracts a required number field from a metadata object.
 * Validates that the value is a finite number.
 *
 * @param object - The metadata object to extract from
 * @param key - The key to look up
 * @returns The numeric value
 * @throws ConvexError if the field is missing or not a valid number
 */

/**
 * Type guard to validate transaction type values.
 * Ensures the value matches one of the defined TxnType enum values.
 *
 * @param value - The value to validate
 * @returns True if the value is a valid TxnType
 */
function isTxnTypeValue(value: unknown): value is TxnType {
  return Object.values(TxnType).includes(value as TxnType);
}

/**
 * Validates that a transaction reference is provided and non-empty.
 * References are critical for idempotency and audit trails.
 *
 * @param reference - The transaction reference to validate
 * @throws ConvexError if the reference is empty or whitespace
 */

/**
 * Validates that positive-amount transactions have the correct amount sign.
 * Applied to: CONTRIBUTION, INTEREST_ACCRUAL, INVESTMENT_YIELD, REFERRAL_BONUS
 *
 * @param type - The transaction type
 * @param amountKobo - The amount in kobo (must be positive)
 * @throws ConvexError if amount is not positive
 */

/**
 * Validates that negative-amount transactions have the correct amount sign.
 * Applied to: WITHDRAWAL
 *
 * @param type - The transaction type
 * @param amountKobo - The amount in kobo (must be negative)
 * @throws ConvexError if amount is not negative
 */

/**
 * Canonicalizes a value for stable string comparison.
 * Recursively sorts object keys and processes arrays to ensure
 * consistent ordering regardless of input order.
 *
 * This is critical for idempotency checks - two identical payloads
 * must produce the same canonical form even if keys were in different order.
 *
 * @param value - The value to canonicalize
 * @returns A canonically ordered version of the value
 */

/**
 * Normalizes and validates contribution transaction metadata.
 * Contributions represent user deposits into their savings plans.
 *
 * Required fields:
 * - channel: Where the contribution originated (e.g., "mobile_app", "web")
 * - origin_reference: External system reference for tracing
 *
 * Optional fields:
 * - note: Additional context or memo
 *
 * @param metadata - Raw metadata object
 * @param source - Transaction source (USER, ADMIN, SYSTEM)
 * @param actorId - ID of the user/admin performing the action
 * @returns Normalized metadata with standardized structure
 * @throws ConvexError if required fields are missing
 */

/**
 * Normalizes and validates accrual transaction metadata.
 * Accruals represent periodic interest or investment returns.
 *
 * Required fields:
 * - period_start: Start date of the accrual period
 * - period_end: End date of the accrual period
 * - rate: Accrual rate (e.g., 0.05 for 5%)
 * - run_id: ID of the accrual run
 *
 * Optional fields:
 * - note: Additional context or memo
 *
 * @param metadata - Raw metadata object
 * @param source - Transaction source (USER, ADMIN, SYSTEM)
 * @param actorId - ID of the user/admin performing the action
 * @returns Normalized metadata with standardized structure
 * @throws ConvexError if required fields are missing
 */

/**
 * Normalizes and validates referral bonus transaction metadata.
 * Referral bonuses are awarded to users for referring new users.
 *
 * Required fields:
 * - referrer_user_id: ID of the referring user
 * - referred_user_id: ID of the referred user
 * - trigger_transaction_reference: Reference of the triggering transaction
 *
 * Optional fields:
 * - note: Additional context or memo
 *
 * @param metadata - Raw metadata object
 * @param source - Transaction source (USER, ADMIN, SYSTEM)
 * @param actorId - ID of the user/admin performing the action
 * @returns Normalized metadata with standardized structure
 * @throws ConvexError if required fields are missing
 */

/**
 * Normalizes and validates withdrawal transaction metadata.
 * Withdrawals represent user withdrawals from their savings plans.
 *
 * Required fields:
 * - method: Withdrawal method (e.g., "BANK_TRANSFER", "CASH")
 * - withdrawal_status: Status of the withdrawal (e.g., "PENDING", "COMPLETED")
 *
 * Optional fields:
 * - bank_account: Bank account details (required for bank transfers)
 * - cash_details: Cash details (required for cash withdrawals)
 * - note: Additional context or memo
 *
 * @param metadata - Raw metadata object
 * @param source - Transaction source (USER, ADMIN, SYSTEM)
 * @param actorId - ID of the user/admin performing the action
 * @returns Normalized metadata with standardized structure
 * @throws ConvexError if required fields are missing
 */

/**
 * Strips sensitive or internal-only metadata fields to create a summary suitable for UI consumption.
 * This preserves only the essential context needed for user-facing transaction history.
 */
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
      "trigger_transaction_reference",
    ),
    withdrawal_status: getOptionalString(object, "withdrawal_status"),
    method: getOptionalString(object, "method"),
    original_transaction_id: getOptionalString(
      object,
      "original_transaction_id",
    ),
    original_reference: getOptionalString(object, "original_reference"),
    original_type: isTxnTypeValue(object.original_type)
      ? object.original_type
      : undefined,
    reason: getOptionalString(object, "reason"),
  };
}

/**
 * Transforms a raw Transaction document into a structured summary for API responses.
 * Includes a cleaned-up metadata summary and core financial fields.
 */
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

type ReconciliationTransactionPage = {
  page: Array<ReturnType<typeof buildTransactionSummary>>;
  continueCursor: string;
  isDone: boolean;
};

type ReconciliationUsersPage = {
  page: Array<{
    _id: UserId;
    total_balance_kobo: bigint;
    savings_balance_kobo: bigint;
  }>;
  continueCursor: string;
  isDone: boolean;
};

type ReconciliationPlansPage = {
  page: Array<{
    _id: UserSavingsPlanId;
    user_id: UserId;
    current_amount_kobo: bigint;
  }>;
  continueCursor: string;
  isDone: boolean;
};

type ReconciliationIssueIdsPage = {
  page: TransactionReconciliationIssueId[];
  continueCursor: string;
  isDone: boolean;
};

type TransactionReferenceLookup = Array<{
  _id: TransactionId;
  reference: string;
}>;

async function getUserPlan(
  ctx: Context,
  userId: UserId,
  userPlanId?: UserSavingsPlanId,
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

function getEffectiveType(
  transaction: Pick<Transaction, "_id" | "type" | "reversal_of_type">,
) {
  if (transaction.type !== TxnType.REVERSAL) {
    return transaction.type;
  }

  if (!transaction.reversal_of_type) {
    throw new ConvexError(
      `Reversal transaction ${transaction._id} is missing reversal_of_type`,
    );
  }

  return transaction.reversal_of_type;
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

/**
 * Updates the denormalized balances for a user and their savings plan.
 *
 * This function performs the actual mutations to the `users` and `user_savings_plans` tables.
 * It ensures that the projected balances never drop below zero, which would indicate
 * a violation of the system's financial constraints.
 */

/**
 * Validates transaction arguments and prepares them for processing.
 *
 * Handles complex logic for Reversals (verifying original transactions and amounts)
 * and normalizes metadata before the transaction is committed to the database.
 */

function shouldAuditTransaction(source: TransactionSource) {
  return (
    source === TransactionSource.ADMIN || source === TransactionSource.SYSTEM
  );
}

async function auditPostedTransaction(
  ctx: MutationCtx,
  transaction: Transaction,
  source: TransactionSource,
  actorId?: TransactionActorId,
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

/**
 * The primary entry point for recording any financial movement in the system.
 *
 * Delegates core business logic to createPostTransactionUseCase, then handles
 * Convex-specific concerns (aggregate sync, audit logging).
 *
 * @returns The created or existing transaction and an `idempotent` flag.
 */
export async function postTransactionEntry(
  ctx: MutationCtx,
  args: TransactionPostArgs,
): Promise<PostTransactionResult> {
  const postTransaction = createPostTransactionUseCase({
    transactionReadRepository: createConvexTransactionReadRepository(ctx),
    transactionWriteRepository: createConvexTransactionWriteRepository(ctx),
    userRepository: createConvexUserRepository(ctx),
    savingsPlanRepository: createConvexSavingsPlanRepository(ctx),
  });

  let result: PostTransactionResult;
  try {
    const ucResult = await postTransaction({
      userId: String(args.userId),
      userPlanId: args.userPlanId ? String(args.userPlanId) : undefined,
      type: args.type,
      amountKobo: args.amountKobo,
      reference: args.reference,
      reversalOfTransactionId: args.reversalOfTransactionId
        ? String(args.reversalOfTransactionId)
        : undefined,
      metadata: asObject(args.metadata),
      source: args.source,
      actorId: args.actorId ? String(args.actorId) : undefined,
      createdAt: args.createdAt,
    });

    result = {
      transaction: ucResult.transaction as Transaction,
      idempotent: ucResult.idempotent,
    };
  } catch (err) {
    if (err instanceof DomainError) {
      throw new ConvexError(err.message);
    }
    throw err;
  }

  if (!result.idempotent) {
    // Sync with aggregate tables for O(log n) queries
    await syncTransactionInsert(ctx, result.transaction);
    await auditPostedTransaction(
      ctx,
      result.transaction,
      args.source,
      args.actorId,
    );
  }

  return result;
}

/**
 * Reverses a previously posted transaction by creating an inverse entry.
 *
 * Delegates to createReverseTransactionUseCase, then handles Convex-specific concerns.
 */
export async function reverseTransactionEntry(
  ctx: MutationCtx,
  args: TransactionReverseArgs,
): Promise<PostTransactionResult> {
  const reverseTransaction = createReverseTransactionUseCase({
    transactionReadRepository: createConvexTransactionReadRepository(ctx),
    transactionWriteRepository: createConvexTransactionWriteRepository(ctx),
    userRepository: createConvexUserRepository(ctx),
    savingsPlanRepository: createConvexSavingsPlanRepository(ctx),
  });

  let result: PostTransactionResult;
  try {
    const ucResult = await reverseTransaction({
      originalTransactionId: String(args.originalTransactionId),
      reference: args.reference,
      reason: args.reason,
      metadata: asObject(args.metadata),
      source: args.source,
      actorId: args.actorId ? String(args.actorId) : undefined,
      createdAt: args.createdAt,
    });

    result = {
      transaction: ucResult.transaction as Transaction,
      idempotent: false,
    };
  } catch (err) {
    if (err instanceof DomainError) {
      throw new ConvexError(err.message);
    }
    throw err;
  }

  // Sync with aggregate tables
  await syncTransactionInsert(ctx, result.transaction);
  await auditPostedTransaction(
    ctx,
    result.transaction,
    args.source,
    args.actorId,
  );

  return result;
}

/**
 * Re-sums the entire transaction history for a user to calculate their absolute balance.
 * This is the ultimate "source of truth" calculation used during reconciliation.
 */
async function buildProjectedUserBalances(
  ctx: MutationCtx,
  userId: UserId,
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
      transaction.user_plan_id,
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
  userPlanId: UserSavingsPlanId,
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
      transaction.user_plan_id,
    );
    currentAmountKobo += delta.planAmountKobo;
  }

  return currentAmountKobo;
}

function transactionMatchesFilters(
  transaction: Transaction,
  filters: TransactionListFilters,
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

/**
 * Internal helper for handling cursor-based pagination across transaction listings.
 * Applies filters in-memory after fetching from indices to ensure correct ordering.
 */
async function paginateTransactionSummaries(
  baseTransactions: Promise<Transaction[]>,
  paginationOpts: { cursor: string | null; numItems: number },
  filters: TransactionListFilters,
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

/**
 * Manually triggers a recalculation of a user's balances from their ledger history.
 * Used to fix drift in the denormalized `total_balance_kobo` and `savings_balance_kobo` fields.
 */
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
    const admin = await getAdminUser(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    const projected = await buildProjectedUserBalances(ctx, args.userId);
    const now = Date.now();

    await auditLog.logChange(ctx, {
      action: "transaction.user_projection_rebuilt",
      actorId: admin._id,
      resourceType: RESOURCE_TYPE.USERS,
      resourceId: args.userId,
      before: {
        total_balance_kobo: user.total_balance_kobo.toString(),
        savings_balance_kobo: user.savings_balance_kobo.toString(),
      },
      after: {
        total_balance_kobo: projected.totalBalanceKobo.toString(),
        savings_balance_kobo: projected.savingsBalanceKobo.toString(),
      },
      severity: "warning",
    });

    await ctx.db.patch(args.userId, {
      total_balance_kobo: projected.totalBalanceKobo,
      savings_balance_kobo: projected.savingsBalanceKobo,
      updated_at: now,
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
    const admin = await getAdminUser(ctx);
    const plan = await ctx.db.get(args.userPlanId);
    if (!plan) {
      throw new ConvexError("Savings plan not found");
    }

    const projected = await buildProjectedPlanAmount(ctx, args.userPlanId);
    const now = Date.now();

    await auditLog.logChange(ctx, {
      action: "transaction.plan_projection_rebuilt",
      actorId: admin._id,
      resourceType: RESOURCE_TYPE.SAVINGS_PLANS,
      resourceId: args.userPlanId,
      before: { current_amount_kobo: plan.current_amount_kobo.toString() },
      after: { current_amount_kobo: projected.toString() },
      severity: "warning",
    });

    await ctx.db.patch(args.userPlanId, {
      current_amount_kobo: projected,
      updated_at: now,
    });

    return {
      userPlanId: args.userPlanId,
      current_amount_kobo: projected,
    };
  },
});

/**
 * A comprehensive audit process that reconciles the transaction ledger with projected balances.
 *
 * It iterates through all users and savings plans, calculates what their balances SHOULD be
 * by re-summing all linked transactions, and compares this against their current `total_balance_kobo`
 * and `savings_balance_kobo`.
 *
 * It also detects ledger anomalies like "Double Reversals" or "Orphaned Reversals".
 * Any mismatches are recorded as `transaction_reconciliation_issues` for admin review.
 */
export const _getReconciliationUsersPage = internalQuery({
  args: {
    cursor: v.union(v.string(), v.null()),
  },
  returns: reconciliationUsersPageValidator,
  handler: async (ctx, args) => {
    const result = await ctx.db.query(TABLE_NAMES.USERS).paginate({
      numItems: RECONCILIATION_READ_PAGE_SIZE,
      cursor: args.cursor,
    });

    return {
      page: result.page.map(
        ({ _id, total_balance_kobo, savings_balance_kobo }) => ({
          _id,
          total_balance_kobo,
          savings_balance_kobo,
        }),
      ),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const _getReconciliationPlansPage = internalQuery({
  args: {
    cursor: v.union(v.string(), v.null()),
  },
  returns: reconciliationPlansPageValidator,
  handler: async (ctx, args) => {
    const result = await ctx.db.query(TABLE_NAMES.USER_SAVINGS_PLANS).paginate({
      numItems: RECONCILIATION_READ_PAGE_SIZE,
      cursor: args.cursor,
    });

    return {
      page: result.page.map(({ _id, user_id, current_amount_kobo }) => ({
        _id,
        user_id,
        current_amount_kobo,
      })),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const _getReconciliationTransactionsPage = internalQuery({
  args: {
    cursor: v.union(v.string(), v.null()),
  },
  returns: paginatedTransactionsValidator,
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query(TABLE_NAMES.TRANSACTIONS)
      .withIndex("by_created_at")
      .paginate({
        numItems: RECONCILIATION_READ_PAGE_SIZE,
        cursor: args.cursor,
      });

    return {
      page: result.page.map(buildTransactionSummary),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const _getOpenReconciliationIssueIdsPage = internalQuery({
  args: {
    cursor: v.union(v.string(), v.null()),
  },
  returns: reconciliationIssueIdsPageValidator,
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query(TABLE_NAMES.TRANSACTION_RECONCILIATION_ISSUES)
      .withIndex("by_issue_status", (q) =>
        q.eq("issue_status", TransactionReconciliationIssueStatus.OPEN),
      )
      .paginate({
        numItems: RECONCILIATION_READ_PAGE_SIZE,
        cursor: args.cursor,
      });

    return {
      page: result.page.map((issue) => issue._id),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const _getTransactionReferencesByIds = internalQuery({
  args: {
    transactionIds: v.array(v.id("transactions")),
  },
  returns: transactionReferenceLookupValidator,
  handler: async (ctx, args) => {
    const transactions = await Promise.all(
      args.transactionIds.map(
        async (transactionId) => await ctx.db.get(transactionId),
      ),
    );

    return transactions
      .filter((transaction) => transaction !== null)
      .map((transaction) => ({
        _id: transaction._id,
        reference: transaction.reference,
      }));
  },
});

export const _startReconciliationRun = internalMutation({
  args: {
    startedAt: v.number(),
  },
  returns: v.id("transaction_reconciliation_runs"),
  handler: async (ctx, args) => {
    const runId = await ctx.db.insert(
      TABLE_NAMES.TRANSACTION_RECONCILIATION_RUNS,
      {
        status: TransactionReconciliationRunStatus.RUNNING,
        started_at: args.startedAt,
        completed_at: undefined,
        issue_count: 0,
        user_count: 0,
        plan_count: 0,
        transaction_count: 0,
        created_at: args.startedAt,
      },
    );

    await auditLog.log(ctx, {
      action: "transaction.reconciliation.started",
      resourceType: RESOURCE_TYPE.TRANSACTION_RECONCILIATION_RUNS,
      resourceId: runId,
      severity: "info",
    });

    return runId;
  },
});

export const _resolveReconciliationIssuesBatch = internalMutation({
  args: {
    issueIds: v.array(v.id("transaction_reconciliation_issues")),
    resolvedAt: v.number(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let resolved = 0;

    for (const issueId of args.issueIds) {
      const oldIssue = await ctx.db.get(issueId);
      if (
        !oldIssue ||
        oldIssue.issue_status !== TransactionReconciliationIssueStatus.OPEN
      ) {
        continue;
      }

      await ctx.db.patch(issueId, {
        issue_status: TransactionReconciliationIssueStatus.RESOLVED,
        resolved_at: args.resolvedAt,
      });

      const newIssue = await ctx.db.get(issueId);
      if (newIssue) {
        await syncReconciliationIssueUpdate(ctx, oldIssue, newIssue);
      }

      resolved += 1;
    }

    return resolved;
  },
});

export const _insertReconciliationIssuesBatch = internalMutation({
  args: {
    runId: v.id("transaction_reconciliation_runs"),
    issues: v.array(reconciliationIssueInputValidator),
  },
  returns: v.array(v.id("transaction_reconciliation_issues")),
  handler: async (ctx, args) => {
    const insertedIssueIds: TransactionReconciliationIssueId[] = [];

    for (const issue of args.issues) {
      const issueId = await ctx.db.insert(
        TABLE_NAMES.TRANSACTION_RECONCILIATION_ISSUES,
        {
          run_id: args.runId,
          ...issue,
        },
      );

      const createdIssue = await ctx.db.get(issueId);
      if (createdIssue) {
        await syncReconciliationIssueInsert(ctx, createdIssue);
      }

      insertedIssueIds.push(issueId);
    }

    return insertedIssueIds;
  },
});

export const _deleteReconciliationIssuesBatch = internalMutation({
  args: {
    issueIds: v.array(v.id("transaction_reconciliation_issues")),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let deleted = 0;

    for (const issueId of args.issueIds) {
      const issue = await ctx.db.get(issueId);
      if (!issue) {
        continue;
      }

      await syncReconciliationIssueDelete(ctx, issue);
      await ctx.db.delete(issueId);
      deleted += 1;
    }

    return deleted;
  },
});

export const _restoreReconciliationIssuesBatch = internalMutation({
  args: {
    issueIds: v.array(v.id("transaction_reconciliation_issues")),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let restored = 0;

    for (const issueId of args.issueIds) {
      const oldIssue = await ctx.db.get(issueId);
      if (
        !oldIssue ||
        oldIssue.issue_status === TransactionReconciliationIssueStatus.OPEN
      ) {
        continue;
      }

      await ctx.db.patch(issueId, {
        issue_status: TransactionReconciliationIssueStatus.OPEN,
        resolved_at: undefined,
      });

      const newIssue = await ctx.db.get(issueId);
      if (newIssue) {
        await syncReconciliationIssueUpdate(ctx, oldIssue, newIssue);
      }

      restored += 1;
    }

    return restored;
  },
});

export const _completeReconciliationRun = internalMutation({
  args: {
    runId: v.id("transaction_reconciliation_runs"),
    completedAt: v.number(),
    issueCount: v.number(),
    userCount: v.number(),
    planCount: v.number(),
    transactionCount: v.number(),
  },
  returns: reconciliationRunValidator,
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      status: TransactionReconciliationRunStatus.COMPLETED,
      completed_at: args.completedAt,
      issue_count: args.issueCount,
      user_count: args.userCount,
      plan_count: args.planCount,
      transaction_count: args.transactionCount,
    });

    const run = await ctx.db.get(args.runId);
    if (!run) {
      throw new ConvexError("Failed to persist reconciliation run");
    }

    await auditLog.log(ctx, {
      action: "transaction.reconciliation.completed",
      resourceType: RESOURCE_TYPE.TRANSACTION_RECONCILIATION_RUNS,
      resourceId: args.runId,
      severity: args.issueCount > 0 ? "warning" : "info",
      metadata: {
        issue_count: args.issueCount,
        user_count: args.userCount,
        plan_count: args.planCount,
        transaction_count: args.transactionCount,
      },
    });

    await createConvexEventOutboxService(ctx).append([
      {
        eventType: NotificationEventType.RECONCILIATION_RUN_COMPLETED,
        sourceKind: "system",
        resourceType: RESOURCE_TYPE.TRANSACTION_RECONCILIATION_RUNS,
        resourceId: String(args.runId),
        dedupeKey: `reconciliation_run_completed:${args.runId}:${args.completedAt}`,
        occurredAt: args.completedAt,
        payload: {
          run_id: String(args.runId),
          issue_count: args.issueCount,
          user_count: args.userCount,
          plan_count: args.planCount,
          transaction_count: args.transactionCount,
          completed_at: args.completedAt,
        },
      },
    ]);

    return run;
  },
});

export const _recordReconciliationFailure = internalMutation({
  args: {
    runId: v.id("transaction_reconciliation_runs"),
    completedAt: v.number(),
    error: v.string(),
  },
  returns: reconciliationRunValidator,
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      status: TransactionReconciliationRunStatus.FAILED,
      completed_at: args.completedAt,
    });

    await auditLog.log(ctx, {
      action: "transaction.reconciliation.failed",
      resourceType: RESOURCE_TYPE.TRANSACTION_RECONCILIATION_RUNS,
      resourceId: args.runId,
      severity: "error",
      metadata: {
        error: args.error,
      },
    });

    await createConvexEventOutboxService(ctx).append([
      {
        eventType: NotificationEventType.RECONCILIATION_RUN_FAILED,
        sourceKind: "system",
        resourceType: RESOURCE_TYPE.TRANSACTION_RECONCILIATION_RUNS,
        resourceId: String(args.runId),
        dedupeKey: `reconciliation_run_failed:${args.runId}:${args.completedAt}`,
        occurredAt: args.completedAt,
        payload: {
          run_id: String(args.runId),
          error: args.error,
          failed_at: args.completedAt,
        },
      },
    ]);

    const failedRun = await ctx.db.get(args.runId);
    if (!failedRun) {
      throw new ConvexError("Failed to persist failed reconciliation run");
    }

    return failedRun;
  },
});

export const runReconciliation = internalAction({
  args: {},
  returns: reconciliationRunValidator,
  handler: async (ctx): Promise<TransactionReconciliationRun> => {
    const startedAt = Date.now();
    const runId: TransactionReconciliationRunId = await ctx.runMutation(
      internal.transactions._startReconciliationRun,
      {
        startedAt,
      },
    );
    const previousOpenIssueIds: TransactionReconciliationIssueId[] = [];
    const insertedIssueIds: TransactionReconciliationIssueId[] = [];

    try {
      let openIssueCursor: string | null = null;

      for (;;) {
        const result: ReconciliationIssueIdsPage = await ctx.runQuery(
          internal.transactions._getOpenReconciliationIssueIdsPage,
          { cursor: openIssueCursor },
        );

        previousOpenIssueIds.push(...result.page);

        if (result.isDone) {
          break;
        }

        openIssueCursor = result.continueCursor;
      }

      const reversalCandidatesByOriginalId = new Map<
        string,
        Array<{
          transactionId: TransactionId;
          reference: string;
          expectedOriginalReference: string;
          originalTransactionId: TransactionId;
        }>
      >();
      const userProjectedBalances = new Map<
        string,
        { totalBalanceKobo: bigint; savingsBalanceKobo: bigint }
      >();
      const planProjectedAmounts = new Map<string, bigint>();
      let issueCount = 0;
      let transactionCount = 0;
      let transactionCursor: string | null = null;
      let pendingIssues: Array<ReturnType<typeof buildReconciliationIssue>> =
        [];

      const flushPendingIssues = async () => {
        if (pendingIssues.length === 0) return;

        const newIssueIds = await ctx.runMutation(
          internal.transactions._insertReconciliationIssuesBatch,
          { runId, issues: pendingIssues },
        );
        insertedIssueIds.push(...newIssueIds);
        pendingIssues = [];
      };

      const appendIssue = async (
        issue: ReturnType<typeof buildReconciliationIssue>,
      ) => {
        pendingIssues.push(issue);
        issueCount += 1;

        if (pendingIssues.length >= RECONCILIATION_WRITE_BATCH_SIZE) {
          await flushPendingIssues();
        }
      };

      for (;;) {
        const result: ReconciliationTransactionPage = await ctx.runQuery(
          internal.transactions._getReconciliationTransactionsPage,
          { cursor: transactionCursor },
        );

        transactionCount += result.page.length;

        for (const transaction of result.page) {
          const effectiveType = getEffectiveType(transaction);
          const delta = computeProjectionDelta(
            effectiveType,
            transaction.amount_kobo,
            transaction.user_plan_id,
          );

          const userId = String(transaction.user_id);
          const userBal = userProjectedBalances.get(userId) ?? {
            totalBalanceKobo: 0n,
            savingsBalanceKobo: 0n,
          };
          userBal.totalBalanceKobo += delta.totalBalanceKobo;
          userBal.savingsBalanceKobo += delta.savingsBalanceKobo;
          userProjectedBalances.set(userId, userBal);

          if (transaction.user_plan_id) {
            const planId = String(transaction.user_plan_id);
            const planAmount = planProjectedAmounts.get(planId) ?? 0n;
            planProjectedAmounts.set(planId, planAmount + delta.planAmountKobo);
          }

          if (transaction.type !== TxnType.REVERSAL) {
            continue;
          }

          if (
            !transaction.reversal_of_transaction_id ||
            !transaction.reversal_of_reference
          ) {
            await appendIssue(
              buildReconciliationIssue({
                issueType: TransactionReconciliationIssueType.ORPHANED_REVERSAL,
                createdAt: startedAt,
                transactionId: transaction._id,
                reference: transaction.reference,
                details: {
                  reason: "Reversal is missing original transaction linkage",
                },
              }),
            );
            continue;
          }

          const originalId = String(transaction.reversal_of_transaction_id);
          const trackedReversals =
            reversalCandidatesByOriginalId.get(originalId) ?? [];
          trackedReversals.push({
            transactionId: transaction._id,
            reference: transaction.reference,
            expectedOriginalReference: transaction.reversal_of_reference,
            originalTransactionId: transaction.reversal_of_transaction_id,
          });
          reversalCandidatesByOriginalId.set(originalId, trackedReversals);
        }

        if (result.isDone) {
          break;
        }

        transactionCursor = result.continueCursor;
      }

      let userCount = 0;
      let userCursor: string | null = null;

      for (;;) {
        const result: ReconciliationUsersPage = await ctx.runQuery(
          internal.transactions._getReconciliationUsersPage,
          { cursor: userCursor },
        );

        userCount += result.page.length;

        for (const user of result.page) {
          const projected = userProjectedBalances.get(String(user._id)) ?? {
            totalBalanceKobo: 0n,
            savingsBalanceKobo: 0n,
          };

          if (projected.totalBalanceKobo !== user.total_balance_kobo) {
            await appendIssue(
              buildReconciliationIssue({
                issueType:
                  TransactionReconciliationIssueType.USER_TOTAL_BALANCE_MISMATCH,
                createdAt: startedAt,
                userId: user._id,
                expectedAmountKobo: projected.totalBalanceKobo,
                actualAmountKobo: user.total_balance_kobo,
              }),
            );
          }

          if (projected.savingsBalanceKobo !== user.savings_balance_kobo) {
            await appendIssue(
              buildReconciliationIssue({
                issueType:
                  TransactionReconciliationIssueType.USER_SAVINGS_BALANCE_MISMATCH,
                createdAt: startedAt,
                userId: user._id,
                expectedAmountKobo: projected.savingsBalanceKobo,
                actualAmountKobo: user.savings_balance_kobo,
              }),
            );
          }
        }

        if (result.isDone) {
          break;
        }

        userCursor = result.continueCursor;
      }

      let planCount = 0;
      let planCursor: string | null = null;

      for (;;) {
        const result: ReconciliationPlansPage = await ctx.runQuery(
          internal.transactions._getReconciliationPlansPage,
          { cursor: planCursor },
        );

        planCount += result.page.length;

        for (const plan of result.page) {
          const projectedAmount =
            planProjectedAmounts.get(String(plan._id)) ?? 0n;
          if (projectedAmount !== plan.current_amount_kobo) {
            await appendIssue(
              buildReconciliationIssue({
                issueType:
                  TransactionReconciliationIssueType.PLAN_CURRENT_AMOUNT_MISMATCH,
                createdAt: startedAt,
                userId: plan.user_id,
                userPlanId: plan._id,
                expectedAmountKobo: projectedAmount,
                actualAmountKobo: plan.current_amount_kobo,
              }),
            );
          }
        }

        if (result.isDone) {
          break;
        }

        planCursor = result.continueCursor;
      }

      const originalTransactionIds = [
        ...reversalCandidatesByOriginalId.values(),
      ];
      const originalReferencesById = new Map<string, string>();

      for (const reversalBatch of chunkArray(
        originalTransactionIds,
        RECONCILIATION_WRITE_BATCH_SIZE,
      )) {
        const transactionIds = reversalBatch.map(
          (reversalEntries) => reversalEntries[0]!.originalTransactionId,
        );
        const originals: TransactionReferenceLookup = await ctx.runQuery(
          internal.transactions._getTransactionReferencesByIds,
          {
            transactionIds,
          },
        );

        for (const original of originals) {
          originalReferencesById.set(String(original._id), original.reference);
        }
      }

      for (const [
        originalId,
        trackedReversals,
      ] of reversalCandidatesByOriginalId.entries()) {
        const originalReference = originalReferencesById.get(originalId);
        const validReversals: typeof trackedReversals = [];

        for (const reversal of trackedReversals) {
          if (
            !originalReference ||
            originalReference !== reversal.expectedOriginalReference
          ) {
            await appendIssue(
              buildReconciliationIssue({
                issueType: TransactionReconciliationIssueType.ORPHANED_REVERSAL,
                createdAt: startedAt,
                transactionId: reversal.transactionId,
                reference: reversal.reference,
                details: {
                  expected_original_reference:
                    reversal.expectedOriginalReference,
                  reason:
                    "Original transaction is missing or reference does not match",
                },
              }),
            );
            continue;
          }

          validReversals.push(reversal);
        }

        if (validReversals.length <= 1) {
          continue;
        }

        await appendIssue(
          buildReconciliationIssue({
            issueType: TransactionReconciliationIssueType.DOUBLE_REVERSAL,
            createdAt: startedAt,
            transactionId: validReversals[0]?.originalTransactionId,
            reference: originalReference,
            details: {
              reversal_transaction_ids: validReversals.map((transaction) =>
                String(transaction.transactionId),
              ),
              reversal_references: validReversals.map(
                (transaction) => transaction.reference,
              ),
            },
          }),
        );
      }

      const completedAt = Date.now();

      for (const issueIds of chunkArray(
        previousOpenIssueIds,
        RECONCILIATION_WRITE_BATCH_SIZE,
      )) {
        if (issueIds.length === 0) continue;

        await ctx.runMutation(
          internal.transactions._resolveReconciliationIssuesBatch,
          { issueIds, resolvedAt: completedAt },
        );
      }

      await flushPendingIssues();

      return await ctx.runMutation(
        internal.transactions._completeReconciliationRun,
        {
          runId,
          completedAt,
          issueCount,
          userCount,
          planCount,
          transactionCount,
        },
      );
    } catch (error) {
      const completedAt = Date.now();
      const failureMessage =
        error instanceof Error ? error.message : "Unknown error";

      try {
        for (const issueIds of chunkArray(
          insertedIssueIds,
          RECONCILIATION_WRITE_BATCH_SIZE,
        )) {
          if (issueIds.length === 0) continue;

          await ctx.runMutation(
            internal.transactions._deleteReconciliationIssuesBatch,
            { issueIds },
          );
        }

        for (const issueIds of chunkArray(
          previousOpenIssueIds,
          RECONCILIATION_WRITE_BATCH_SIZE,
        )) {
          if (issueIds.length === 0) continue;

          await ctx.runMutation(
            internal.transactions._restoreReconciliationIssuesBatch,
            { issueIds },
          );
        }
      } catch (cleanupError) {
        const cleanupMessage =
          cleanupError instanceof Error
            ? cleanupError.message
            : "unknown reconciliation cleanup error";

        return await ctx.runMutation(
          internal.transactions._recordReconciliationFailure,
          {
            runId,
            completedAt,
            error: `${failureMessage}; cleanup failed: ${cleanupMessage}`,
          },
        );
      }

      return await ctx.runMutation(
        internal.transactions._recordReconciliationFailure,
        { runId, completedAt, error: failureMessage },
      );
    }
  },
});

/**
 * Fetches a paginated list of the current user's transactions.
 * Supports filtering by type, plan, and date range.
 */
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
      },
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
      },
    );
  },
});

/**
 * Administrative query for searching and auditing transactions across all users.
 * Optimized for performance using various indices depending on the provided filters.
 */
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
        },
      );
    }

    if (args.planId) {
      return await paginateTransactionSummaries(
        ctx.db
          .query(TABLE_NAMES.TRANSACTIONS)
          .withIndex("by_user_plan_id", (q) =>
            q.eq("user_plan_id", args.planId),
          )
          .collect(),
        args.paginationOpts,
        {
          userId: args.userId,
          type: args.type,
          planId: args.planId,
          dateFrom: args.dateFrom,
          dateTo: args.dateTo,
        },
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
        },
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
        },
      );
    }

    return await paginateTransactionSummaries(
      ctx.db.query(TABLE_NAMES.TRANSACTIONS).collect(),
      args.paginationOpts,
      {
        dateFrom: args.dateFrom,
        dateTo: args.dateTo,
      },
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
        q.eq("issue_status", TransactionReconciliationIssueStatus.OPEN),
      )
      .order("desc")
      .take(limit);
  },
});
