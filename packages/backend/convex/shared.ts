import { v } from "convex/values";

// Database Table Names
export const TABLE_NAMES = {
  USERS: "users",
  ADMIN_USERS: "admin_users",
  WITHDRAWALS: "withdrawals",
  RISK_EVENTS: "risk_events",
  TRANSACTIONS: "transactions",
  ADMIN_ALERTS: "admin_alerts",
  KYC_DOCUMENTS: "kyc_documents",
  USER_RISK_HOLDS: "user_risk_holds",
  USER_SAVINGS_PLANS: "user_savings_plans",
  USER_BANK_ACCOUNTS: "user_bank_accounts",
  NOTIFICATION_EVENTS: "notification_events",
  ADMIN_ALERT_RECEIPTS: "admin_alert_receipts",
  ADMIN_DASHBOARD_KPIS: "admin_dashboard_kpis",
  BANK_ACCOUNT_DOCUMENTS: "bank_account_documents",
  SAVINGS_PLAN_TEMPLATES: "savings_plan_templates",
  WITHDRAWAL_RESERVATIONS: "withdrawal_reservations",
  USER_BANK_ACCOUNT_EVENTS: "user_bank_account_events",
  BANK_ACCOUNT_DOCUMENT_COMMENTS: "bank_account_document_comments",
  TRANSACTION_RECONCILIATION_RUNS: "transaction_reconciliation_runs",
  TRANSACTION_RECONCILIATION_ISSUES: "transaction_reconciliation_issues",
} as const;

export type TableName = (typeof TABLE_NAMES)[keyof typeof TABLE_NAMES];

// Constants for file validation
export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];
export const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

export const DOCUMENT_TYPES = {
  GOVERNMENT_ID: "government_id",
  PROOF_OF_ADDRESS: "proof_of_address",
  BANK_STATEMENT: "bank_statement",
  SELFIE_WITH_ID: "selfie_with_id",
} as const;

export const KycDocumentType = v.union(
  v.literal(DOCUMENT_TYPES.GOVERNMENT_ID),
  v.literal(DOCUMENT_TYPES.PROOF_OF_ADDRESS),
  v.literal(DOCUMENT_TYPES.BANK_STATEMENT),
  v.literal(DOCUMENT_TYPES.SELFIE_WITH_ID),
);

export type KycDocumentType = typeof KycDocumentType.type;

// Document types for bank account verification
export const bankAccountDocumentType = v.union(
  v.literal(DOCUMENT_TYPES.GOVERNMENT_ID), // International passport, Driver's license, National ID
  v.literal(DOCUMENT_TYPES.PROOF_OF_ADDRESS), // Utility bill, Bank statement
  v.literal(DOCUMENT_TYPES.BANK_STATEMENT), // Recent bank statement
  v.literal(DOCUMENT_TYPES.SELFIE_WITH_ID), // Selfie with ID
);

export type BankAccountDocumentType = typeof bankAccountDocumentType.type;

/**
 * User status
 */
export const UserStatus = {
  ACTIVE: "active",
  PENDING_KYC: "pending_kyc",
  SUSPENDED: "suspended",
  CLOSED: "closed",
} as const;

export const userStatus = v.union(
  v.literal(UserStatus.ACTIVE),
  v.literal(UserStatus.PENDING_KYC),
  v.literal(UserStatus.SUSPENDED),
  v.literal(UserStatus.CLOSED),
);

export type UserStatus = typeof userStatus.type;

/**
 * Plan status
 */
export const PlanStatus = {
  ACTIVE: "active",
  PAUSED: "paused",
  COMPLETED: "completed",
  EXPIRED: "expired",
} as const;

export const planStatus = v.union(
  v.literal(PlanStatus.ACTIVE),
  v.literal(PlanStatus.PAUSED),
  v.literal(PlanStatus.COMPLETED),
  v.literal(PlanStatus.EXPIRED),
);

export type PlanStatus = typeof planStatus.type;

/**
 * Transaction types
 */
export const TxnType = {
  CONTRIBUTION: "contribution",
  INTEREST_ACCRUAL: "interest_accrual",
  WITHDRAWAL: "withdrawal",
  REFERRAL_BONUS: "referral_bonus",
  REVERSAL: "reversal",
  INVESTMENT_YIELD: "investment_yield",
} as const;

