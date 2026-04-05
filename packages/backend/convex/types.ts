import type { Auth } from "convex/server";

import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

// Context
export type Context = QueryCtx | MutationCtx;
export type AuthContext = Context & { auth: Auth };

// Users
export type AdminUserId = Id<"admin_users">;
export type AdminUser = Doc<"admin_users">;
export type UserId = Id<"users">;
export type User = Doc<"users">;

// Savings Plans
export type UserSavingsPlanId = Id<"user_savings_plans">;
export type UserSavingsPlan = Doc<"user_savings_plans">;

export type SavingsPlanTemplateId = Id<"savings_plan_templates">;
export type SavingsPlanTemplate = Doc<"savings_plan_templates">;

// KYC
export type KycDocument = Doc<"kyc_documents">;
export type KycDocumentId = Id<"kyc_documents">;

export type KycData = { user: User; documents: KycDocument[] };

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
export type WithdrawalReservation = Doc<"withdrawal_reservations">;
export type WithdrawalReservationId = Id<"withdrawal_reservations">;
export type TransactionReconciliationRun =
  Doc<"transaction_reconciliation_runs">;
export type TransactionReconciliationRunId =
  Id<"transaction_reconciliation_runs">;
export type TransactionReconciliationIssue =
  Doc<"transaction_reconciliation_issues">;
export type TransactionReconciliationIssueId =
  Id<"transaction_reconciliation_issues">;
export type UserRiskHold = Doc<"user_risk_holds">;
export type UserRiskHoldId = Id<"user_risk_holds">;
export type RiskEvent = Doc<"risk_events">;
export type RiskEventId = Id<"risk_events">;

// Storage
export type StorageId = Id<"_storage">;
