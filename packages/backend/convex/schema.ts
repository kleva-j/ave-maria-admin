import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { DOCUMENT_TYPES } from "./utils";

const userStatus = v.union(
  v.literal("active"),
  v.literal("pending_kyc"),
  v.literal("suspended"),
  v.literal("closed"),
);

const planStatus = v.union(
  v.literal("active"),
  v.literal("paused"),
  v.literal("completed"),
  v.literal("expired"),
);

const txnType = v.union(
  v.literal("contribution"),
  v.literal("interest_accrual"),
  v.literal("withdrawal"),
  v.literal("referral_bonus"),
  v.literal("reversal"),
  v.literal("investment_yield"),
);

const withdrawalStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("processed"),
);

const kycStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
);

const adminRole = v.union(
  v.literal("super_admin"),
  v.literal("operations"),
  v.literal("finance"),
  v.literal("compliance"),
  v.literal("support"),
);

const bankAccountVerificationStatus = v.union(
  v.literal("pending"),
  v.literal("verified"),
  v.literal("rejected"),
);

const bankAccountEventType = v.union(
  v.literal("created"),
  v.literal("updated"),
  v.literal("set_primary"),
  v.literal("verification_status_changed"),
  v.literal("deleted"),
  v.literal("document_uploaded"),
  v.literal("verification_submitted"),
  v.literal("verification_approved"),
  v.literal("verification_rejected"),
);

export type WithdrawalStatus = typeof withdrawalStatus.type;
export type UserStatus = typeof userStatus.type;
export type PlanStatus = typeof planStatus.type;
export type KycStatus = typeof kycStatus.type;
export type AdminRole = typeof adminRole.type;
export type TxnType = typeof txnType.type;

const users = defineTable({
  workosId: v.string(),
  phone: v.string(),
  email: v.optional(v.string()),
  first_name: v.string(),
  last_name: v.string(),
  profile_picture_url: v.optional(v.string()),
  onboarding_complete: v.boolean(),
  referral_code: v.string(),
  referred_by: v.optional(v.id("users")),
  total_balance_kobo: v.int64(),
  savings_balance_kobo: v.int64(),
  status: userStatus,
  bvn_encrypted: v.optional(v.string()),
  nin_encrypted: v.optional(v.string()),
  created_at: v.number(),
  updated_at: v.number(),
  deleted_at: v.optional(v.number()),
  last_login_at: v.nullable(v.number()),
})
  .index("by_workos_id", ["workosId"])
  .index("by_phone", ["phone"])
  .index("by_email", ["email"])
  .index("by_referral_code", ["referral_code"])
  .index("by_referred_by", ["referred_by"])
  .index("by_status", ["status"]);

const admin_users = defineTable({
  workosId: v.string(),
  email: v.string(),
  first_name: v.string(),
  last_name: v.string(),
  profile_picture_url: v.optional(v.string()),
  role: adminRole,
  last_login_at: v.nullable(v.number()),
  status: userStatus,
  created_at: v.number(),
  deleted_at: v.optional(v.number()),
})
  .index("by_workos_id", ["workosId"])
  .index("by_email", ["email"])
  .index("by_role", ["role"])
  .index("by_status", ["status"]);

const savings_plan_templates = defineTable({
  name: v.string(),
  description: v.optional(v.string()),
  default_target_kobo: v.int64(),
  duration_days: v.number(),
  interest_rate: v.number(),
  automation_type: v.optional(v.string()),
  is_active: v.boolean(),
  created_at: v.number(),
})
  .index("by_name", ["name"])
  .index("by_is_active", ["is_active"]);

const user_savings_plans = defineTable({
  user_id: v.id("users"),
  template_id: v.optional(v.id("savings_plan_templates")),
  custom_target_kobo: v.int64(),
  current_amount_kobo: v.int64(),
  start_date: v.string(),
  end_date: v.string(),
  status: planStatus,
  automation_enabled: v.boolean(),
  metadata: v.optional(v.any()),
  created_at: v.number(),
  updated_at: v.number(),
})
  .index("by_user_id", ["user_id"])
  .index("by_user_id_and_status", ["user_id", "status"])
  .index("by_template_id", ["template_id"])
  .index("by_status", ["status"])
  .index("by_end_date", ["end_date"]);

const transactions = defineTable({
  user_id: v.id("users"),
  user_plan_id: v.optional(v.id("user_savings_plans")),
  type: txnType,
  amount_kobo: v.int64(),
  reference: v.string(),
  metadata: v.optional(v.any()),
  created_at: v.number(),
})
  .index("by_user_id", ["user_id"])
  .index("by_user_plan_id", ["user_plan_id"])
  .index("by_reference", ["reference"])
  .index("by_type", ["type"])
  .index("by_user_id_and_created_at", ["user_id", "created_at"]);

