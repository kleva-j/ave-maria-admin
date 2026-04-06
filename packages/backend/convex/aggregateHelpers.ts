/**
 * Aggregate Helper Functions
 *
 * Wrapper functions for aggregate operations with automatic sync
 * Import these in your mutations to keep aggregates up-to-date
 */
import type { MutationCtx } from "./_generated/server";

import type {
  TransactionReconciliationIssue,
  UserSavingsPlan,
  Transaction,
  Withdrawal,
  User,
} from "./types";

import {
  reconciliationIssuesByStatus,
  reconciliationIssuesByType,
  reconciliationIssuesByUser,
  reconciliationIssuesByRun,
  totalReconciliationIssues,
  savingsPlansByStatus,
  withdrawalsByStatus,
  transactionsByUser,
  transactionsByType,
  savingsPlansByUser,
  totalTransactions,
  totalSavingsPlans,
  totalWithdrawals,
  usersByStatus,
  totalUsers,
} from "./aggregates";

// ============================================================================
// TRANSACTION HELPERS
// ============================================================================

/**
 * Sync transaction insertion with aggregates
 * Call this after inserting a transaction
 */
export async function syncTransactionInsert(
  ctx: MutationCtx,
  transaction: Transaction,
) {
  await Promise.all([
    totalTransactions.insert(ctx, transaction),
    transactionsByUser.insert(ctx, transaction),
    transactionsByType.insert(ctx, transaction),
  ]);
}

/**
 * Sync transaction update with aggregates
 * Call this when updating a transaction (rare)
 */
export async function syncTransactionUpdate(
  ctx: MutationCtx,
  oldTransaction: Transaction,
  newTransaction: Transaction,
) {
  await Promise.all([
    totalTransactions.replace(ctx, oldTransaction, newTransaction),
    transactionsByUser.replace(ctx, oldTransaction, newTransaction),
    transactionsByType.replace(ctx, oldTransaction, newTransaction),
  ]);
}

/**
 * Sync transaction deletion with aggregates
 * Call this after deleting a transaction
 */
export async function syncTransactionDelete(
  ctx: MutationCtx,
  transaction: Transaction,
) {
  await Promise.all([
    totalTransactions.delete(ctx, transaction),
    transactionsByUser.delete(ctx, transaction),
    transactionsByType.delete(ctx, transaction),
  ]);
}

// ============================================================================
// SAVINGS PLAN HELPERS
// ============================================================================

/**
 * Sync savings plan insertion with aggregates
 * Call this after creating a savings plan
 */
export async function syncSavingsPlanInsert(
  ctx: MutationCtx,
  plan: UserSavingsPlan,
) {
  await Promise.all([
    totalSavingsPlans.insert(ctx, plan),
    savingsPlansByUser.insert(ctx, plan),
    savingsPlansByStatus.insert(ctx, plan),
  ]);
}

/**
 * Sync savings plan update with aggregates
 * Call this when updating a plan (especially status changes)
 */
export async function syncSavingsPlanUpdate(
  ctx: MutationCtx,
  oldPlan: UserSavingsPlan,
  newPlan: UserSavingsPlan,
) {
  await Promise.all([
    totalSavingsPlans.replace(ctx, oldPlan, newPlan),
    savingsPlansByUser.replace(ctx, oldPlan, newPlan),
    savingsPlansByStatus.replace(ctx, oldPlan, newPlan),
  ]);
}

/**
 * Sync savings plan deletion with aggregates
 * Call this after deleting a savings plan
 */
export async function syncSavingsPlanDelete(
  ctx: MutationCtx,
  plan: UserSavingsPlan,
) {
  await Promise.all([
    totalSavingsPlans.delete(ctx, plan),
    savingsPlansByUser.delete(ctx, plan),
    savingsPlansByStatus.delete(ctx, plan),
  ]);
}

// ============================================================================
// USER HELPERS
// ============================================================================

/**
 * Sync user creation with aggregates
 * Call this after creating a user
 */
