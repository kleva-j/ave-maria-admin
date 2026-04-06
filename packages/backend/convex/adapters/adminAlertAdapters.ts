import type {
  AdminAlertInboxRepository,
  NotificationEventScheduler,
  NotificationEventRepository,
  AdminAlertConditionReader,
  AdminAlertReceiptRepository,
  NotificationEventRecord,
  AdminAlertResolvedBy,
  AdminAlertRepository,
  AdminUserDirectory,
  AdminAlertRecord,
  AdminAlertReceiptRecord,
} from "@avm-daily/application/ports";

import type { MutationCtx } from "../_generated/server";
import type {
  NotificationEvent,
  AdminAlertReceipt,
  AdminAlert,
  Context,
} from "../types";

import { DomainError } from "@avm-daily/domain";

import { getInsertDb, getPatchDb } from "./utils";
import { internal } from "../_generated/api";

import {
  AdminAlertReceiptState,
  NOTIFICATION_EVENT_PROCESSING_STATUS,
  AdminAlertSeverity,
  AdminAlertStatus,
  TABLE_NAMES,
} from "../shared";

function mapResolvedBy(
  value: AdminAlert["resolved_by"],
): AdminAlertResolvedBy | undefined {
  if (!value) {
    return undefined;
  }

  if (value.actor_type === "admin" && value.admin_user_id) {
    return {
      actorType: "admin",
      adminUserId: String(value.admin_user_id),
    };
  }

  if (value.actor_type === "system" && value.system_actor_type) {
    return {
      actorType: "system",
      systemActorType: value.system_actor_type,
    };
  }

  return undefined;
}

function toConvexResolvedBy(value: AdminAlertResolvedBy | undefined) {
  if (!value) {
    return undefined;
  }

  if (value.actorType === "admin") {
    return {
      actor_type: "admin" as const,
      admin_user_id: value.adminUserId as any,
    };
  }

  return {
    actor_type: "system" as const,
    system_actor_type: value.systemActorType,
  };
}

function mapNotificationEvent(
  event: NotificationEvent,
): NotificationEventRecord {
  return {
    id: String(event._id),
    eventType: event.event_type,
    sourceKind: event.source_kind,
    resourceType: event.resource_type,
    resourceId: event.resource_id,
    dedupeKey: event.dedupe_key,
    payload:
      event.payload &&
      typeof event.payload === "object" &&
      !Array.isArray(event.payload)
        ? { ...event.payload }
        : {},
    occurredAt: event.occurred_at,
    processingStatus: event.processing_status,
    attemptCount: event.attempt_count,
    nextAttemptAt: event.next_attempt_at,
    lastError: event.last_error,
    processedAt: event.processed_at,
  };
}

function mapAdminAlert(alert: AdminAlert): AdminAlertRecord {
  return {
    id: String(alert._id),
    alertType: alert.alert_type,
    scope: alert.scope,
    severity: alert.severity,
    status: alert.status,
    title: alert.title,
    body: alert.body,
    fingerprint: alert.fingerprint,
    sourceEventId: alert.source_event_id
      ? String(alert.source_event_id)
      : undefined,
    routingRoles: [...alert.routing_roles],
    metadata:
      alert.metadata &&
      typeof alert.metadata === "object" &&
      !Array.isArray(alert.metadata)
        ? { ...alert.metadata }
        : undefined,
    firstOpenedAt: alert.first_opened_at,
    lastTriggeredAt: alert.last_triggered_at,
    lastEvaluatedAt: alert.last_evaluated_at,
    nextReminderAt: alert.next_reminder_at,
    reminderCount: alert.reminder_count,
    resolutionKind: alert.resolution_kind,
    resolvedAt: alert.resolved_at,
    resolvedBy: mapResolvedBy(alert.resolved_by),
  };
}

function mapAdminAlertReceipt(
  receipt: AdminAlertReceipt,
): AdminAlertReceiptRecord {
  return {
    id: String(receipt._id),
    alertId: String(receipt.alert_id),
    adminUserId: String(receipt.admin_user_id),
    deliveryState: receipt.delivery_state,
    deliveredAt: receipt.delivered_at,
    seenAt: receipt.seen_at,
    acknowledgedAt: receipt.acknowledged_at,
    lastNotifiedAt: receipt.last_notified_at,
  };
}

