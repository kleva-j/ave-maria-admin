export const UserStatus = {
  ACTIVE: "active",
  PENDING_KYC: "pending_kyc",
  SUSPENDED: "suspended",
  CLOSED: "closed",
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const PlanStatus = {
  ACTIVE: "active",
  PAUSED: "paused",
  COMPLETED: "completed",
  EXPIRED: "expired",
} as const;

export type PlanStatus = (typeof PlanStatus)[keyof typeof PlanStatus];

export const TxnType = {
  CONTRIBUTION: "contribution",
  INTEREST_ACCRUAL: "interest_accrual",
  WITHDRAWAL: "withdrawal",
  REFERRAL_BONUS: "referral_bonus",
  REVERSAL: "reversal",
  INVESTMENT_YIELD: "investment_yield",
} as const;

export type TxnType = (typeof TxnType)[keyof typeof TxnType];

export const TransactionSource = {
  USER: "user",
  ADMIN: "admin",
  SYSTEM: "system",
} as const;

export type TransactionSource =
  (typeof TransactionSource)[keyof typeof TransactionSource];

export const WithdrawalMethod = {
  BANK_TRANSFER: "bank_transfer",
  CASH: "cash",
} as const;

export type WithdrawalMethod =
  (typeof WithdrawalMethod)[keyof typeof WithdrawalMethod];

export const WithdrawalStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  PROCESSED: "processed",
} as const;

export type WithdrawalStatus =
  (typeof WithdrawalStatus)[keyof typeof WithdrawalStatus];

export const WithdrawalReservationStatus = {
  ACTIVE: "active",
  RELEASED: "released",
  CONSUMED: "consumed",
} as const;

export type WithdrawalReservationStatus =
  (typeof WithdrawalReservationStatus)[keyof typeof WithdrawalReservationStatus];

export const WithdrawalAction = {
  APPROVE: "approve",
  REJECT: "reject",
  PROCESS: "process",
} as const;

export type WithdrawalAction =
  (typeof WithdrawalAction)[keyof typeof WithdrawalAction];

export const KycStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type KycStatus = (typeof KycStatus)[keyof typeof KycStatus];

export const AdminRole = {
  SUPER_ADMIN: "super_admin",
  OPERATIONS: "operations",
  FINANCE: "finance",
  COMPLIANCE: "compliance",
  SUPPORT: "support",
} as const;

export type AdminRole = (typeof AdminRole)[keyof typeof AdminRole];

export const BankAccountVerificationStatus = {
  PENDING: "pending",
  VERIFIED: "verified",
  REJECTED: "rejected",
} as const;

export type BankAccountVerificationStatus =
  (typeof BankAccountVerificationStatus)[keyof typeof BankAccountVerificationStatus];

export const DocumentType = {
  GOVERNMENT_ID: "government_id",
  PROOF_OF_ADDRESS: "proof_of_address",
  BANK_STATEMENT: "bank_statement",
  SELFIE_WITH_ID: "selfie_with_id",
} as const;

export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const RiskHoldScope = {
  WITHDRAWALS: "withdrawals",
} as const;

export type RiskHoldScope = (typeof RiskHoldScope)[keyof typeof RiskHoldScope];

export const RiskHoldStatus = {
  ACTIVE: "active",
  RELEASED: "released",
} as const;

export type RiskHoldStatus =
  (typeof RiskHoldStatus)[keyof typeof RiskHoldStatus];

export const RiskSeverity = {
  INFO: "info",
  WARNING: "warning",
  CRITICAL: "critical",
} as const;

export type RiskSeverity = (typeof RiskSeverity)[keyof typeof RiskSeverity];

export const RiskEventType = {
  WITHDRAWAL_BLOCKED_HOLD: "withdrawal_blocked_hold",
  WITHDRAWAL_BLOCKED_DAILY_AMOUNT: "withdrawal_blocked_daily_amount",
  WITHDRAWAL_BLOCKED_DAILY_COUNT: "withdrawal_blocked_daily_count",
  WITHDRAWAL_BLOCKED_VELOCITY: "withdrawal_blocked_velocity",
  WITHDRAWAL_BLOCKED_BANK_COOLDOWN: "withdrawal_blocked_bank_cooldown",
  HOLD_PLACED: "hold_placed",
  HOLD_RELEASED: "hold_released",
} as const;

export type RiskEventType = (typeof RiskEventType)[keyof typeof RiskEventType];

export const TransactionReconciliationIssueType = {
  USER_TOTAL_BALANCE_MISMATCH: "user_total_balance_mismatch",
  USER_SAVINGS_BALANCE_MISMATCH: "user_savings_balance_mismatch",
  PLAN_CURRENT_AMOUNT_MISMATCH: "plan_current_amount_mismatch",
  DOUBLE_REVERSAL: "double_reversal",
  ORPHANED_REVERSAL: "orphaned_reversal",
} as const;

export type TransactionReconciliationIssueType =
  (typeof TransactionReconciliationIssueType)[keyof typeof TransactionReconciliationIssueType];

export const TransactionReconciliationIssueStatus = {
  OPEN: "open",
  RESOLVED: "resolved",
} as const;

export type TransactionReconciliationIssueStatus =
  (typeof TransactionReconciliationIssueStatus)[keyof typeof TransactionReconciliationIssueStatus];

export const TransactionReconciliationRunStatus = {
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type TransactionReconciliationRunStatus =
  (typeof TransactionReconciliationRunStatus)[keyof typeof TransactionReconciliationRunStatus];

export const ResourceType = {
  USER: "user",
  ADMIN_USER: "admin_user",
  BANK_ACCOUNT: "user_bank_account",
  TRANSACTION: "transaction",
  WITHDRAWAL: "withdrawal",
  SAVINGS_PLAN: "user_savings_plan",
  RISK_EVENT: "risk_event",
  USER_RISK_HOLD: "user_risk_hold",
} as const;

export type ResourceType = (typeof ResourceType)[keyof typeof ResourceType];
