import { defineTable } from "convex/server";
import { v } from "convex/values";

import { riskHoldScope, riskHoldStatus } from "../shared";

/**
 * User Risk Holds Table
 *
 * This table manages active account-level restrictions placed on users by administrative staff
 * or automated security systems. A "hold" typically blocks specific actions (like withdrawals)
 * until a manual review is performed and the hold is released.
 */
export const user_risk_holds = defineTable({
  // The user whose account functionality is restricted
  user_id: v.id("users"),

  // The functional area being restricted (e.g., "withdrawals")
  scope: riskHoldScope,

  // Current state of the hold: "active" (restriction enforced) or "released" (restriction lifted)
  status: riskHoldStatus,

  // Internal explanation for why this restriction was placed
  reason: v.string(),

  // The administrator who initiated this restriction
  placed_by_admin_id: v.id("admin_users"),

  // Timestamp of when the restriction began
  placed_at: v.number(),

  // The administrator who authorized lifting the restriction
  released_by_admin_id: v.optional(v.id("admin_users")),

  // Timestamp of when the restriction was lifted
  released_at: v.optional(v.number()),
})
  // Primary lookup to check all holds currently affecting a user
  .index("by_user_id", ["user_id"])

  // Global view for admin dashboards to find all accounts currently under review
  .index("by_status", ["status"])

  // Performance-critical lookup for auth/service checks to see if a user has active holds
  .index("by_user_id_and_status", ["user_id", "status"])

  // Administrative categorization for scoping active holds across the platform
  .index("by_scope_and_status", ["scope", "status"]);