export async function syncUserInsert(ctx: MutationCtx, user: User) {
  await Promise.all([
    totalUsers.insert(ctx, user),
    usersByStatus.insert(ctx, user),
  ]);
}

/**
 * Sync user update with aggregates
 * Call this when updating user status
 */
export async function syncUserUpdate(
  ctx: MutationCtx,
  oldUser: User,
  newUser: User,
) {
  await Promise.all([
    totalUsers.replace(ctx, oldUser, newUser),
    usersByStatus.replace(ctx, oldUser, newUser),
  ]);
}

/**
 * Sync user deletion with aggregates
 * Call this after deleting a user
 */
export async function syncUserDelete(ctx: MutationCtx, user: User) {
  await Promise.all([
    totalUsers.delete(ctx, user),
    usersByStatus.delete(ctx, user),
  ]);
}

// ============================================================================
// RECONCILIATION ISSUE HELPERS
// ============================================================================

/**
 * Sync reconciliation issue insertion with aggregates
 * Call this after creating an issue
 */
export async function syncReconciliationIssueInsert(
  ctx: MutationCtx,
  issue: TransactionReconciliationIssue,
) {
  await Promise.all([
    totalReconciliationIssues.insert(ctx, issue),
    reconciliationIssuesByStatus.insert(ctx, issue),
    reconciliationIssuesByType.insert(ctx, issue),
    reconciliationIssuesByRun.insert(ctx, issue),
    issue.user_id
      ? reconciliationIssuesByUser.insert(ctx, issue)
      : Promise.resolve(),
  ]);
}

/**
 * Sync reconciliation issue update with aggregates
 * Call this when resolving an issue
 */
export async function syncReconciliationIssueUpdate(
  ctx: MutationCtx,
  oldIssue: TransactionReconciliationIssue,
  newIssue: TransactionReconciliationIssue,
) {
  await Promise.all([
    totalReconciliationIssues.replace(ctx, oldIssue, newIssue),
    reconciliationIssuesByStatus.replace(ctx, oldIssue, newIssue),
    reconciliationIssuesByType.replace(ctx, oldIssue, newIssue),
    reconciliationIssuesByRun.replace(ctx, oldIssue, newIssue),
    oldIssue.user_id && newIssue.user_id
      ? reconciliationIssuesByUser.replace(ctx, oldIssue, newIssue)
      : oldIssue.user_id && !newIssue.user_id
        ? reconciliationIssuesByUser.delete(ctx, oldIssue)
        : !oldIssue.user_id && newIssue.user_id
          ? reconciliationIssuesByUser.insert(ctx, newIssue)
          : Promise.resolve(),
  ]);
}

export async function syncReconciliationIssueDelete(
  ctx: MutationCtx,
  issue: TransactionReconciliationIssue,
) {
  await Promise.all([
    totalReconciliationIssues.delete(ctx, issue),
    reconciliationIssuesByStatus.delete(ctx, issue),
    reconciliationIssuesByType.delete(ctx, issue),
    reconciliationIssuesByRun.delete(ctx, issue),
    issue.user_id
      ? reconciliationIssuesByUser.delete(ctx, issue)
      : Promise.resolve(),
  ]);
}

// ============================================================================
// WITHDRAWAL HELPERS
// ============================================================================

/**
 * Sync withdrawal insertion with aggregates
 * Call this after creating a withdrawal
 */
export async function syncWithdrawalInsert(
  ctx: MutationCtx,
  withdrawal: Withdrawal,
) {
  await Promise.all([
    totalWithdrawals.insert(ctx, withdrawal),
    withdrawalsByStatus.insert(ctx, withdrawal),
  ]);
}

/**
 * Sync withdrawal update with aggregates
 * Call this when updating a withdrawal status
 */
export async function syncWithdrawalUpdate(
  ctx: MutationCtx,
  oldWithdrawal: Withdrawal,
  newWithdrawal: Withdrawal,
) {
  await Promise.all([
    totalWithdrawals.replace(ctx, oldWithdrawal, newWithdrawal),
    withdrawalsByStatus.replace(ctx, oldWithdrawal, newWithdrawal),
  ]);
}
