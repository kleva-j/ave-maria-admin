import { defineTable } from "convex/server";
import { v } from "convex/values";

import { userStatus, adminRole } from "../shared";

export const users = defineTable({
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

export const admin_users = defineTable({
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