export const txnType = v.union(
  v.literal(TxnType.CONTRIBUTION),
  v.literal(TxnType.INTEREST_ACCRUAL),
  v.literal(TxnType.WITHDRAWAL),
  v.literal(TxnType.REFERRAL_BONUS),
  v.literal(TxnType.REVERSAL),
  v.literal(TxnType.INVESTMENT_YIELD),
);

export type TxnType = typeof txnType.type;

/**
 * Transaction source
 */
export const TransactionSource = {
  USER: "user",
  ADMIN: "admin",
  SYSTEM: "system",
} as const;

export const transactionSource = v.union(
  v.literal(TransactionSource.USER),
  v.literal(TransactionSource.ADMIN),
  v.literal(TransactionSource.SYSTEM),
);

export type TransactionSource = typeof transactionSource.type;

/**
 * Withdrawal payout method
 */
export const WithdrawalMethod = {
  BANK_TRANSFER: "bank_transfer",
  CASH: "cash",
} as const;

export const withdrawalMethod = v.union(
  v.literal(WithdrawalMethod.BANK_TRANSFER),
  v.literal(WithdrawalMethod.CASH),
);

export type WithdrawalMethod = typeof withdrawalMethod.type;

/**
 * Withdrawal status for bank accounts
 */
export const WithdrawalStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  PROCESSED: "processed",
} as const;

export const withdrawalStatus = v.union(
  v.literal(WithdrawalStatus.PENDING),
  v.literal(WithdrawalStatus.APPROVED),
  v.literal(WithdrawalStatus.REJECTED),
  v.literal(WithdrawalStatus.PROCESSED),
);

export const WithdrawalReservationStatus = {
  ACTIVE: "active",
  RELEASED: "released",
  CONSUMED: "consumed",
} as const;

export const withdrawalReservationStatus = v.union(
  v.literal(WithdrawalReservationStatus.ACTIVE),
  v.literal(WithdrawalReservationStatus.RELEASED),
  v.literal(WithdrawalReservationStatus.CONSUMED),
);

export const WithdrawalAction = {
  APPROVE: "approve",
  REJECT: "reject",
  PROCESS: "process",
} as const;

export const withdrawalAction = v.union(
  v.literal(WithdrawalAction.APPROVE),
  v.literal(WithdrawalAction.REJECT),
  v.literal(WithdrawalAction.PROCESS),
);

export type WithdrawalStatus = typeof withdrawalStatus.type;
export type WithdrawalReservationStatus =
  typeof withdrawalReservationStatus.type;
export type WithdrawalAction = typeof withdrawalAction.type;

/**
 * KYC status for bank accounts
 */
export const KYCStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export const kycStatus = v.union(
  v.literal(KYCStatus.PENDING),
  v.literal(KYCStatus.APPROVED),
  v.literal(KYCStatus.REJECTED),
);

export type KycStatus = typeof kycStatus.type;

/**
 * Admin roles
 */
export const AdminRole = {
  SUPER_ADMIN: "super_admin",
  OPERATIONS: "operations",
  FINANCE: "finance",
  COMPLIANCE: "compliance",
  SUPPORT: "support",
} as const;

export const adminRole = v.union(
  v.literal(AdminRole.SUPER_ADMIN),
  v.literal(AdminRole.OPERATIONS),
  v.literal(AdminRole.FINANCE),
  v.literal(AdminRole.COMPLIANCE),
  v.literal(AdminRole.SUPPORT),
);

export type AdminRole = typeof adminRole.type;

/**
 * Bank account verification status
 */
export const BankAccountVerificationStatus = {
  PENDING: "pending",
  VERIFIED: "verified",
  REJECTED: "rejected",
} as const;

export const bankAccountVerificationStatus = v.union(
  v.literal(BankAccountVerificationStatus.PENDING),
  v.literal(BankAccountVerificationStatus.VERIFIED),
  v.literal(BankAccountVerificationStatus.REJECTED),
);

export type BankAccountVerificationStatus =
  typeof bankAccountVerificationStatus.type;

/**
 * Transaction reconciliation run status
 */
