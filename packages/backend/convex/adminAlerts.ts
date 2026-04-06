import type { DomainEvent } from "@avm-daily/application/ports";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { AdminAlertId, NotificationEventId } from "./types";

import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAdminUser } from "./utils";

import {
  NOTIFICATION_EVENT_PROCESSING_STATUS,
  ADMIN_ALERT_RESOLUTION_KIND,
  adminAlertResolutionKind,
  AdminAlertReceiptState,
  adminAlertReceiptState,
  notificationSourceKind,
  NotificationEventType,
  notificationEventType,
  adminAlertResolvedBy,
  adminAlertSeverity,
  AdminAlertSeverity,
  SYSTEM_ACTOR_TYPE,
  AdminAlertStatus,
  adminAlertStatus,
  adminAlertScope,
  adminAlertType,
  AdminAlertType,
  resourceType,
  TABLE_NAMES,
  adminRole,
} from "./shared";

import {
  requiresHealthyConditionForManualResolve,
  getReminderIntervalMs,
  getAdminAlertPolicy,
} from "./adminAlertPolicies";

const PROCESSING_LEASE_MS = 5 * 60 * 1000;
const MAX_EVENT_BATCH = 100;

const adminAlertSummaryValidator = v.object({
  _id: v.id("admin_alerts"),
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
});

const adminAlertReceiptSummaryValidator = v.object({
  receipt_id: v.id("admin_alert_receipts"),
  delivery_state: adminAlertReceiptState,
  delivered_at: v.number(),
  seen_at: v.optional(v.number()),
  acknowledged_at: v.optional(v.number()),
  last_notified_at: v.number(),
});

const adminInboxEntryValidator = v.object({
  alert: adminAlertSummaryValidator,
  receipt: adminAlertReceiptSummaryValidator,
});

const unreadCountValidator = v.object({
  unreadCount: v.number(),
});

const activeSummaryValidator = v.object({
  activeCount: v.number(),
  criticalCount: v.number(),
  warningCount: v.number(),
  unreadCount: v.number(),
});

