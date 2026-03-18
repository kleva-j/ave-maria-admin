import { v } from "convex/values";

export const DOCUMENT_TYPES = {
  GOVERNMENT_ID: "government_id",
  PROOF_OF_ADDRESS: "proof_of_address",
  BANK_STATEMENT: "bank_statement",
  SELFIE_WITH_ID: "selfie_with_id",
} as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[keyof typeof DOCUMENT_TYPES];

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

export type WithdrawalStatus = typeof withdrawalStatus.type;

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
);

export type BankAccountEventType = typeof bankAccountEventType.type;

/**
 * Resource types for audit log
 */
export const RESOURCE_TYPE = {
  USER: "user",
  USERS: "users",
  ADMIN_USER: "admin_user",
  BANK_ACCOUNT: "user_bank_account",
  BANK_ACCOUNTS: "user_bank_accounts",
  BANK_ACCOUNT_DOCUMENT: "bank_account_document",
  BANK_ACCOUNT_DOCUMENTS: "bank_account_documents",
  TRANSACTION: "transaction",
  TRANSACTIONS: "transactions",
  WITHDRAWAL: "withdrawal",
  WITHDRAWALS: "withdrawals",
  SAVINGS_PLAN: "user_savings_plan",
  SAVINGS_PLANS: "user_savings_plans",
  SAVINGS_PLAN_TEMPLATE: "savings_plan_template",
  SAVINGS_PLAN_TEMPLATES: "savings_plan_templates",
  KYC_DOCUMENT: "kyc_document",
  KYC_DOCUMENTS: "kyc_documents",
} as const;

export const resourceType = v.union(
  v.literal(RESOURCE_TYPE.USER),
  v.literal(RESOURCE_TYPE.ADMIN_USER),
  v.literal(RESOURCE_TYPE.BANK_ACCOUNT),
  v.literal(RESOURCE_TYPE.BANK_ACCOUNTS),
  v.literal(RESOURCE_TYPE.BANK_ACCOUNT_DOCUMENT),
  v.literal(RESOURCE_TYPE.BANK_ACCOUNT_DOCUMENTS),
  v.literal(RESOURCE_TYPE.TRANSACTION),
  v.literal(RESOURCE_TYPE.TRANSACTIONS),
  v.literal(RESOURCE_TYPE.WITHDRAWAL),
  v.literal(RESOURCE_TYPE.WITHDRAWALS),
  v.literal(RESOURCE_TYPE.SAVINGS_PLAN),
  v.literal(RESOURCE_TYPE.SAVINGS_PLANS),
  v.literal(RESOURCE_TYPE.SAVINGS_PLAN_TEMPLATE),
  v.literal(RESOURCE_TYPE.SAVINGS_PLAN_TEMPLATES),
  v.literal(RESOURCE_TYPE.KYC_DOCUMENT),
  v.literal(RESOURCE_TYPE.KYC_DOCUMENTS),
);

export type ResourceType = typeof resourceType.type;

/**
 * Verification status for bank accounts
 * - pending: Awaiting verification
 * - verified: Successfully verified
 * - rejected: Verification failed or rejected
 */
export const VERFICATION_STATUS = {
  PENDING: "pending",
  VERIFIED: "verified",
  REJECTED: "rejected",
} as const;

export const verificationStatus = v.union(
  v.literal(VERFICATION_STATUS.PENDING),
  v.literal(VERFICATION_STATUS.VERIFIED),
  v.literal(VERFICATION_STATUS.REJECTED),
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
);

// Type aliases for validator types
// These extract the TypeScript types from Convex validators for type-safe usage
export type EventType = typeof eventType.type;
export type VerificationStatus = typeof verificationStatus.type;