export const TransactionReconciliationRunStatus = {
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export const transactionReconciliationRunStatus = v.union(
  v.literal(TransactionReconciliationRunStatus.RUNNING),
  v.literal(TransactionReconciliationRunStatus.COMPLETED),
  v.literal(TransactionReconciliationRunStatus.FAILED),
);

export type TransactionReconciliationRunStatus =
  typeof transactionReconciliationRunStatus.type;

/**
 * Transaction reconciliation issue type
 */
export const TransactionReconciliationIssueType = {
  USER_TOTAL_BALANCE_MISMATCH: "user_total_balance_mismatch",
  USER_SAVINGS_BALANCE_MISMATCH: "user_savings_balance_mismatch",
  PLAN_CURRENT_AMOUNT_MISMATCH: "plan_current_amount_mismatch",
  DOUBLE_REVERSAL: "double_reversal",
  ORPHANED_REVERSAL: "orphaned_reversal",
} as const;

export const transactionReconciliationIssueType = v.union(
  v.literal(TransactionReconciliationIssueType.USER_TOTAL_BALANCE_MISMATCH),
  v.literal(TransactionReconciliationIssueType.USER_SAVINGS_BALANCE_MISMATCH),
  v.literal(TransactionReconciliationIssueType.PLAN_CURRENT_AMOUNT_MISMATCH),
  v.literal(TransactionReconciliationIssueType.DOUBLE_REVERSAL),
  v.literal(TransactionReconciliationIssueType.ORPHANED_REVERSAL),
);

export type TransactionReconciliationIssueType =
  typeof transactionReconciliationIssueType.type;

/**
 * Transaction reconciliation issue status
 */
export const TransactionReconciliationIssueStatus = {
  OPEN: "open",
  RESOLVED: "resolved",
} as const;

export const transactionReconciliationIssueStatus = v.union(
  v.literal(TransactionReconciliationIssueStatus.OPEN),
  v.literal(TransactionReconciliationIssueStatus.RESOLVED),
);

export type TransactionReconciliationIssueStatus =
  typeof transactionReconciliationIssueStatus.type;

/**
 * Risk hold scope and status
 */
export const RiskHoldScope = {
  WITHDRAWALS: "withdrawals",
} as const;

export const riskHoldScope = v.union(v.literal(RiskHoldScope.WITHDRAWALS));

export type RiskHoldScope = typeof riskHoldScope.type;

export const RiskHoldStatus = {
  ACTIVE: "active",
  RELEASED: "released",
} as const;

export const riskHoldStatus = v.union(
  v.literal(RiskHoldStatus.ACTIVE),
  v.literal(RiskHoldStatus.RELEASED),
);

export type RiskHoldStatus = typeof riskHoldStatus.type;

/**
 * Risk events
 */
export const RiskEventType = {
  WITHDRAWAL_BLOCKED_HOLD: "withdrawal_blocked_hold",
  WITHDRAWAL_BLOCKED_DAILY_AMOUNT: "withdrawal_blocked_daily_amount",
  WITHDRAWAL_BLOCKED_DAILY_COUNT: "withdrawal_blocked_daily_count",
  WITHDRAWAL_BLOCKED_VELOCITY: "withdrawal_blocked_velocity",
  WITHDRAWAL_BLOCKED_BANK_COOLDOWN: "withdrawal_blocked_bank_cooldown",
  HOLD_PLACED: "hold_placed",
  HOLD_RELEASED: "hold_released",
} as const;

export const riskEventType = v.union(
  v.literal(RiskEventType.WITHDRAWAL_BLOCKED_HOLD),
  v.literal(RiskEventType.WITHDRAWAL_BLOCKED_DAILY_AMOUNT),
  v.literal(RiskEventType.WITHDRAWAL_BLOCKED_DAILY_COUNT),
  v.literal(RiskEventType.WITHDRAWAL_BLOCKED_VELOCITY),
  v.literal(RiskEventType.WITHDRAWAL_BLOCKED_BANK_COOLDOWN),
  v.literal(RiskEventType.HOLD_PLACED),
  v.literal(RiskEventType.HOLD_RELEASED),
);

export type RiskEventType = typeof riskEventType.type;

export const RiskSeverity = {
  INFO: "info",
  WARNING: "warning",
  CRITICAL: "critical",
} as const;

export const riskSeverity = v.union(
  v.literal(RiskSeverity.INFO),
  v.literal(RiskSeverity.WARNING),
  v.literal(RiskSeverity.CRITICAL),
);

export type RiskSeverity = typeof riskSeverity.type;

/**
 * Bank account event types
 */
export const BankAccountEventType = {
  CREATED: "created",
  UPDATED: "updated",
  SET_PRIMARY: "set_primary",
  VERIFICATION_STATUS_CHANGED: "verification_status_changed",
  DELETED: "deleted",
  DOCUMENT_UPLOADED: "document_uploaded",
  VERIFICATION_SUBMITTED: "verification_submitted",
  VERIFICATION_APPROVED: "verification_approved",
  VERIFICATION_REJECTED: "verification_rejected",
  KYC_VERIFICATION_STARTED: "kyc_verification_started",
  KYC_VERIFICATION_COMPLETED: "kyc_verification_completed",
  KYC_VERIFICATION_FAILED: "kyc_verification_failed",
  DOCUMENT_COMMENT_ADDED: "document_comment_added",
  DOCUMENT_ISSUE_RESOLVED: "document_issue_resolved",
} as const;

export const bankAccountEventType = v.union(
  v.literal(BankAccountEventType.CREATED),
  v.literal(BankAccountEventType.UPDATED),
  v.literal(BankAccountEventType.SET_PRIMARY),
  v.literal(BankAccountEventType.VERIFICATION_STATUS_CHANGED),
  v.literal(BankAccountEventType.DELETED),
  v.literal(BankAccountEventType.DOCUMENT_UPLOADED),
  v.literal(BankAccountEventType.VERIFICATION_SUBMITTED),
  v.literal(BankAccountEventType.VERIFICATION_APPROVED),
  v.literal(BankAccountEventType.VERIFICATION_REJECTED),
  v.literal(BankAccountEventType.KYC_VERIFICATION_STARTED),
  v.literal(BankAccountEventType.KYC_VERIFICATION_COMPLETED),
  v.literal(BankAccountEventType.KYC_VERIFICATION_FAILED),
  v.literal(BankAccountEventType.DOCUMENT_COMMENT_ADDED),
  v.literal(BankAccountEventType.DOCUMENT_ISSUE_RESOLVED),
);

export type BankAccountEventType = typeof bankAccountEventType.type;

/**
 * Resource types for audit log
 */
export const RESOURCE_TYPE = {
  USER: "user",
  USERS: "users",
  ADMIN_USER: "admin_user",
  ADMIN_ALERT: "admin_alert",
  ADMIN_ALERTS: "admin_alerts",
  ADMIN_ALERT_RECEIPT: "admin_alert_receipt",
  ADMIN_ALERT_RECEIPTS: "admin_alert_receipts",
  NOTIFICATION_EVENT: "notification_event",
  NOTIFICATION_EVENTS: "notification_events",
  BANK_ACCOUNT: "user_bank_account",
  BANK_ACCOUNTS: "user_bank_accounts",
  BANK_ACCOUNT_DOCUMENT: "bank_account_document",
  BANK_ACCOUNT_DOCUMENTS: "bank_account_documents",
  BANK_ACCOUNT_DOCUMENT_COMMENT: "bank_account_document_comment",
  BANK_ACCOUNT_DOCUMENT_COMMENTS: "bank_account_document_comments",
  TRANSACTION: "transaction",
  TRANSACTIONS: "transactions",
  WITHDRAWAL: "withdrawal",
  WITHDRAWALS: "withdrawals",
  WITHDRAWAL_RESERVATION: "withdrawal_reservation",
  WITHDRAWAL_RESERVATIONS: "withdrawal_reservations",
  SAVINGS_PLAN: "user_savings_plan",
  SAVINGS_PLANS: "user_savings_plans",
  SAVINGS_PLAN_TEMPLATE: "savings_plan_template",
  SAVINGS_PLAN_TEMPLATES: "savings_plan_templates",
  KYC_DOCUMENT: "kyc_document",
  KYC_DOCUMENTS: "kyc_documents",
  TRANSACTION_RECONCILIATION_RUN: "transaction_reconciliation_run",
  TRANSACTION_RECONCILIATION_RUNS: "transaction_reconciliation_runs",
  TRANSACTION_RECONCILIATION_ISSUE: "transaction_reconciliation_issue",
  TRANSACTION_RECONCILIATION_ISSUES: "transaction_reconciliation_issues",
  USER_RISK_HOLD: "user_risk_hold",
  USER_RISK_HOLDS: "user_risk_holds",
  RISK_EVENT: "risk_event",
  RISK_EVENTS: "risk_events",
} as const;

export const resourceType = v.union(
  v.literal(RESOURCE_TYPE.USER),
  v.literal(RESOURCE_TYPE.ADMIN_USER),
  v.literal(RESOURCE_TYPE.ADMIN_ALERT),
  v.literal(RESOURCE_TYPE.ADMIN_ALERTS),
  v.literal(RESOURCE_TYPE.ADMIN_ALERT_RECEIPT),
  v.literal(RESOURCE_TYPE.ADMIN_ALERT_RECEIPTS),
  v.literal(RESOURCE_TYPE.NOTIFICATION_EVENT),
  v.literal(RESOURCE_TYPE.NOTIFICATION_EVENTS),
  v.literal(RESOURCE_TYPE.BANK_ACCOUNT),
  v.literal(RESOURCE_TYPE.BANK_ACCOUNTS),
  v.literal(RESOURCE_TYPE.BANK_ACCOUNT_DOCUMENT),
  v.literal(RESOURCE_TYPE.BANK_ACCOUNT_DOCUMENTS),
  v.literal(RESOURCE_TYPE.BANK_ACCOUNT_DOCUMENT_COMMENT),
  v.literal(RESOURCE_TYPE.BANK_ACCOUNT_DOCUMENT_COMMENTS),
  v.literal(RESOURCE_TYPE.TRANSACTION),
  v.literal(RESOURCE_TYPE.TRANSACTIONS),
  v.literal(RESOURCE_TYPE.WITHDRAWAL),
  v.literal(RESOURCE_TYPE.WITHDRAWALS),
  v.literal(RESOURCE_TYPE.WITHDRAWAL_RESERVATION),
  v.literal(RESOURCE_TYPE.WITHDRAWAL_RESERVATIONS),
  v.literal(RESOURCE_TYPE.SAVINGS_PLAN),
  v.literal(RESOURCE_TYPE.SAVINGS_PLANS),
  v.literal(RESOURCE_TYPE.SAVINGS_PLAN_TEMPLATE),
  v.literal(RESOURCE_TYPE.SAVINGS_PLAN_TEMPLATES),
  v.literal(RESOURCE_TYPE.KYC_DOCUMENT),
  v.literal(RESOURCE_TYPE.KYC_DOCUMENTS),
  v.literal(RESOURCE_TYPE.TRANSACTION_RECONCILIATION_RUN),
  v.literal(RESOURCE_TYPE.TRANSACTION_RECONCILIATION_RUNS),
  v.literal(RESOURCE_TYPE.TRANSACTION_RECONCILIATION_ISSUE),
  v.literal(RESOURCE_TYPE.TRANSACTION_RECONCILIATION_ISSUES),
  v.literal(RESOURCE_TYPE.USER_RISK_HOLD),
  v.literal(RESOURCE_TYPE.USER_RISK_HOLDS),
  v.literal(RESOURCE_TYPE.RISK_EVENT),
  v.literal(RESOURCE_TYPE.RISK_EVENTS),
);

export type ResourceType = typeof resourceType.type;

/**
 * Verification status for bank accounts
 * - pending: Awaiting verification
 * - verified: Successfully verified
 * - rejected: Verification failed or rejected
 */
export const VERIFICATION_STATUS = {
  PENDING: "pending",
  VERIFIED: "verified",
  REJECTED: "rejected",
} as const;

export const verificationStatus = v.union(
  v.literal(VERIFICATION_STATUS.PENDING),
  v.literal(VERIFICATION_STATUS.VERIFIED),
  v.literal(VERIFICATION_STATUS.REJECTED),
);

/**
 * KYC verification status for bank accounts
 */
export const KYC_VERIFICATION_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export const kycVerificationStatus = v.union(
  v.literal(KYC_VERIFICATION_STATUS.PENDING),
  v.literal(KYC_VERIFICATION_STATUS.APPROVED),
  v.literal(KYC_VERIFICATION_STATUS.REJECTED),
);

/**
 * Event types for bank account audit trail
 * Tracks all state changes throughout an account's lifecycle
 */
export const EVENT_TYPE = {
  CREATED: "created",
  UPDATED: "updated",
  SET_PRIMARY: "set_primary",
  VERIFICATION_STATUS_CHANGED: "verification_status_changed",
  DELETED: "deleted",
  DOCUMENT_UPLOADED: "document_uploaded",
  VERIFICATION_SUBMITTED: "verification_submitted",
  VERIFICATION_APPROVED: "verification_approved",
  VERIFICATION_REJECTED: "verification_rejected",
  // KYC Automation
  KYC_VERIFICATION_STARTED: "kyc_verification_started",
  KYC_VERIFICATION_COMPLETED: "kyc_verification_completed",
  KYC_VERIFICATION_FAILED: "kyc_verification_failed",
  // Document Review
  DOCUMENT_COMMENT_ADDED: "document_comment_added",
  DOCUMENT_ISSUE_RESOLVED: "document_issue_resolved",
  USER_PROFILE_SYNCED: "user_profile_synced",
} as const;

export const eventType = v.union(
  v.literal(EVENT_TYPE.CREATED),
  v.literal(EVENT_TYPE.UPDATED),
  v.literal(EVENT_TYPE.SET_PRIMARY),
  v.literal(EVENT_TYPE.VERIFICATION_STATUS_CHANGED),
  v.literal(EVENT_TYPE.DELETED),
  v.literal(EVENT_TYPE.DOCUMENT_UPLOADED),
  v.literal(EVENT_TYPE.VERIFICATION_SUBMITTED),
  v.literal(EVENT_TYPE.VERIFICATION_APPROVED),
  v.literal(EVENT_TYPE.VERIFICATION_REJECTED),
  v.literal(EVENT_TYPE.KYC_VERIFICATION_STARTED),
  v.literal(EVENT_TYPE.KYC_VERIFICATION_COMPLETED),
  v.literal(EVENT_TYPE.KYC_VERIFICATION_FAILED),
  v.literal(EVENT_TYPE.DOCUMENT_COMMENT_ADDED),
  v.literal(EVENT_TYPE.DOCUMENT_ISSUE_RESOLVED),
  v.literal(EVENT_TYPE.USER_PROFILE_SYNCED),
);

// Type aliases for validator types
// These extract the TypeScript types from Convex validators for type-safe usage
export type EventType = typeof eventType.type;
export type VerificationStatus = typeof verificationStatus.type;

/**
 * Comment types for bank account document comments
 */
export const COMMENT_TYPE = {
  GENERAL: "general",
  ISSUE: "issue",
  APPROVAL_NOTE: "approval_note",
  REJECTION_REASON: "rejection_reason",
} as const;

export const commentType = v.union(
  v.literal(COMMENT_TYPE.GENERAL), // General comments/note
  v.literal(COMMENT_TYPE.ISSUE), // Issue with the document / Problem identified
  v.literal(COMMENT_TYPE.APPROVAL_NOTE), // Approval note
  v.literal(COMMENT_TYPE.REJECTION_REASON), // Specific rejection reason
);

export type CommentType = typeof commentType.type;

export const NOTIFICATION_SOURCE_KIND = {
  USER: "user",
  ADMIN: "admin",
  SYSTEM: "system",
} as const;

export const notificationSourceKind = v.union(
  v.literal(NOTIFICATION_SOURCE_KIND.USER),
  v.literal(NOTIFICATION_SOURCE_KIND.ADMIN),
  v.literal(NOTIFICATION_SOURCE_KIND.SYSTEM),
);

export type NotificationSourceKind = typeof notificationSourceKind.type;

export const SYSTEM_ACTOR_TYPE = {
  CRON: "cron",
  WORKER: "worker",
} as const;

export const systemActorType = v.union(
  v.literal(SYSTEM_ACTOR_TYPE.CRON),
  v.literal(SYSTEM_ACTOR_TYPE.WORKER),
);

export type SystemActorType = typeof systemActorType.type;

export const NOTIFICATION_EVENT_PROCESSING_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  PROCESSED: "processed",
  FAILED: "failed",
} as const;

