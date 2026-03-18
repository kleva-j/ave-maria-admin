import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

export type Context = QueryCtx | MutationCtx;

// Users
export type AdminUserId = Id<"admin_users">;
export type AdminUser = Doc<"admin_users">;
export type UserId = Id<"users">;
export type User = Doc<"users">;

// Savings Plans
export type UserSavingsPlanId = Id<"user_savings_plans">;
export type UserSavingsPlan = Doc<"user_savings_plans">;

// KYC
export type KycDocument = Doc<"kyc_documents">;
export type KycData = {
  user: User;
  documents: KycDocument[];
};

// Bank Accounts
export type UserBankAccount = Doc<"user_bank_accounts">;
export type UserBankAccountId = Id<"user_bank_accounts">;

export type UserBankAccountEvent = Doc<"user_bank_account_events">;
export type UserBankAccountEventId = Id<"user_bank_account_events">;

export type BankAccountDocument = Doc<"bank_account_documents">;
export type BankAccountDocumentId = Id<"bank_account_documents">;

// Transactions and withdrawals
export type Transaction = Doc<"transactions">;
export type TransactionId = Id<"transactions">;
export type Withdrawal = Doc<"withdrawals">;
export type WithdrawalId = Id<"withdrawals">;
export type TransactionReconciliationRun =
  Doc<"transaction_reconciliation_runs">;
export type TransactionReconciliationRunId =
  Id<"transaction_reconciliation_runs">;
export type TransactionReconciliationIssue =
  Doc<"transaction_reconciliation_issues">;
export type TransactionReconciliationIssueId =
  Id<"transaction_reconciliation_issues">;

// Storage
export type StorageId = Id<"_storage">;