async function getOrThrow<T>(value: T | null, message: string, code: string) {
  if (!value) {
    throw new DomainError(message, code);
  }
  return value;
}

export function createConvexNotificationEventRepository(
  ctx: Context,
): NotificationEventRepository {
  return {
    async findById(id: string) {
      const event = await ctx.db.get(id as any);
      return event ? mapNotificationEvent(event as NotificationEvent) : null;
    },

    async findByDedupeKey(dedupeKey: string) {
      const event = await ctx.db
        .query(TABLE_NAMES.NOTIFICATION_EVENTS)
        .withIndex("by_dedupe_key", (q) => q.eq("dedupe_key", dedupeKey))
        .first();

      return event ? mapNotificationEvent(event) : null;
    },

    async create(event) {
      const insertDb = getInsertDb(
        ctx,
        "Notification event creation requires a mutation context",
        "notification_event_mutation_context_required",
      );

      const id = await insertDb.insert(TABLE_NAMES.NOTIFICATION_EVENTS, {
        event_type: event.eventType,
        source_kind: event.sourceKind,
        resource_type: event.resourceType as any,
        resource_id: event.resourceId,
        dedupe_key: event.dedupeKey,
        payload: event.payload,
        occurred_at: event.occurredAt,
        processing_status:
          event.processingStatus ??
          NOTIFICATION_EVENT_PROCESSING_STATUS.PENDING,
        attempt_count: event.attemptCount ?? 0,
        next_attempt_at: event.nextAttemptAt,
        last_error: undefined,
        processed_at: undefined,
      });

      const created = await ctx.db.get(id);
      return mapNotificationEvent(
        await getOrThrow(
          created as NotificationEvent | null,
          "Notification event not found after creation",
          "notification_event_create_failed",
        ),
      );
    },

    async update(id, patch) {
      const patchDb = getPatchDb(
        ctx,
        "Notification event updates require a mutation context",
        "notification_event_mutation_context_required",
      );

      const patchData: Record<string, unknown> = {};
      if ("processingStatus" in patch) {
        patchData.processing_status = patch.processingStatus;
      }
      if ("attemptCount" in patch) {
        patchData.attempt_count = patch.attemptCount;
      }
      if ("nextAttemptAt" in patch) {
        patchData.next_attempt_at = patch.nextAttemptAt;
      }
      if ("lastError" in patch) {
        patchData.last_error = patch.lastError;
      }
      if ("processedAt" in patch) {
        patchData.processed_at = patch.processedAt;
      }

      await patchDb.patch(id as any, patchData);

      const updated = await ctx.db.get(id as any);
      return mapNotificationEvent(
        await getOrThrow(
          updated as NotificationEvent | null,
          "Notification event not found after update",
          "notification_event_update_failed",
        ),
      );
    },

    async listDueForProcessing(now, limit) {
      return (
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
            .take(limit),
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
            .take(limit),
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
            .take(limit),
        ])
      )
        .flat()
        .map(mapNotificationEvent);
    },
  };
}

export function createConvexNotificationEventScheduler(
  ctx: MutationCtx,
): NotificationEventScheduler {
  return {
    async scheduleProcessEvent(eventId: string) {
      await ctx.scheduler.runAfter(0, internal.adminAlerts.processEvent, {
        eventId: eventId as any,
      });
    },
  };
}

