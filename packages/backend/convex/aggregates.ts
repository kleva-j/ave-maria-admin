/**
 * Aggregates Module
 *
 * High-performance denormalized counts and sums using @convex-dev/aggregate
 * Provides O(log n) queries instead of O(n) table scans
 *
 * Aggregate Types:
 * - Simple counts: Total records in a table
 * - Grouped counts: Records grouped by user, status, type, etc.
 * - Sums: Total amounts across transactions/plans
 * - Namespaced: Isolated aggregations per tenant/user
 */
import type { DataModel } from "./_generated/dataModel";

import { TableAggregate } from "@convex-dev/aggregate";

import { components } from "./_generated/api";

import type {
  TransactionReconciliationRunId,
  SavingsPlanTemplateId,
  UserSavingsPlanId,
  UserId,
} from "./types";

import {
  WithdrawalStatus,
  TABLE_NAMES,
  UserStatus,
  PlanStatus,
  TxnType,
} from "./shared";

// ============================================================================
// TRANSACTION AGGREGATES
// ============================================================================

/**
 * Total transaction count across all users
 * Key: null (global count)
 * Use case: Dashboard metrics, total transaction volume
 */
export const totalTransactions = new TableAggregate<{
  Key: null;
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.TRANSACTIONS;
}>(components.totalTransactions, {
  sortKey: () => null,
});

/**
 * Transactions grouped by user
 * Key: [userId] - enables per-user queries
 * Use case: User transaction history count, user activity tracking
 */
export const transactionsByUser = new TableAggregate<{
  Key: UserId;
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.TRANSACTIONS;
}>(components.transactionsByUser, {
  sortKey: (doc) => doc.user_id,
});

/**
 * Transactions grouped by type
 * Key: [type] - enables queries by transaction type
 * Use case: Analytics by transaction type (contributions, withdrawals, etc.)
 */
export const transactionsByType = new TableAggregate<{
  Key: TxnType;
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.TRANSACTIONS;
}>(components.transactionsByType, {
  sortKey: (doc) => doc.type,
});

/**
 * Transactions with amount sums
 * Key: null (global sum)
 * Sum field: amount_kobo
 * Use case: Total transaction volume in monetary terms
 */
export const totalTransactionAmount = new TableAggregate<{
  Key: null;
  Value: bigint;
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.TRANSACTIONS;
}>(components.totalTransactionAmount, {
  sortKey: () => null,
  sumValue: (doc) => Number(doc.amount_kobo),
});

/**
 * Transaction amounts by user
 * Key: [userId]
 * Sum field: amount_kobo
 * Use case: Total deposits/withdrawals per user
 */
export const transactionAmountByUser = new TableAggregate<{
  Key: UserId;
  Value: bigint;
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.TRANSACTIONS;
}>(components.transactionAmountByUser, {
  sortKey: (doc) => doc.user_id,
  sumValue: (doc) => Number(doc.amount_kobo),
});

/**
 * Transaction amounts by type
 * Key: [type]
 * Sum field: amount_kobo
 * Use case: Total amount by transaction type
 */
export const transactionAmountByType = new TableAggregate<{
  Key: TxnType;
  Value: bigint;
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.TRANSACTIONS;
}>(components.transactionAmountByType, {
  sortKey: (doc) => doc.type,
  sumValue: (doc) => Number(doc.amount_kobo),
});

// ============================================================================
// SAVINGS PLAN AGGREGATES
// ============================================================================

/**
 * Total savings plans count
 * Key: null (global count)
 * Use case: Total number of plans created
 */
export const totalSavingsPlans = new TableAggregate<{
  Key: null;
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.USER_SAVINGS_PLANS;
}>(components.totalSavingsPlans, {
  sortKey: () => null,
});

/**
 * Savings plans grouped by user
 * Key: [userId]
 * Use case: Count plans per user, user engagement metrics
 */
export const savingsPlansByUser = new TableAggregate<{
  Key: UserId;
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.USER_SAVINGS_PLANS;
}>(components.savingsPlansByUser, {
  sortKey: (doc) => doc.user_id,
});

/**
 * Savings plans grouped by status
 * Key: [status]
 * Use case: Active vs paused vs completed plans count
 */
export const savingsPlansByStatus = new TableAggregate<{
  Key: PlanStatus;
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.USER_SAVINGS_PLANS;
}>(components.savingsPlansByStatus, {
  sortKey: (doc) => doc.status,
});