export const notificationEventProcessingStatus = v.union(
  v.literal(NOTIFICATION_EVENT_PROCESSING_STATUS.PENDING),
  v.literal(NOTIFICATION_EVENT_PROCESSING_STATUS.PROCESSING),
  v.literal(NOTIFICATION_EVENT_PROCESSING_STATUS.PROCESSED),
  v.literal(NOTIFICATION_EVENT_PROCESSING_STATUS.FAILED),
);

export type NotificationEventProcessingStatus =
  typeof notificationEventProcessingStatus.type;

export const NotificationEventType = {
  WITHDRAWAL_REQUESTED: "withdrawal_requested",
  WITHDRAWAL_APPROVED: "withdrawal_approved",
  WITHDRAWAL_REJECTED: "withdrawal_rejected",
  WITHDRAWAL_PROCESSED: "withdrawal_processed",
  WITHDRAWAL_PROCESSING_FAILED: "withdrawal_processing_failed",
  KYC_DECISION_APPLIED: "kyc_decision_applied",
  BANK_VERIFICATION_SUBMITTED: "bank_verification_submitted",
  BANK_VERIFICATION_APPROVED: "bank_verification_approved",
  BANK_VERIFICATION_REJECTED: "bank_verification_rejected",
  RECONCILIATION_RUN_COMPLETED: "reconciliation_run_completed",
  RECONCILIATION_RUN_FAILED: "reconciliation_run_failed",
} as const;

