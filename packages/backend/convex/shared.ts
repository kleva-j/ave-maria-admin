import { v } from "convex/values";

import { DOCUMENT_TYPES } from "./utils";

// Document types for bank account verification
export const bankAccountDocumentType = v.union(
  v.literal(DOCUMENT_TYPES.GOVERNMENT_ID), // International passport, Driver's license, National ID
  v.literal(DOCUMENT_TYPES.PROOF_OF_ADDRESS), // Utility bill, Bank statement
  v.literal(DOCUMENT_TYPES.BANK_STATEMENT), // Recent bank statement
  v.literal(DOCUMENT_TYPES.SELFIE_WITH_ID), // Selfie with ID
);

export type BankAccountDocumentType = typeof bankAccountDocumentType.type;

export const userStatus = v.union(
  v.literal("active"),
  v.literal("pending_kyc"),
  v.literal("suspended"),
  v.literal("closed"),
);

export type UserStatus = typeof userStatus.type;

export const planStatus = v.union(
  v.literal("active"),
  v.literal("paused"),
  v.literal("completed"),
  v.literal("expired"),
);

export type PlanStatus = typeof planStatus.type;

export const txnType = v.union(
  v.literal("contribution"),
  v.literal("interest_accrual"),
  v.literal("withdrawal"),
  v.literal("referral_bonus"),
  v.literal("reversal"),
  v.literal("investment_yield"),
);

export type TxnType = typeof txnType.type;

export const withdrawalStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("processed"),
);

export type WithdrawalStatus = typeof withdrawalStatus.type;

export const kycStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
);

export type KycStatus = typeof kycStatus.type;

export const adminRole = v.union(
  v.literal("super_admin"),
  v.literal("operations"),
  v.literal("finance"),
  v.literal("compliance"),
  v.literal("support"),
);

export type AdminRole = typeof adminRole.type;

export const bankAccountVerificationStatus = v.union(
  v.literal("pending"),
  v.literal("verified"),
  v.literal("rejected"),
);

export type BankAccountVerificationStatus = typeof bankAccountVerificationStatus.type;

export const bankAccountEventType = v.union(
  v.literal("created"),
  v.literal("updated"),
  v.literal("set_primary"),
  v.literal("verification_status_changed"),
  v.literal("deleted"),
  v.literal("document_uploaded"),
  v.literal("verification_submitted"),
  v.literal("verification_approved"),
  v.literal("verification_rejected"),
  v.literal("kyc_verification_started"),
  v.literal("kyc_verification_completed"),
  v.literal("kyc_verification_failed"),
);

export type BankAccountEventType = typeof bankAccountEventType.type;
