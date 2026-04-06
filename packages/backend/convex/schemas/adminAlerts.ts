import { defineTable } from "convex/server";
import { v } from "convex/values";

import {
  adminAlertResolutionKind,
  adminAlertResolvedBy,
  adminAlertSeverity,
  adminAlertStatus,
  adminAlertScope,
  adminAlertType,
  adminRole,
} from "../shared";

export const admin_alerts = defineTable({
  alert_type: adminAlertType,
  scope: adminAlertScope,
  severity: adminAlertSeverity,
  status: adminAlertStatus,
  title: v.string(),
  body: v.string(),
  fingerprint: v.string(),
  source_event_id: v.optional(v.id("notification_events")),
  routing_roles: v.array(adminRole),
  metadata: v.optional(v.any()),
  first_opened_at: v.number(),
  last_triggered_at: v.number(),
  last_evaluated_at: v.number(),
  next_reminder_at: v.optional(v.number()),
  reminder_count: v.number(),
  resolution_kind: v.optional(adminAlertResolutionKind),
  resolved_at: v.optional(v.number()),
  resolved_by: v.optional(adminAlertResolvedBy),
})
  .index("by_fingerprint", ["fingerprint"])
  .index("by_status_and_severity", ["status", "severity"])
  .index("by_status_and_next_reminder_at", ["status", "next_reminder_at"])
  .index("by_scope_and_status", ["scope", "status"])
  .index("by_last_triggered_at", ["last_triggered_at"]);