export const notificationEventType = v.union(
  v.literal(NotificationEventType.WITHDRAWAL_REQUESTED),
  v.literal(NotificationEventType.WITHDRAWAL_APPROVED),
  v.literal(NotificationEventType.WITHDRAWAL_REJECTED),
  v.literal(NotificationEventType.WITHDRAWAL_PROCESSED),
  v.literal(NotificationEventType.WITHDRAWAL_PROCESSING_FAILED),
  v.literal(NotificationEventType.KYC_DECISION_APPLIED),
  v.literal(NotificationEventType.BANK_VERIFICATION_SUBMITTED),
  v.literal(NotificationEventType.BANK_VERIFICATION_APPROVED),
  v.literal(NotificationEventType.BANK_VERIFICATION_REJECTED),
  v.literal(NotificationEventType.RECONCILIATION_RUN_COMPLETED),
  v.literal(NotificationEventType.RECONCILIATION_RUN_FAILED),
);

export type NotificationEventType = typeof notificationEventType.type;

export const AdminAlertType = {
  WITHDRAWALS_PENDING_OLDEST: "withdrawals_pending_oldest",
  WITHDRAWALS_APPROVED_UNPROCESSED_OLDEST:
    "withdrawals_approved_unprocessed_oldest",
  KYC_PENDING_OLDEST: "kyc_pending_oldest",
  BANK_VERIFICATION_PENDING_OLDEST: "bank_verification_pending_oldest",
  RECONCILIATION_RUN_FAILED: "reconciliation_run_failed",
  RECONCILIATION_RUN_STALE: "reconciliation_run_stale",
  RECONCILIATION_OPEN_ISSUES: "reconciliation_open_issues",
} as const;

