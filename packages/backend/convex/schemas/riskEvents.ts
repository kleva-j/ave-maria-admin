import { defineTable } from "convex/server";
import { v } from "convex/values";

import { riskEventType, riskHoldScope, riskSeverity } from "../shared";

/**
 * Risk Events Table
 *
 * This table stores an audit trail of risk-related activity and automated security checks.
 * It tracks events like blocked withdrawals, unusual login attempts, or high-velocity behavior.
 * Each record provides context for security reviews and automated risk scoring.
 */
export const risk_events = defineTable({
  // The user associated with this risk event
  user_id: v.id("users"),

  // The application area this risk event relates to (e.g., "withdrawals")
  scope: riskHoldScope,

  // Simple classification of the risk check or action (e.g., "withdrawal_blocked_velocity")
  event_type: riskEventType,

  // Importance level: INFO (logging), WARNING (potential risk), CRITICAL (immediate threat)
  severity: riskSeverity,

  // Human-readable summary of what triggered the event
  message: v.string(),

  // JSON blob containing specific data related to the event (e.g., amounts, cooldown timers)
  details: v.optional(v.any()),

  // The admin who triggered this event manually, if applicable
  actor_admin_id: v.optional(v.id("admin_users")),

  // Timestamp of when the event occurred
  created_at: v.number(),
})
  // Optimization for fetching all risk events for a specific user
  .index("by_user_id", ["user_id"])

  // Default chronological sort for global risk dashboards
  .index("by_created_at", ["created_at"])

  // Utility for filtering by specific check types across the platform
  .index("by_event_type", ["event_type"])

  // Efficient chronological lookup for specific user history
  .index("by_user_id_and_created_at", ["user_id", "created_at"]);
