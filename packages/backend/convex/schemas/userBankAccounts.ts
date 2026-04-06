import { defineTable } from "convex/server";
import { v } from "convex/values";

import { bankAccountVerificationStatus } from "../shared";

export const user_bank_accounts = defineTable({
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
  .index("by_verification_submitted_at", ["verification_submitted_at"])
  .index("by_verification_status_and_submitted_at", [
    "verification_status",
    "verification_submitted_at",
  ]);