export const adminAlertType = v.union(
  v.literal(AdminAlertType.WITHDRAWALS_PENDING_OLDEST),
  v.literal(AdminAlertType.WITHDRAWALS_APPROVED_UNPROCESSED_OLDEST),
  v.literal(AdminAlertType.KYC_PENDING_OLDEST),
  v.literal(AdminAlertType.BANK_VERIFICATION_PENDING_OLDEST),
  v.literal(AdminAlertType.RECONCILIATION_RUN_FAILED),
  v.literal(AdminAlertType.RECONCILIATION_RUN_STALE),
  v.literal(AdminAlertType.RECONCILIATION_OPEN_ISSUES),
);

export type AdminAlertType = typeof adminAlertType.type;

export const AdminAlertScope = {
  WITHDRAWALS: "withdrawals",
  KYC: "kyc",
  BANK_VERIFICATION: "bank_verification",
  RECONCILIATION: "reconciliation",
  SYSTEM: "system",
} as const;

export const adminAlertScope = v.union(
  v.literal(AdminAlertScope.WITHDRAWALS),
  v.literal(AdminAlertScope.KYC),
  v.literal(AdminAlertScope.BANK_VERIFICATION),
  v.literal(AdminAlertScope.RECONCILIATION),
  v.literal(AdminAlertScope.SYSTEM),
);