/**
 * Savings plans by user and status (composite)
 * Key: [userId, status]
 * Use case: Count active plans per user, completed plans per user
 */
export const savingsPlansByUserAndStatus = new TableAggregate<{
  Key: [UserId, PlanStatus];
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.USER_SAVINGS_PLANS;
}>(components.savingsPlansByUserAndStatus, {
  sortKey: (doc) => [doc.user_id, doc.status],
});

/**
 * Total current amount across all savings plans
 * Key: null
 * Sum field: current_amount_kobo
 * Use case: Total savings under management
 */
export const totalSavingsAmount = new TableAggregate<{
  Key: null;
  Value: bigint;
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.USER_SAVINGS_PLANS;
}>(components.totalSavingsAmount, {
  sortKey: () => null,
  sumValue: (doc) => Number(doc.current_amount_kobo),
});

/**
 * Total savings plan amount by user and template
 * Key: [userId, templateId]
 * Sum field: current_amount_kobo
 * Use case: Total savings under management
 */
export const savingsPlanAmountByUserAndTemplate = new TableAggregate<{
  Key: [UserId, SavingsPlanTemplateId];
  Value: bigint;
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.USER_SAVINGS_PLANS;
}>(components.savingsPlanAmountByUserAndTemplate, {
  sortKey: (doc) => [doc.user_id, doc.template_id],
  sumValue: (doc) => Number(doc.current_amount_kobo),
});

/**
 * Savings amount by user
 * Key: [userId]
 * Sum field: current_amount_kobo
 * Use case: Total savings per user
 */
export const savingsAmountByUser = new TableAggregate<{
  Key: UserId;
  Value: bigint;
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.USER_SAVINGS_PLANS;
}>(components.savingsAmountByUser, {
  sortKey: (doc) => doc.user_id,
  sumValue: (doc) => Number(doc.current_amount_kobo),
});

/**
 * Savings amount by status
 * Key: [status]
 * Sum field: current_amount_kobo
 * Use case: Total amount in active vs completed plans
 */
export const savingsAmountByStatus = new TableAggregate<{
  Key: PlanStatus;
  Value: bigint;
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.USER_SAVINGS_PLANS;
}>(components.savingsAmountByStatus, {
  sortKey: (doc) => doc.status,
  sumValue: (doc) => Number(doc.current_amount_kobo),
});

/**
 * Savings amount by template
 * Key: [templateId]
 * Sum field: current_amount_kobo
 * Use case: Total amount in active vs completed plans
 */
export const savingsAmountByTemplate = new TableAggregate<{
  Key: SavingsPlanTemplateId;
  Value: bigint;
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.USER_SAVINGS_PLANS;
}>(components.savingsAmountByTemplate, {
  sortKey: (doc) => doc.template_id,
  sumValue: (doc) => Number(doc.current_amount_kobo),
});

/**
 * Target amount vs current amount by plan
 * Key: [planId, targetAmount]
 * Use case: Track progress toward goals, find plans close to target
 */
export const planProgress = new TableAggregate<{
  Key: [UserSavingsPlanId, bigint];
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.USER_SAVINGS_PLANS;
}>(components.planProgress, {
  sortKey: (doc) => [doc._id, doc.custom_target_kobo],
});

// ============================================================================
// USER AGGREGATES
// ============================================================================

/**
 * Total users count
 * Key: null (global count)
 * Use case: Total registered users
 */
export const totalUsers = new TableAggregate<{
  Key: null;
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.USERS;
}>(components.totalUsers, {
  sortKey: () => null,
});

/**
 * Users grouped by status
 * Key: [status]
 * Use case: Active vs pending_kyc vs suspended users
 */
export const usersByStatus = new TableAggregate<{
  Key: UserStatus;
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.USERS;
}>(components.usersByStatus, {
  sortKey: (doc) => doc.status,
});

/**
 * Users with onboarding complete
 * Key: [onboarding_complete]
 * Use case: Track onboarding conversion rate
 */
export const usersByOnboardingStatus = new TableAggregate<{
  Key: boolean;
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.USERS;
}>(components.usersByOnboardingStatus, {
  sortKey: (doc) => doc.onboarding_complete,
});

/**
 * User balances sum
 * Key: null
 * Sum field: total_balance_kobo
 * Use case: Total user funds under management (AUM)
 */