export function createConvexAdminAlertRepository(
  ctx: Context,
): AdminAlertRepository {
  return {
    async findById(id: string) {
      const alert = await ctx.db.get(id as any);
      return alert ? mapAdminAlert(alert as AdminAlert) : null;
    },

    async findByFingerprint(fingerprint: string) {
      const alert = await ctx.db
        .query(TABLE_NAMES.ADMIN_ALERTS)
        .withIndex("by_fingerprint", (q) => q.eq("fingerprint", fingerprint))
        .first();

      return alert ? mapAdminAlert(alert) : null;
    },

    async create(alert) {
      const insertDb = getInsertDb(
        ctx,
        "Admin alert creation requires a mutation context",
        "admin_alert_mutation_context_required",
      );

      const id = await insertDb.insert(TABLE_NAMES.ADMIN_ALERTS, {
        alert_type: alert.alertType,
        scope: alert.scope,
        severity: alert.severity,
        status: alert.status,
        title: alert.title,
        body: alert.body,
        fingerprint: alert.fingerprint,
        source_event_id: alert.sourceEventId as any,
        routing_roles: [...alert.routingRoles],
        metadata: alert.metadata,
        first_opened_at: alert.firstOpenedAt,
        last_triggered_at: alert.lastTriggeredAt,
        last_evaluated_at: alert.lastEvaluatedAt,
        next_reminder_at: alert.nextReminderAt,
        reminder_count: alert.reminderCount,
        resolution_kind: alert.resolutionKind,
        resolved_at: alert.resolvedAt,
        resolved_by: toConvexResolvedBy(alert.resolvedBy),
      });

      const created = await ctx.db.get(id);
      return mapAdminAlert(
        await getOrThrow(
          created as AdminAlert | null,
          "Admin alert not found after creation",
          "admin_alert_create_failed",
        ),
      );
    },

    async update(id, patch) {
      const patchDb = getPatchDb(
        ctx,
        "Admin alert updates require a mutation context",
        "admin_alert_mutation_context_required",
      );

      const patchData: Record<string, unknown> = {};
      if ("severity" in patch) {
        patchData.severity = patch.severity;
      }
      if ("status" in patch) {
        patchData.status = patch.status;
      }
      if ("title" in patch) {
        patchData.title = patch.title;
      }
      if ("body" in patch) {
        patchData.body = patch.body;
      }
      if ("sourceEventId" in patch) {
        patchData.source_event_id = patch.sourceEventId as any;
      }
      if ("routingRoles" in patch) {
        patchData.routing_roles = patch.routingRoles;
      }
      if ("metadata" in patch) {
        patchData.metadata = patch.metadata;
      }
      if ("lastTriggeredAt" in patch) {
        patchData.last_triggered_at = patch.lastTriggeredAt;
      }
      if ("lastEvaluatedAt" in patch) {
        patchData.last_evaluated_at = patch.lastEvaluatedAt;
      }
      if ("nextReminderAt" in patch) {
        patchData.next_reminder_at = patch.nextReminderAt;
      }
      if ("reminderCount" in patch) {
        patchData.reminder_count = patch.reminderCount;
      }
      if ("resolutionKind" in patch) {
        patchData.resolution_kind = patch.resolutionKind;
      }
      if ("resolvedAt" in patch) {
        patchData.resolved_at = patch.resolvedAt;
      }
      if ("resolvedBy" in patch) {
        patchData.resolved_by = toConvexResolvedBy(patch.resolvedBy);
      }

      await patchDb.patch(id as any, patchData);

      const updated = await ctx.db.get(id as any);
      return mapAdminAlert(
        await getOrThrow(
          updated as AdminAlert | null,
          "Admin alert not found after update",
          "admin_alert_update_failed",
        ),
      );
    },

    async listDueForReminder(now, limit) {
      const alerts = await ctx.db
        .query(TABLE_NAMES.ADMIN_ALERTS)
        .withIndex("by_status_and_next_reminder_at", (q) =>
          q.eq("status", AdminAlertStatus.ACTIVE).lte("next_reminder_at", now),
        )
        .take(limit);

      return alerts.map(mapAdminAlert);
    },

    async listActive(limit) {
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
      )
        .flat()
        .sort((left, right) => right.last_triggered_at - left.last_triggered_at)
        .slice(0, limit);

      return alerts.map(mapAdminAlert);
    },
  };
}