type ConditionEvaluation = {
  alertType:
    | (typeof AdminAlertType)[keyof typeof AdminAlertType]
    | (typeof AdminAlertType)[keyof typeof AdminAlertType];
  fingerprint: string;
  severity: (typeof AdminAlertSeverity)[keyof typeof AdminAlertSeverity] | null;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function buildHealthyMetadata(
  metadata: Record<string, unknown>,
  healthyStreak: number,
) {
  return {
    ...metadata,
    healthy_streak: healthyStreak,
  };
}

function buildSystemResolvedBy(
  actorType: (typeof SYSTEM_ACTOR_TYPE)[keyof typeof SYSTEM_ACTOR_TYPE],
) {
  return {
    actor_type: "system" as const,
    system_actor_type: actorType,
  };
}

function buildAdminResolvedBy(adminUserId: string) {
  return {
    actor_type: "admin" as const,
    admin_user_id: adminUserId as any,
  };
}

function computeRetryBackoffMs(attemptCount: number) {
  return Math.min(30 * 60 * 1000, 2 ** Math.max(0, attemptCount - 1) * 60_000);
}

function ageMinutes(now: number, timestamp: number) {
  return Math.floor((now - timestamp) / 60_000);
}

async function getAlertByFingerprint(
  db: MutationCtx["db"] | QueryCtx["db"],
  fingerprint: string,
) {
  return await db
    .query(TABLE_NAMES.ADMIN_ALERTS)
    .withIndex("by_fingerprint", (q) => q.eq("fingerprint", fingerprint))
    .first();
}

async function getReceiptForAdmin(
  db: MutationCtx["db"] | QueryCtx["db"],
  alertId: AdminAlertId,
  adminUserId: string,
) {
  return await db
    .query(TABLE_NAMES.ADMIN_ALERT_RECEIPTS)
    .withIndex("by_alert_id_and_admin_user_id", (q) =>
      q.eq("alert_id", alertId).eq("admin_user_id", adminUserId as any),
    )
    .first();
}

async function getEligibleAdminIdsForRoles(
  ctx: MutationCtx,
  roles: readonly string[],
) {
  const eligible = new Set<string>();

  for (const role of roles) {
    const admins = await ctx.db
      .query(TABLE_NAMES.ADMIN_USERS)
      .withIndex("by_role_and_status", (q) =>
        q.eq("role", role as any).eq("status", "active"),
      )
      .collect();

    for (const admin of admins) {
      eligible.add(String(admin._id));
    }
  }

  return [...eligible];
}

async function resetReceiptsForReopenedAlert(
  ctx: MutationCtx,
  alertId: AdminAlertId,
  now: number,
) {
  const receipts = await ctx.db
    .query(TABLE_NAMES.ADMIN_ALERT_RECEIPTS)
    .withIndex("by_alert_id_and_admin_user_id", (q) =>
      q.eq("alert_id", alertId),
    )
    .collect();

  await Promise.all(
    receipts.map((receipt) =>
      ctx.db.patch(receipt._id, {
        delivery_state: AdminAlertReceiptState.UNREAD,
        delivered_at: now,
        seen_at: undefined,
        acknowledged_at: undefined,
        last_notified_at: now,
      }),
    ),
  );
}

async function fanOutAlertReceiptsInternal(
  ctx: MutationCtx,
  alertId: AdminAlertId,
) {
  const alert = await ctx.db.get(alertId);
  if (!alert) {
    throw new ConvexError("Alert not found");
  }

  const eligibleAdminIds = await getEligibleAdminIdsForRoles(
    ctx,
    alert.routing_roles,
  );
  const now = Date.now();

  for (const adminUserId of eligibleAdminIds) {
    const existing = await getReceiptForAdmin(ctx.db, alertId, adminUserId);
    if (existing) {
      continue;
    }

    await ctx.db.insert(TABLE_NAMES.ADMIN_ALERT_RECEIPTS, {
      alert_id: alertId,
      admin_user_id: adminUserId as any,
      delivery_state: AdminAlertReceiptState.UNREAD,
      delivered_at: now,
      last_notified_at: now,
    });
  }
}

async function sendRemindersInternal(ctx: MutationCtx) {
  const now = Date.now();
  const alerts = await ctx.db
    .query(TABLE_NAMES.ADMIN_ALERTS)
    .withIndex("by_status_and_next_reminder_at", (q) =>
      q.eq("status", AdminAlertStatus.ACTIVE).lte("next_reminder_at", now),
    )
    .take(200);

  for (const alert of alerts) {
    const receipts = await ctx.db
      .query(TABLE_NAMES.ADMIN_ALERT_RECEIPTS)
      .withIndex("by_alert_id_and_admin_user_id", (q) =>
        q.eq("alert_id", alert._id),
      )
      .collect();

    await Promise.all(
      receipts.map(async (receipt) => {
        if (receipt.delivery_state === AdminAlertReceiptState.ACKNOWLEDGED) {
          return;
        }

        await ctx.db.patch(receipt._id, {
          delivery_state: AdminAlertReceiptState.UNREAD,
          last_notified_at: now,
        });
      }),
    );

    await ctx.db.patch(alert._id, {
      next_reminder_at: now + getReminderIntervalMs(alert.severity),
      reminder_count: alert.reminder_count + 1,
    });
  }

  return alerts.length;
}

async function reconcileReceiptsForActiveAlertsInternal(ctx: MutationCtx) {
  const alerts = (
    await Promise.all([
      ctx.db
        .query(TABLE_NAMES.ADMIN_ALERTS)
        .withIndex("by_status_and_severity", (q) =>
          q
            .eq("status", AdminAlertStatus.ACTIVE)
            .eq("severity", AdminAlertSeverity.WARNING),
        )
        .collect(),
      ctx.db
        .query(TABLE_NAMES.ADMIN_ALERTS)
        .withIndex("by_status_and_severity", (q) =>
          q
            .eq("status", AdminAlertStatus.ACTIVE)
            .eq("severity", AdminAlertSeverity.CRITICAL),
        )
        .collect(),
    ])
  ).flat();

  for (const alert of alerts) {
    await fanOutAlertReceiptsInternal(ctx, alert._id);
  }

  return alerts.length;
}

async function resolveAlertInternal(
  ctx: MutationCtx,
  alertId: AdminAlertId,
  input: {
    now: number;
    resolutionKind: (typeof ADMIN_ALERT_RESOLUTION_KIND)[keyof typeof ADMIN_ALERT_RESOLUTION_KIND];
    resolvedBy:
      | ReturnType<typeof buildSystemResolvedBy>
      | ReturnType<typeof buildAdminResolvedBy>;
  },
) {
  const alert = await ctx.db.get(alertId);
  if (!alert || alert.status === AdminAlertStatus.RESOLVED) {
    return alert;
  }

  await ctx.db.patch(alertId, {
    status: AdminAlertStatus.RESOLVED,
    resolution_kind: input.resolutionKind,
    resolved_at: input.now,
    resolved_by: input.resolvedBy,
    next_reminder_at: undefined,
    last_evaluated_at: input.now,
  });

  return await ctx.db.get(alertId);
}

async function upsertSharedAlertInternal(
  ctx: MutationCtx,
  input: {
    alertType: (typeof AdminAlertType)[keyof typeof AdminAlertType];
    severity: (typeof AdminAlertSeverity)[keyof typeof AdminAlertSeverity];
    title: string;
    body: string;
    fingerprint: string;
    metadata: Record<string, unknown>;
    sourceEventId?: NotificationEventId;
    now: number;
  },
) {
  const policy = getAdminAlertPolicy(input.alertType);
  const existing = await getAlertByFingerprint(ctx.db, input.fingerprint);
  const nextReminderAt = input.now + getReminderIntervalMs(input.severity);

  if (existing) {
    const reopening = existing.status === AdminAlertStatus.RESOLVED;
    const severityChanged = existing.severity !== input.severity;

    await ctx.db.patch(existing._id, {
      alert_type: input.alertType,
      scope: policy.scope,
      severity: input.severity,
      status: AdminAlertStatus.ACTIVE,
      title: input.title,
      body: input.body,
      fingerprint: input.fingerprint,
      source_event_id: input.sourceEventId ?? existing.source_event_id,
      routing_roles: [...policy.routingRoles],
      metadata: input.metadata,
      first_opened_at: reopening ? input.now : existing.first_opened_at,
      last_triggered_at: input.now,
      last_evaluated_at: input.now,
      next_reminder_at:
        reopening || severityChanged
          ? nextReminderAt
          : (existing.next_reminder_at ?? nextReminderAt),
      reminder_count: reopening ? 0 : existing.reminder_count,
      resolution_kind: undefined,
      resolved_at: undefined,
      resolved_by: undefined,
    });

    if (reopening) {
      await resetReceiptsForReopenedAlert(ctx, existing._id, input.now);
    }

    await fanOutAlertReceiptsInternal(ctx, existing._id);
    return await ctx.db.get(existing._id);
  }

  const alertId = await ctx.db.insert(TABLE_NAMES.ADMIN_ALERTS, {
    alert_type: input.alertType,
    scope: policy.scope,
    severity: input.severity,
    status: AdminAlertStatus.ACTIVE,
    title: input.title,
    body: input.body,
    fingerprint: input.fingerprint,
    source_event_id: input.sourceEventId,
    routing_roles: [...policy.routingRoles],
    metadata: input.metadata,
    first_opened_at: input.now,
    last_triggered_at: input.now,
    last_evaluated_at: input.now,
    next_reminder_at: nextReminderAt,
    reminder_count: 0,
  });

  await fanOutAlertReceiptsInternal(ctx, alertId);
  return await ctx.db.get(alertId);
}

async function applyConditionEvaluation(
  ctx: MutationCtx,
  evaluation: ConditionEvaluation,
  now: number,
) {
  const existing = await getAlertByFingerprint(ctx.db, evaluation.fingerprint);

  if (evaluation.severity) {
    const metadata = buildHealthyMetadata(evaluation.metadata, 0);
    return {
      alert: await upsertSharedAlertInternal(ctx, {
        alertType: evaluation.alertType,
        severity: evaluation.severity,
        title: evaluation.title,
        body: evaluation.body,
        fingerprint: evaluation.fingerprint,
        metadata,
        now,
      }),
      changed: true,
    };
  }

  if (!existing || existing.status === AdminAlertStatus.RESOLVED) {
    return { alert: existing, changed: false };
  }

  const currentMetadata = toRecord(existing.metadata);
  const healthyStreak = Number(currentMetadata.healthy_streak ?? 0) + 1;

  if (healthyStreak >= 2) {
    return {
      alert: await resolveAlertInternal(ctx, existing._id, {
        now,
        resolutionKind: ADMIN_ALERT_RESOLUTION_KIND.AUTOMATIC,
        resolvedBy: buildSystemResolvedBy(SYSTEM_ACTOR_TYPE.CRON),
      }),
      changed: true,
    };
  }

  await ctx.db.patch(existing._id, {
    metadata: buildHealthyMetadata(currentMetadata, healthyStreak),
    last_evaluated_at: now,
  });

  return {
    alert: await ctx.db.get(existing._id),
    changed: true,
  };
}

async function evaluatePendingWithdrawalsCondition(
  ctx: MutationCtx,
  now: number,
): Promise<ConditionEvaluation> {
  const pending = await ctx.db
    .query(TABLE_NAMES.WITHDRAWALS)
    .withIndex("by_status_and_requested_at", (q) => q.eq("status", "pending"))
    .collect();

  const oldestPending = pending[0];
  if (!oldestPending) {
    return {
      alertType: AdminAlertType.WITHDRAWALS_PENDING_OLDEST,
      fingerprint: AdminAlertType.WITHDRAWALS_PENDING_OLDEST,
      severity: null,
      title: "Withdrawal queue is healthy",
      body: "No pending withdrawals require action.",
      metadata: { pending_count: 0 },
    };
  }

  const pendingCount = pending.length;
  const oldestAt = oldestPending.requested_at;
  const ageMs = now - oldestAt;
  const severity =
    ageMs >= 60 * 60 * 1000 || pendingCount >= 10
      ? AdminAlertSeverity.CRITICAL
      : ageMs >= 15 * 60 * 1000
        ? AdminAlertSeverity.WARNING
        : null;

  return {
    alertType: AdminAlertType.WITHDRAWALS_PENDING_OLDEST,
    fingerprint: AdminAlertType.WITHDRAWALS_PENDING_OLDEST,
    severity,
    title:
      severity === AdminAlertSeverity.CRITICAL
        ? "Withdrawal queue needs immediate attention"
        : "Withdrawal queue is aging",
    body: `${pendingCount} pending withdrawals remain open. The oldest request has been waiting ${ageMinutes(
      now,
      oldestAt,
    )} minutes.`,
    metadata: {
      pending_count: pendingCount,
      oldest_pending_requested_at: oldestAt,
      oldest_pending_age_ms: ageMs,
    },
  };
}

async function evaluateApprovedWithdrawalsCondition(
  ctx: MutationCtx,
  now: number,
): Promise<ConditionEvaluation> {
  const approved = await ctx.db
    .query(TABLE_NAMES.WITHDRAWALS)
    .withIndex("by_status_and_approved_at", (q) => q.eq("status", "approved"))
    .collect();

  const oldestApproved = approved[0];
  if (!oldestApproved?.approved_at) {
    return {
      alertType: AdminAlertType.WITHDRAWALS_APPROVED_UNPROCESSED_OLDEST,
      fingerprint: AdminAlertType.WITHDRAWALS_APPROVED_UNPROCESSED_OLDEST,
      severity: null,
      title: "Approved withdrawals are healthy",
      body: "No approved withdrawals are waiting for processing.",
      metadata: { approved_count: 0 },
    };
  }

  const approvedCount = approved.length;
  const oldestAt = oldestApproved.approved_at;
  const ageMs = now - oldestAt;
  const severity =
    ageMs >= 120 * 60 * 1000 || approvedCount >= 5
      ? AdminAlertSeverity.CRITICAL
      : ageMs >= 30 * 60 * 1000
        ? AdminAlertSeverity.WARNING
        : null;

  return {
    alertType: AdminAlertType.WITHDRAWALS_APPROVED_UNPROCESSED_OLDEST,
    fingerprint: AdminAlertType.WITHDRAWALS_APPROVED_UNPROCESSED_OLDEST,
    severity,
    title:
      severity === AdminAlertSeverity.CRITICAL
        ? "Approved withdrawals are stalled"
        : "Approved withdrawals need processing",
    body: `${approvedCount} approved withdrawals still need settlement. The oldest approved withdrawal has been waiting ${ageMinutes(
      now,
      oldestAt,
    )} minutes.`,
    metadata: {
      approved_count: approvedCount,
      oldest_approved_at: oldestAt,
      oldest_approved_age_ms: ageMs,
    },
  };
}

async function evaluateKycPendingCondition(
  ctx: MutationCtx,
  now: number,
): Promise<ConditionEvaluation> {
  const pendingDocuments = await ctx.db
    .query(TABLE_NAMES.KYC_DOCUMENTS)
    .withIndex("by_status_and_created_at", (q) => q.eq("status", "pending"))
    .collect();

  const oldestPendingDocument = pendingDocuments[0];
  const pendingUserCount = new Set(
    pendingDocuments.map((document) => String(document.user_id)),
  ).size;

  if (!oldestPendingDocument) {
    return {
      alertType: AdminAlertType.KYC_PENDING_OLDEST,
      fingerprint: AdminAlertType.KYC_PENDING_OLDEST,
      severity: null,
      title: "KYC queue is healthy",
      body: "No pending KYC documents require manual review.",
      metadata: { pending_user_count: 0, pending_document_count: 0 },
    };
  }

  const oldestAt = oldestPendingDocument.created_at;
  const ageMs = now - oldestAt;
  const severity =
    ageMs >= 240 * 60 * 1000 || pendingUserCount >= 15
      ? AdminAlertSeverity.CRITICAL
      : ageMs >= 30 * 60 * 1000
        ? AdminAlertSeverity.WARNING
        : null;

  return {
    alertType: AdminAlertType.KYC_PENDING_OLDEST,
    fingerprint: AdminAlertType.KYC_PENDING_OLDEST,
    severity,
    title:
      severity === AdminAlertSeverity.CRITICAL
        ? "KYC backlog is critical"
        : "KYC queue is aging",
    body: `${pendingUserCount} users are still waiting in the KYC queue. The oldest pending document has been open for ${ageMinutes(
      now,
      oldestAt,
    )} minutes.`,
    metadata: {
      pending_user_count: pendingUserCount,
      pending_document_count: pendingDocuments.length,
      oldest_pending_document_at: oldestAt,
      oldest_pending_document_age_ms: ageMs,
    },
  };
}

async function evaluateBankVerificationCondition(
  ctx: MutationCtx,
  now: number,
): Promise<ConditionEvaluation> {
  const pendingAccounts = await ctx.db
    .query(TABLE_NAMES.USER_BANK_ACCOUNTS)
    .withIndex("by_verification_status_and_submitted_at", (q) =>
      q.eq("verification_status", "pending"),
    )
    .collect();

  if (pendingAccounts.length === 0) {
    return {
      alertType: AdminAlertType.BANK_VERIFICATION_PENDING_OLDEST,
      fingerprint: AdminAlertType.BANK_VERIFICATION_PENDING_OLDEST,
      severity: null,
      title: "Bank verification queue is healthy",
      body: "No bank account submissions require review.",
      metadata: { pending_account_count: 0 },
    };
  }

  const oldestSubmissionAt = pendingAccounts.reduce((oldest, account) => {
    const current = account.verification_submitted_at ?? account.created_at;
    return current < oldest ? current : oldest;
  }, pendingAccounts[0].verification_submitted_at ?? pendingAccounts[0].created_at);

  const ageMs = now - oldestSubmissionAt;
  const pendingAccountCount = pendingAccounts.length;
  const severity =
    ageMs >= 240 * 60 * 1000 || pendingAccountCount >= 10
      ? AdminAlertSeverity.CRITICAL
      : ageMs >= 30 * 60 * 1000
        ? AdminAlertSeverity.WARNING
        : null;

  return {
    alertType: AdminAlertType.BANK_VERIFICATION_PENDING_OLDEST,
    fingerprint: AdminAlertType.BANK_VERIFICATION_PENDING_OLDEST,
    severity,
    title:
      severity === AdminAlertSeverity.CRITICAL
        ? "Bank verification backlog is critical"
        : "Bank verification queue is aging",
    body: `${pendingAccountCount} bank account submissions are waiting for review. The oldest submission has been pending for ${ageMinutes(
      now,
      oldestSubmissionAt,
    )} minutes.`,
    metadata: {
      pending_account_count: pendingAccountCount,
      oldest_submission_at: oldestSubmissionAt,
      oldest_submission_age_ms: ageMs,
    },
  };
}

async function evaluateReconciliationRunStaleCondition(
  ctx: MutationCtx,
  now: number,
): Promise<ConditionEvaluation> {
  const runs = await ctx.db
    .query(TABLE_NAMES.TRANSACTION_RECONCILIATION_RUNS)
    .withIndex("by_started_at")
    .order("desc")
    .collect();

  const latestCompleted = runs.find((run) => run.completed_at !== undefined);
  if (!latestCompleted?.completed_at) {
    return {
      alertType: AdminAlertType.RECONCILIATION_RUN_STALE,
      fingerprint: AdminAlertType.RECONCILIATION_RUN_STALE,
      severity: AdminAlertSeverity.CRITICAL,
      title: "Reconciliation has never completed successfully",
      body: "No completed reconciliation run is available. Investigate the scheduler and the latest run immediately.",
      metadata: {
        latest_completed_at: null,
      },
    };
  }

  const ageMs = now - latestCompleted.completed_at;
  const severity =
    ageMs >= 4 * 60 * 60 * 1000
      ? AdminAlertSeverity.CRITICAL
      : ageMs >= 2 * 60 * 60 * 1000
        ? AdminAlertSeverity.WARNING
        : null;

  return {
    alertType: AdminAlertType.RECONCILIATION_RUN_STALE,
    fingerprint: AdminAlertType.RECONCILIATION_RUN_STALE,
    severity,
    title:
      severity === AdminAlertSeverity.CRITICAL
        ? "Reconciliation runs are stale"
        : "Reconciliation run is getting stale",
    body: `The last completed reconciliation run finished ${ageMinutes(
      now,
      latestCompleted.completed_at,
    )} minutes ago.`,
    metadata: {
      latest_completed_at: latestCompleted.completed_at,
      latest_completed_age_ms: ageMs,
      latest_run_id: String(latestCompleted._id),
    },
  };
}

async function evaluateReconciliationOpenIssuesCondition(
  ctx: MutationCtx,
  now: number,
): Promise<ConditionEvaluation> {
  const openIssues = await ctx.db
    .query(TABLE_NAMES.TRANSACTION_RECONCILIATION_ISSUES)
    .withIndex("by_issue_status", (q) => q.eq("issue_status", "open"))
    .collect();

  const issueCount = openIssues.length;
  const severity =
    issueCount >= 5
      ? AdminAlertSeverity.CRITICAL
      : issueCount > 0
        ? AdminAlertSeverity.WARNING
        : null;

  return {
    alertType: AdminAlertType.RECONCILIATION_OPEN_ISSUES,
    fingerprint: AdminAlertType.RECONCILIATION_OPEN_ISSUES,
    severity,
    title:
      severity === AdminAlertSeverity.CRITICAL
        ? "Reconciliation issues are piling up"
        : "Open reconciliation issues need follow-up",
    body:
      issueCount > 0
        ? `${issueCount} reconciliation issue${issueCount === 1 ? "" : "s"} remain open.`
        : "No reconciliation issues remain open.",
    metadata: {
      open_issue_count: issueCount,
      latest_issue_at: openIssues[0]?.created_at,
      evaluated_at: now,
    },
  };
}

async function evaluateConditionByAlertType(
  ctx: MutationCtx,
  alertType: (typeof AdminAlertType)[keyof typeof AdminAlertType],
  now: number,
) {
  switch (alertType) {
    case AdminAlertType.WITHDRAWALS_PENDING_OLDEST:
      return await evaluatePendingWithdrawalsCondition(ctx, now);
    case AdminAlertType.WITHDRAWALS_APPROVED_UNPROCESSED_OLDEST:
      return await evaluateApprovedWithdrawalsCondition(ctx, now);
    case AdminAlertType.KYC_PENDING_OLDEST:
      return await evaluateKycPendingCondition(ctx, now);
    case AdminAlertType.BANK_VERIFICATION_PENDING_OLDEST:
      return await evaluateBankVerificationCondition(ctx, now);
    case AdminAlertType.RECONCILIATION_RUN_STALE:
      return await evaluateReconciliationRunStaleCondition(ctx, now);
    case AdminAlertType.RECONCILIATION_OPEN_ISSUES:
      return await evaluateReconciliationOpenIssuesCondition(ctx, now);
    default:
      throw new ConvexError(`Unsupported condition alert type: ${alertType}`);
  }
}

async function handleNotificationEvent(
  ctx: MutationCtx,
  eventId: NotificationEventId,
) {
  const event = await ctx.db.get(eventId);
  if (!event) {
    throw new ConvexError("Notification event not found");
  }

  const payload = toRecord(event.payload);
  const now = Date.now();

  switch (event.event_type) {
    case NotificationEventType.RECONCILIATION_RUN_FAILED: {
      await upsertSharedAlertInternal(ctx, {
        alertType: AdminAlertType.RECONCILIATION_RUN_FAILED,
        severity: AdminAlertSeverity.CRITICAL,
        title: "Reconciliation run failed",
        body:
          typeof payload.error === "string" && payload.error.length > 0
            ? `The latest reconciliation run failed: ${payload.error}`
            : "The latest reconciliation run failed. Investigate the job output and ledger state.",
        fingerprint: AdminAlertType.RECONCILIATION_RUN_FAILED,
        metadata: buildHealthyMetadata(
          {
            run_id: payload.run_id,
            error: payload.error,
            issue_count: payload.issue_count,
          },
          0,
        ),
        sourceEventId: eventId,
        now,
      });
      break;
    }
    case NotificationEventType.RECONCILIATION_RUN_COMPLETED: {
      const failedAlert = await getAlertByFingerprint(
        ctx.db,
        AdminAlertType.RECONCILIATION_RUN_FAILED,
      );
      if (failedAlert?.status === AdminAlertStatus.ACTIVE) {
        await resolveAlertInternal(ctx, failedAlert._id, {
          now,
          resolutionKind: ADMIN_ALERT_RESOLUTION_KIND.AUTOMATIC,
          resolvedBy: buildSystemResolvedBy(SYSTEM_ACTOR_TYPE.WORKER),
        });
      }
      break;
    }
    default:
      break;
  }
}

async function insertNotificationEventInternal(
  ctx: MutationCtx,
  event: DomainEvent,
) {
  const existing = await ctx.db
    .query(TABLE_NAMES.NOTIFICATION_EVENTS)
    .withIndex("by_dedupe_key", (q) => q.eq("dedupe_key", event.dedupeKey))
    .first();

  if (existing) {
    return existing._id;
  }

  const occurredAt = event.occurredAt ?? Date.now();
  const eventId = await ctx.db.insert(TABLE_NAMES.NOTIFICATION_EVENTS, {
    event_type: event.eventType as any,
    source_kind: event.sourceKind as any,
    resource_type: event.resourceType as any,
    resource_id: event.resourceId,
    dedupe_key: event.dedupeKey,
    payload: event.payload,
    occurred_at: occurredAt,
    processing_status: NOTIFICATION_EVENT_PROCESSING_STATUS.PENDING,
    attempt_count: 0,
    next_attempt_at: occurredAt,
  });

  await ctx.scheduler.runAfter(0, internal.adminAlerts.processEvent, {
    eventId,
  });

  return eventId;
}

export async function appendNotificationEvents(
  ctx: MutationCtx,
  events: DomainEvent[],
) {
  const ids: NotificationEventId[] = [];
  for (const event of events) {
    ids.push(await insertNotificationEventInternal(ctx, event));
  }
  return ids;
}

export const enqueueEvent = internalMutation({
  args: {
    eventType: notificationEventType,
    sourceKind: notificationSourceKind,
    resourceType: resourceType,
    resourceId: v.string(),
    dedupeKey: v.string(),
    payload: v.any(),
    occurredAt: v.optional(v.number()),
  },
  returns: v.id("notification_events"),
  handler: async (ctx, args) => {
    const [eventId] = await appendNotificationEvents(ctx, [
      {
        eventType: args.eventType,
        sourceKind: args.sourceKind as any,
        resourceType: args.resourceType,
        resourceId: args.resourceId,
        dedupeKey: args.dedupeKey,
        payload: toRecord(args.payload),
        occurredAt: args.occurredAt,
      },
    ]);

    return eventId;
  },
});

export const processEvent = internalMutation({
  args: {
    eventId: v.id("notification_events"),
  },
  returns: v.object({
    eventId: v.id("notification_events"),
    processingStatus: v.string(),
  }),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new ConvexError("Notification event not found");
    }

    const now = Date.now();
    const isLeased =
      event.processing_status ===
        NOTIFICATION_EVENT_PROCESSING_STATUS.PROCESSING &&
      event.next_attempt_at > now;

    if (
      event.processing_status === NOTIFICATION_EVENT_PROCESSING_STATUS.PROCESSED
    ) {
      return {
        eventId: args.eventId,
        processingStatus: event.processing_status,
      };
    }

    if (isLeased) {
      return {
        eventId: args.eventId,
        processingStatus: event.processing_status,
      };
    }

    const nextAttemptCount = event.attempt_count + 1;
    await ctx.db.patch(args.eventId, {
      processing_status: NOTIFICATION_EVENT_PROCESSING_STATUS.PROCESSING,
      attempt_count: nextAttemptCount,
      next_attempt_at: now + PROCESSING_LEASE_MS,
      last_error: undefined,
    });

    try {
      await handleNotificationEvent(ctx, args.eventId);
      await ctx.db.patch(args.eventId, {
        processing_status: NOTIFICATION_EVENT_PROCESSING_STATUS.PROCESSED,
        processed_at: Date.now(),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown notification error";
      await ctx.db.patch(args.eventId, {
        processing_status: NOTIFICATION_EVENT_PROCESSING_STATUS.FAILED,
        next_attempt_at: Date.now() + computeRetryBackoffMs(nextAttemptCount),
        last_error: message,
      });
      throw error;
    }

    const updated = await ctx.db.get(args.eventId);
    return {
      eventId: args.eventId,
      processingStatus:
        updated?.processing_status ??
        NOTIFICATION_EVENT_PROCESSING_STATUS.PROCESSED,
    };
  },
});

export const processPendingEvents = internalMutation({
  args: {},
  returns: v.object({
    scheduled: v.number(),
    reminded: v.number(),
    alertsChecked: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();

    const dueEvents = (
      await Promise.all([
        ctx.db
          .query(TABLE_NAMES.NOTIFICATION_EVENTS)
          .withIndex("by_processing_status_and_next_attempt_at", (q) =>
            q
              .eq(
                "processing_status",
                NOTIFICATION_EVENT_PROCESSING_STATUS.PENDING,
              )
              .lte("next_attempt_at", now),
          )
          .take(MAX_EVENT_BATCH),
        ctx.db
          .query(TABLE_NAMES.NOTIFICATION_EVENTS)
          .withIndex("by_processing_status_and_next_attempt_at", (q) =>
            q
              .eq(
                "processing_status",
                NOTIFICATION_EVENT_PROCESSING_STATUS.FAILED,
              )
              .lte("next_attempt_at", now),
          )
          .take(MAX_EVENT_BATCH),
        ctx.db
          .query(TABLE_NAMES.NOTIFICATION_EVENTS)
          .withIndex("by_processing_status_and_next_attempt_at", (q) =>
            q
              .eq(
                "processing_status",
                NOTIFICATION_EVENT_PROCESSING_STATUS.PROCESSING,
              )
              .lte("next_attempt_at", now),
          )
          .take(MAX_EVENT_BATCH),
      ])
    ).flat();

    const uniqueEventIds = Array.from(
      new Set(dueEvents.map((event) => String(event._id))),
    );

    await Promise.all(
      uniqueEventIds.map((eventId) =>
        ctx.scheduler.runAfter(0, internal.adminAlerts.processEvent, {
          eventId: eventId as any,
        }),
      ),
    );

    const reminded = await sendRemindersInternal(ctx);
    const alertsChecked = await reconcileReceiptsForActiveAlertsInternal(ctx);

    return {
      scheduled: uniqueEventIds.length,
      reminded,
      alertsChecked,
    };
  },
});

export const evaluateQueueConditions = internalMutation({
  args: {},
  returns: v.object({
    changed: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const evaluations = await Promise.all([
      evaluatePendingWithdrawalsCondition(ctx, now),
      evaluateApprovedWithdrawalsCondition(ctx, now),
      evaluateKycPendingCondition(ctx, now),
      evaluateBankVerificationCondition(ctx, now),
      evaluateReconciliationRunStaleCondition(ctx, now),
      evaluateReconciliationOpenIssuesCondition(ctx, now),
    ]);

    const results = await Promise.all(
      evaluations.map((evaluation) =>
        applyConditionEvaluation(ctx, evaluation, now),
      ),
    );

    return {
      changed: results.filter((result) => result.changed).length,
    };
  },
});

export const upsertSharedAlert = internalMutation({
  args: {
    alertType: adminAlertType,
    severity: adminAlertSeverity,
    title: v.string(),
    body: v.string(),
    fingerprint: v.string(),
    metadata: v.optional(v.any()),
    sourceEventId: v.optional(v.id("notification_events")),
  },
  returns: v.union(adminAlertSummaryValidator, v.null()),
  handler: async (ctx, args) => {
    return await upsertSharedAlertInternal(ctx, {
      alertType: args.alertType,
      severity: args.severity,
      title: args.title,
      body: args.body,
      fingerprint: args.fingerprint,
      metadata: buildHealthyMetadata(toRecord(args.metadata), 0),
      sourceEventId: args.sourceEventId,
      now: Date.now(),
    });
  },
});

export const fanOutReceipts = internalMutation({
  args: {
    alertId: v.id("admin_alerts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await fanOutAlertReceiptsInternal(ctx, args.alertId);
    return null;
  },
});

export const sendReminders = internalMutation({
  args: {},
  returns: v.object({
    reminded: v.number(),
  }),
  handler: async (ctx) => {
    return { reminded: await sendRemindersInternal(ctx) };
  },
});

export const reconcileReceiptsForActiveAlerts = internalMutation({
  args: {},
  returns: v.object({
    alertsChecked: v.number(),
  }),
  handler: async (ctx) => {
    return {
      alertsChecked: await reconcileReceiptsForActiveAlertsInternal(ctx),
    };
  },
});

export const listMyInbox = query({
  args: {
    status: v.optional(adminAlertStatus),
    severity: v.optional(adminAlertSeverity),
    scope: v.optional(adminAlertScope),
    limit: v.optional(v.number()),
  },
  returns: v.array(adminInboxEntryValidator),
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    const receipts = await ctx.db
      .query(TABLE_NAMES.ADMIN_ALERT_RECEIPTS)
      .withIndex("by_admin_user_id_and_delivered_at", (q) =>
        q.eq("admin_user_id", admin._id),
      )
      .order("desc")
      .collect();

    const rows = await Promise.all(
      receipts.map(async (receipt) => {
        const alert = await ctx.db.get(receipt.alert_id);
        if (!alert) {
          return null;
        }

        if (args.status && alert.status !== args.status) {
          return null;
        }
        if (args.severity && alert.severity !== args.severity) {
          return null;
        }
        if (args.scope && alert.scope !== args.scope) {
          return null;
        }

        return {
          alert,
          receipt: {
            receipt_id: receipt._id,
            delivery_state: receipt.delivery_state,
            delivered_at: receipt.delivered_at,
            seen_at: receipt.seen_at,
            acknowledged_at: receipt.acknowledged_at,
            last_notified_at: receipt.last_notified_at,
          },
        };
      }),
    );

    const filtered = rows.filter(
      (row): row is NonNullable<typeof row> => row !== null,
    );
    filtered.sort((left, right) => {
      const leftTime = Math.max(
        left.receipt.last_notified_at,
        left.alert.last_triggered_at,
      );
      const rightTime = Math.max(
        right.receipt.last_notified_at,
        right.alert.last_triggered_at,
      );
      return rightTime - leftTime;
    });

    return filtered.slice(0, Math.max(1, Math.min(args.limit ?? 100, 200)));
  },
});

export const getMyUnreadCount = query({
  args: {},
  returns: unreadCountValidator,
  handler: async (ctx) => {
    const admin = await getAdminUser(ctx);
    const unreadReceipts = await ctx.db
      .query(TABLE_NAMES.ADMIN_ALERT_RECEIPTS)
      .withIndex("by_admin_user_id_and_delivery_state", (q) =>
        q
          .eq("admin_user_id", admin._id)
          .eq("delivery_state", AdminAlertReceiptState.UNREAD),
      )
      .collect();

    return { unreadCount: unreadReceipts.length };
  },
});

export const getMyActiveSummary = query({
  args: {},
  returns: activeSummaryValidator,
  handler: async (ctx) => {
    const admin = await getAdminUser(ctx);
    const receipts = await ctx.db
      .query(TABLE_NAMES.ADMIN_ALERT_RECEIPTS)
      .withIndex("by_admin_user_id_and_delivered_at", (q) =>
        q.eq("admin_user_id", admin._id),
      )
      .collect();

    const activeEntries = await Promise.all(
      receipts.map(async (receipt) => {
        const alert = await ctx.db.get(receipt.alert_id);
        if (!alert || alert.status !== AdminAlertStatus.ACTIVE) {
          return null;
        }

        return { alert, receipt };
      }),
    );

    const rows = activeEntries.filter(
      (entry): entry is NonNullable<typeof entry> => entry !== null,
    );

    return {
      activeCount: rows.length,
      criticalCount: rows.filter(
        (entry) => entry.alert.severity === AdminAlertSeverity.CRITICAL,
      ).length,
      warningCount: rows.filter(
        (entry) => entry.alert.severity === AdminAlertSeverity.WARNING,
      ).length,
      unreadCount: rows.filter(
        (entry) =>
          entry.receipt.delivery_state === AdminAlertReceiptState.UNREAD,
      ).length,
    };
  },
});

export const markSeen = mutation({
  args: {
    alertId: v.id("admin_alerts"),
  },
  returns: adminAlertReceiptSummaryValidator,
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    const receipt = await getReceiptForAdmin(
      ctx.db,
      args.alertId,
      String(admin._id),
    );

    if (!receipt) {
      throw new ConvexError("Alert receipt not found");
    }

    const now = Date.now();
    await ctx.db.patch(receipt._id, {
      delivery_state:
        receipt.delivery_state === AdminAlertReceiptState.ACKNOWLEDGED
          ? receipt.delivery_state
          : AdminAlertReceiptState.SEEN,
      seen_at: receipt.seen_at ?? now,
    });

    const updated = await ctx.db.get(receipt._id);
    if (!updated) {
      throw new ConvexError("Alert receipt not found after update");
    }

    return {
      receipt_id: updated._id,
      delivery_state: updated.delivery_state,
      delivered_at: updated.delivered_at,
      seen_at: updated.seen_at,
      acknowledged_at: updated.acknowledged_at,
      last_notified_at: updated.last_notified_at,
    };
  },
});

export const acknowledgeReceipt = mutation({
  args: {
    alertId: v.id("admin_alerts"),
  },
  returns: adminAlertReceiptSummaryValidator,
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    const receipt = await getReceiptForAdmin(
      ctx.db,
      args.alertId,
      String(admin._id),
    );

    if (!receipt) {
      throw new ConvexError("Alert receipt not found");
    }

    const now = Date.now();
    await ctx.db.patch(receipt._id, {
      delivery_state: AdminAlertReceiptState.ACKNOWLEDGED,
      seen_at: receipt.seen_at ?? now,
      acknowledged_at: now,
    });

    const updated = await ctx.db.get(receipt._id);
    if (!updated) {
      throw new ConvexError("Alert receipt not found after update");
    }

    return {
      receipt_id: updated._id,
      delivery_state: updated.delivery_state,
      delivered_at: updated.delivered_at,
      seen_at: updated.seen_at,
      acknowledged_at: updated.acknowledged_at,
      last_notified_at: updated.last_notified_at,
    };
  },
});

export const resolveAlert = mutation({
  args: {
    alertId: v.id("admin_alerts"),
  },
  returns: v.union(adminAlertSummaryValidator, v.null()),
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    const alert = await ctx.db.get(args.alertId);
    if (!alert) {
      throw new ConvexError("Alert not found");
    }

    if (alert.status === AdminAlertStatus.RESOLVED) {
      return alert;
    }

    if (requiresHealthyConditionForManualResolve(alert.alert_type)) {
      const evaluation = await evaluateConditionByAlertType(
        ctx,
        alert.alert_type,
        Date.now(),
      );
      if (evaluation.severity !== null) {
        throw new ConvexError(
          "This alert cannot be resolved while the underlying condition is still active",
        );
      }
    }

    const resolved = await resolveAlertInternal(ctx, args.alertId, {
      now: Date.now(),
      resolutionKind: ADMIN_ALERT_RESOLUTION_KIND.MANUAL,
      resolvedBy: buildAdminResolvedBy(String(admin._id)),
    });

    const receipt = await getReceiptForAdmin(
      ctx.db,
      args.alertId,
      String(admin._id),
    );
    if (receipt) {
      await ctx.db.patch(receipt._id, {
        delivery_state: AdminAlertReceiptState.ACKNOWLEDGED,
        seen_at: receipt.seen_at ?? Date.now(),
        acknowledged_at: Date.now(),
      });
    }

    return resolved;
  },
});