export const totalUserBalance = new TableAggregate<{
  Key: null;
  Value: bigint;
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.USERS;
}>(components.totalUserBalance, {
  sortKey: () => null,
  sumValue: (doc) => Number(doc.total_balance_kobo),
});

/**
 * User savings balances sum
 * Key: null
 * Sum field: savings_balance_kobo
 * Use case: Total savings balance across all users
 */
export const totalUserSavingsBalance = new TableAggregate<{
  Key: null;
  Value: bigint;
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.USERS;
}>(components.totalUserSavingsBalance, {
  sortKey: () => null,
  sumValue: (doc) => Number(doc.savings_balance_kobo),
});

// ============================================================================
// TRANSACTION RECONCILIATION ISSUES AGGREGATES
// ============================================================================

/**
 * Total reconciliation issues count
 * Key: null (global count)
 * Use case: Total issues detected
 */
export const totalReconciliationIssues = new TableAggregate<{
  Key: null;
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.TRANSACTION_RECONCILIATION_ISSUES;
}>(components.totalReconciliationIssues, {
  sortKey: () => null,
});

/**
 * Reconciliation issues by status
 * Key: [issue_status]
 * Use case: Open vs resolved issues count
 */
export const reconciliationIssuesByStatus = new TableAggregate<{
  Key: string; // IssueStatus as string
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.TRANSACTION_RECONCILIATION_ISSUES;
}>(components.reconciliationIssuesByStatus, {
  sortKey: (doc) => doc.issue_status,
});

/**
 * Reconciliation issues by type
 * Key: [issue_type]
 * Use case: Breakdown by issue type (balance mismatch, double reversal, etc.)
 */
export const reconciliationIssuesByType = new TableAggregate<{
  Key: string; // IssueType as string
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.TRANSACTION_RECONCILIATION_ISSUES;
}>(components.reconciliationIssuesByType, {
  sortKey: (doc) => doc.issue_type,
});

/**
 * Reconciliation issues by run
 * Key: [run_id]
 * Use case: Issues detected per reconciliation run
 */
export const reconciliationIssuesByRun = new TableAggregate<{
  Key: TransactionReconciliationRunId;
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.TRANSACTION_RECONCILIATION_ISSUES;
}>(components.reconciliationIssuesByRun, {
  sortKey: (doc) => doc.run_id,
});

/**
 * Reconciliation issues by user
 * Key: [user_id]
 * Use case: Issues per user (identify problematic accounts)
 */
export const reconciliationIssuesByUser = new TableAggregate<{
  Key: UserId;
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.TRANSACTION_RECONCILIATION_ISSUES;
}>(components.reconciliationIssuesByUser, {
  sortKey: (doc) => doc.user_id!,
});

// ============================================================================
// WITHDRAWAL AGGREGATES (Bonus)
// ============================================================================

/**
 * Total withdrawals count
 * Key: null
 * Use case: Total withdrawal requests
 */
export const totalWithdrawals = new TableAggregate<{
  Key: null;
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.WITHDRAWALS;
}>(components.totalWithdrawals, {
  sortKey: () => null,
});

/**
 * Withdrawals by status
 * Key: [status]
 * Use case: Pending vs approved vs rejected withdrawals
 */
export const withdrawalsByStatus = new TableAggregate<{
  Key: WithdrawalStatus;
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.WITHDRAWALS;
}>(components.withdrawalsByStatus, {
  sortKey: (doc) => doc.status,
});

/**
 * Withdrawals by user
 * Key: [user_id]
 * Use case: Pending vs approved vs rejected withdrawals
 */
export const withdrawalsByUser = new TableAggregate<{
  Key: UserId;
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.WITHDRAWALS;
}>(components.withdrawalsByUser, {
  sortKey: (doc) => doc.requested_by,
});

/**
 * Withdrawal amounts by status
 * Key: [status]
 * Sum field: requested_amount_kobo (from transaction reference)
 * Note: Would need to join with transaction for actual amount
 */
// This would require a more complex setup - commented out for now
export const withdrawalAmountsByStatus = new TableAggregate<{
  Key: [WithdrawalStatus, bigint];
  Value: bigint;
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.WITHDRAWALS;
}>(components.withdrawalAmountsByStatus, {
  sortKey: (doc) => [doc.status, doc.requested_amount_kobo],
  sumValue: (doc) => Number(doc.requested_amount_kobo),
});