export function createConvexAdminAlertReceiptRepository(
  ctx: Context,
): AdminAlertReceiptRepository {
  return {
    async findByAlertIdAndAdminUserId(alertId, adminUserId) {
      const receipt = await ctx.db
        .query(TABLE_NAMES.ADMIN_ALERT_RECEIPTS)
        .withIndex("by_alert_id_and_admin_user_id", (q) =>
          q
            .eq("alert_id", alertId as any)
            .eq("admin_user_id", adminUserId as any),
        )
        .first();

      return receipt ? mapAdminAlertReceipt(receipt) : null;
    },

    async listByAlertId(alertId) {
      const receipts = await ctx.db
        .query(TABLE_NAMES.ADMIN_ALERT_RECEIPTS)
        .withIndex("by_alert_id_and_admin_user_id", (q) =>
          q.eq("alert_id", alertId as any),
        )
        .collect();

      return receipts.map(mapAdminAlertReceipt);
    },

    async create(receipt) {
      const insertDb = getInsertDb(
        ctx,
        "Admin alert receipt creation requires a mutation context",
        "admin_alert_receipt_mutation_context_required",
      );

      const id = await insertDb.insert(TABLE_NAMES.ADMIN_ALERT_RECEIPTS, {
        alert_id: receipt.alertId as any,
        admin_user_id: receipt.adminUserId as any,
        delivery_state: receipt.deliveryState,
        delivered_at: receipt.deliveredAt,
        seen_at: receipt.seenAt,
        acknowledged_at: receipt.acknowledgedAt,
        last_notified_at: receipt.lastNotifiedAt,
      });

      const created = await ctx.db.get(id);
      return mapAdminAlertReceipt(
        await getOrThrow(
          created as AdminAlertReceipt | null,
          "Admin alert receipt not found after creation",
          "admin_alert_receipt_create_failed",
        ),
      );
    },

    async update(id, patch) {
      const patchDb = getPatchDb(
        ctx,
        "Admin alert receipt updates require a mutation context",
        "admin_alert_receipt_mutation_context_required",
      );

      const patchData: Record<string, unknown> = {};
      if ("deliveryState" in patch) {
        patchData.delivery_state = patch.deliveryState;
      }
      if ("deliveredAt" in patch) {
        patchData.delivered_at = patch.deliveredAt;
      }
      if ("seenAt" in patch) {
        patchData.seen_at = patch.seenAt;
      }
      if ("acknowledgedAt" in patch) {
        patchData.acknowledged_at = patch.acknowledgedAt;
      }
      if ("lastNotifiedAt" in patch) {
        patchData.last_notified_at = patch.lastNotifiedAt;
      }

      await patchDb.patch(id as any, patchData);

      const updated = await ctx.db.get(id as any);
      return mapAdminAlertReceipt(
        await getOrThrow(
          updated as AdminAlertReceipt | null,
          "Admin alert receipt not found after update",
          "admin_alert_receipt_update_failed",
        ),
      );
    },
  };
}