export type AdminAlertScope = typeof adminAlertScope.type;

export const AdminAlertSeverity = {
  WARNING: "warning",
  CRITICAL: "critical",
} as const;

export const adminAlertSeverity = v.union(
  v.literal(AdminAlertSeverity.WARNING),
  v.literal(AdminAlertSeverity.CRITICAL),
);

export type AdminAlertSeverity = typeof adminAlertSeverity.type;

export const AdminAlertStatus = {
  ACTIVE: "active",
  RESOLVED: "resolved",
} as const;

export const adminAlertStatus = v.union(
  v.literal(AdminAlertStatus.ACTIVE),
  v.literal(AdminAlertStatus.RESOLVED),
);

export type AdminAlertStatus = typeof adminAlertStatus.type;

export const AdminAlertReceiptState = {
  UNREAD: "unread",
  SEEN: "seen",
  ACKNOWLEDGED: "acknowledged",
} as const;

export const adminAlertReceiptState = v.union(
  v.literal(AdminAlertReceiptState.UNREAD),
  v.literal(AdminAlertReceiptState.SEEN),
  v.literal(AdminAlertReceiptState.ACKNOWLEDGED),
);

export type AdminAlertReceiptState = typeof adminAlertReceiptState.type;

export const ADMIN_ALERT_RESOLUTION_KIND = {
  AUTOMATIC: "automatic",
  MANUAL: "manual",
} as const;