const withdrawals = defineTable({
  transaction_id: v.id("transactions"),
  requested_amount_kobo: v.int64(),
  status: withdrawalStatus,
  requested_at: v.number(),
  approved_by: v.optional(v.id("admin_users")),
  approved_at: v.optional(v.number()),
  rejection_reason: v.optional(v.string()),
  bank_account_details: v.optional(v.any()),
})
  .index("by_transaction_id", ["transaction_id"])
  .index("by_status", ["status"])
  .index("by_requested_at", ["requested_at"])
  .index("by_approved_by", ["approved_by"]);

const user_bank_accounts = defineTable({
  user_id: v.id("users"),
  bank_name: v.string(),
  account_number: v.string(),
  account_name: v.optional(v.string()),
  is_primary: v.boolean(),
  created_at: v.number(),
  updated_at: v.number(),
  verification_status: bankAccountVerificationStatus,
  verified_at: v.optional(v.number()),
  // Verification workflow fields
  verification_submitted_at: v.optional(v.number()),
  verified_by_admin_id: v.optional(v.id("admin_users")),
  rejection_reason: v.optional(v.string()),
})
  .index("by_user_id", ["user_id"])
  .index("by_user_id_and_is_primary", ["user_id", "is_primary"])
  .index("by_account_number", ["account_number"])
  .index("by_verification_status", ["verification_status"])
  .index("by_verification_submitted_at", ["verification_submitted_at"]);

const user_bank_account_events = defineTable({
  user_id: v.id("users"),
  account_id: v.id("user_bank_accounts"),
  event_type: bankAccountEventType,
  previous_values: v.optional(v.any()),
  new_values: v.optional(v.any()),
  actor_user_id: v.optional(v.id("users")),
  actor_admin_id: v.optional(v.id("admin_users")),
  created_at: v.number(),
})
  .index("by_user_id", ["user_id"])
  .index("by_account_id", ["account_id"])
  .index("by_event_type", ["event_type"]);

// Document types for bank account verification
const bankAccountDocumentType = v.union(
  v.literal(DOCUMENT_TYPES.GOVERNMENT_ID), // International passport, Driver's license, National ID
  v.literal(DOCUMENT_TYPES.PROOF_OF_ADDRESS), // Utility bill, Bank statement
  v.literal(DOCUMENT_TYPES.BANK_STATEMENT), // Recent bank statement
  v.literal(DOCUMENT_TYPES.SELFIE_WITH_ID), // Selfie holding ID
);

export type BankAccountDocumentType = typeof bankAccountDocumentType.type;

const bank_account_documents = defineTable({
  user_id: v.id("users"),
  account_id: v.id("user_bank_accounts"),
  document_type: bankAccountDocumentType,
  storage_id: v.id("_storage"), // Convex file storage ID
  file_name: v.string(), // Original file name
  file_size: v.number(), // Size in bytes
  mime_type: v.string(), // File MIME type
  status: kycStatus, // pending, approved, rejected
  uploaded_at: v.number(),
  reviewed_by: v.optional(v.id("admin_users")),
  reviewed_at: v.optional(v.number()),
  rejection_reason: v.optional(v.string()),
})
  .index("by_user_id", ["user_id"])
  .index("by_account_id", ["account_id"])
  .index("by_status", ["status"])
  .index("by_user_id_and_status", ["user_id", "status"])
  .index("by_account_id_and_status", ["account_id", "status"])
  .index("by_reviewed_by", ["reviewed_by"]);

const mv_dashboard_kpis = defineTable({
  total_aum_kobo: v.int64(),
  active_users: v.number(),
  active_plans: v.number(),
  total_savings_kobo: v.int64(),
  computed_at: v.number(),
}).index("by_computed_at", ["computed_at"]);

const kyc_documents = defineTable({
  user_id: v.id("users"),
  document_type: v.string(),
  file_url: v.optional(v.string()),
  status: kycStatus,
  reviewed_by: v.optional(v.id("admin_users")),
  reviewed_at: v.optional(v.number()),
  created_at: v.number(),
})
  .index("by_user_id", ["user_id"])
  .index("by_status", ["status"])
  .index("by_user_id_and_status", ["user_id", "status"])
  .index("by_reviewed_by", ["reviewed_by"]);

export default defineSchema({
  users,
  admin_users,
  savings_plan_templates,
  user_savings_plans,
  transactions,
  withdrawals,
  user_bank_accounts,
  user_bank_account_events,
  mv_dashboard_kpis,
  kyc_documents,
  bank_account_documents,
});