export function createConvexAdminAlertInboxRepository(
  ctx: Context,
): AdminAlertInboxRepository {
  return {
    async listByAdminUserId(adminUserId, filters) {
      const receipts = await ctx.db
        .query(TABLE_NAMES.ADMIN_ALERT_RECEIPTS)
        .withIndex("by_admin_user_id_and_delivered_at", (q) =>
          q.eq("admin_user_id", adminUserId as any),
        )
        .order("desc")
        .collect();

      const rows = await Promise.all(
        receipts.map(async (receipt) => {
          const alert = await ctx.db.get(receipt.alert_id);
          if (!alert) {
            return null;
          }

          if (filters.status && alert.status !== filters.status) {
            return null;
          }
          if (filters.severity && alert.severity !== filters.severity) {
            return null;
          }
          if (filters.scope && alert.scope !== filters.scope) {
            return null;
          }

          return {
            alert: mapAdminAlert(alert as AdminAlert),
            receipt: mapAdminAlertReceipt(receipt),
          };
        }),
      );

      const filtered = rows
        .filter((row): row is NonNullable<typeof row> => row !== null)
        .sort((left, right) => {
          const leftTime = Math.max(
            left.receipt.lastNotifiedAt,
            left.alert.lastTriggeredAt,
          );
          const rightTime = Math.max(
            right.receipt.lastNotifiedAt,
            right.alert.lastTriggeredAt,
          );
          return rightTime - leftTime;
        });

      return filtered.slice(0, filters.limit ?? 100);
    },

    async getUnreadCountByAdminUserId(adminUserId) {
      const unreadReceipts = await ctx.db
        .query(TABLE_NAMES.ADMIN_ALERT_RECEIPTS)
        .withIndex("by_admin_user_id_and_delivery_state", (q) =>
          q
            .eq("admin_user_id", adminUserId as any)
            .eq("delivery_state", AdminAlertReceiptState.UNREAD),
        )
        .collect();

      return unreadReceipts.length;
    },

    async getActiveSummaryByAdminUserId(adminUserId) {
      const receipts = await ctx.db
        .query(TABLE_NAMES.ADMIN_ALERT_RECEIPTS)
        .withIndex("by_admin_user_id_and_delivered_at", (q) =>
          q.eq("admin_user_id", adminUserId as any),
        )
        .collect();

      const activeEntries = await Promise.all(
        receipts.map(async (receipt) => {
          const alert = await ctx.db.get(receipt.alert_id);
          if (!alert || alert.status !== AdminAlertStatus.ACTIVE) {
            return null;
          }

          return {
            alert: mapAdminAlert(alert as AdminAlert),
            receipt: mapAdminAlertReceipt(receipt),
          };
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
            entry.receipt.deliveryState === AdminAlertReceiptState.UNREAD,
        ).length,
      };
    },
  };
}

export function createConvexAdminUserDirectory(
  ctx: Context,
): AdminUserDirectory {
  return {
    async findActiveAdminIdsByRoles(roles) {
      const eligible = new Set<string>();

      for (const role of roles) {
        const admins = await ctx.db
          .query(TABLE_NAMES.ADMIN_USERS)
          .withIndex("by_role_and_status", (q) =>
            q.eq("role", role).eq("status", "active"),
          )
          .collect();

        for (const admin of admins) {
          eligible.add(String(admin._id));
        }
      }

      return [...eligible];
    },
  };
}

export function createConvexAdminAlertConditionReader(
  ctx: Context,
): AdminAlertConditionReader {
  return {
    async getPendingWithdrawalsSnapshot() {
      const pending = await ctx.db
        .query(TABLE_NAMES.WITHDRAWALS)
        .withIndex("by_status_and_requested_at", (q) =>
          q.eq("status", "pending"),
        )
        .collect();

      return {
        pendingCount: pending.length,
        oldestRequestedAt: pending[0]?.requested_at,
      };
    },

    async getApprovedWithdrawalsSnapshot() {
      const approved = await ctx.db
        .query(TABLE_NAMES.WITHDRAWALS)
        .withIndex("by_status_and_approved_at", (q) =>
          q.eq("status", "approved"),
        )
        .collect();

      return {
        approvedCount: approved.length,
        oldestApprovedAt: approved[0]?.approved_at ?? undefined,
      };
    },

    async getKycPendingSnapshot() {
      const pendingDocuments = await ctx.db
        .query(TABLE_NAMES.KYC_DOCUMENTS)
        .withIndex("by_status_and_created_at", (q) => q.eq("status", "pending"))
        .collect();

      return {
        pendingUserCount: new Set(
          pendingDocuments.map((document) => String(document.user_id)),
        ).size,
        pendingDocumentCount: pendingDocuments.length,
        oldestPendingDocumentAt: pendingDocuments[0]?.created_at,
      };
    },

    async getBankVerificationPendingSnapshot() {
      const pendingAccounts = await ctx.db
        .query(TABLE_NAMES.USER_BANK_ACCOUNTS)
        .withIndex("by_verification_status_and_submitted_at", (q) =>
          q.eq("verification_status", "pending"),
        )
        .collect();

      if (pendingAccounts.length === 0) {
        return {
          pendingAccountCount: 0,
          oldestSubmissionAt: undefined,
        };
      }

      const oldestSubmissionAt = pendingAccounts.reduce((oldest, account) => {
        const current = account.verification_submitted_at ?? account.created_at;
        return current < oldest ? current : oldest;
      }, pendingAccounts[0].verification_submitted_at ?? pendingAccounts[0].created_at);

      return {
        pendingAccountCount: pendingAccounts.length,
        oldestSubmissionAt,
      };
    },

    async getReconciliationRunSnapshot() {
      const runs = await ctx.db
        .query(TABLE_NAMES.TRANSACTION_RECONCILIATION_RUNS)
        .withIndex("by_started_at")
        .order("desc")
        .collect();

      const latestCompleted = runs.find(
        (run) => run.completed_at !== undefined,
      );
      return {
        latestCompletedAt: latestCompleted?.completed_at,
        latestRunId: latestCompleted ? String(latestCompleted._id) : undefined,
      };
    },

    async getReconciliationOpenIssuesSnapshot() {
      const openIssues = await ctx.db
        .query(TABLE_NAMES.TRANSACTION_RECONCILIATION_ISSUES)
        .withIndex("by_issue_status", (q) => q.eq("issue_status", "open"))
        .collect();

      return {
        openIssueCount: openIssues.length,
        latestIssueAt: openIssues[0]?.created_at,
      };
    },
  };
}