export const adminAlertResolutionKind = v.union(
  v.literal(ADMIN_ALERT_RESOLUTION_KIND.AUTOMATIC),
  v.literal(ADMIN_ALERT_RESOLUTION_KIND.MANUAL),
);

export type AdminAlertResolutionKind = typeof adminAlertResolutionKind.type;

export const adminAlertResolvedBy = v.object({
  actor_type: v.union(v.literal("admin"), v.literal("system")),
  admin_user_id: v.optional(v.id("admin_users")),
  system_actor_type: v.optional(systemActorType),
});

export type AdminAlertResolvedBy = typeof adminAlertResolvedBy.type;

/**
 * Notification types for bank account document comments
 */
export const NotificationType = {
  NEW_COMMENT: "new_comment",
  ISSUE_RESOLVED: "issue_resolved",
  DOCUMENT_APPROVED: "document_approved",
  DOCUMENT_REJECTED: "document_rejected",
} as const;

export const notificationType = v.union(
  v.literal(NotificationType.NEW_COMMENT),
  v.literal(NotificationType.ISSUE_RESOLVED),
  v.literal(NotificationType.DOCUMENT_APPROVED),
  v.literal(NotificationType.DOCUMENT_REJECTED),
);

export type NotificationType = typeof notificationType.type;

/**
 * Delivery status for notifications
 */
export const DELIVERY_STATUS = {
  PENDING: "pending",
  SENT: "sent",
  FAILED: "failed",
} as const;

export const deliveryStatus = v.union(
  v.literal(DELIVERY_STATUS.PENDING),
  v.literal(DELIVERY_STATUS.SENT),
  v.literal(DELIVERY_STATUS.FAILED),
);

export type DeliveryStatus = typeof deliveryStatus.type;

/**
 * Delivery method for notifications
 */
export const DELIVERY_METHOD = {
  IN_APP: "in_app",
  EMAIL: "email",
  PUSH: "push",
  SMS: "sms",
} as const;

export const deliveryMethod = v.union(
  v.literal(DELIVERY_METHOD.IN_APP),
  v.literal(DELIVERY_METHOD.EMAIL),
  v.literal(DELIVERY_METHOD.PUSH),
  v.literal(DELIVERY_METHOD.SMS),
);

export type DeliveryMethod = typeof deliveryMethod.type;
