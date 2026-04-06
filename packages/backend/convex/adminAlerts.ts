import type { MutationCtx } from "./_generated/server";
import type { AdminAlertId, Context } from "./types";

import { DomainError } from "@avm-daily/domain";
import {
  createEvaluateAdminAlertConditionsUseCase,
  createAcknowledgeAdminAlertReceiptUseCase,
  createReconcileAdminAlertReceiptsUseCase,
  createGetAdminAlertActiveSummaryUseCase,
  createGetAdminAlertUnreadCountUseCase,
  createFanOutAdminAlertReceiptsUseCase,
  createSendAdminAlertRemindersUseCase,
  createUpsertSharedAdminAlertUseCase,
  createProcessAdminAlertEventUseCase,
  createSweepAdminAlertOutboxUseCase,
  createListAdminAlertInboxUseCase,
  createAppendDomainEventsUseCase,
  createMarkAdminAlertSeenUseCase,
  createResolveAdminAlertUseCase,
} from "@avm-daily/application/use-cases";

import { ConvexError, v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";
import { getAdminUser } from "./utils";

import {
  createConvexAdminAlertReceiptRepository,
  createConvexNotificationEventRepository,
  createConvexNotificationEventScheduler,
  createConvexAdminAlertInboxRepository,
  createConvexAdminAlertConditionReader,
  createConvexAdminAlertRepository,
  createConvexAdminUserDirectory,
} from "./adapters/adminAlertAdapters";

import {
  notificationEventProcessingStatus,
  adminAlertResolutionKind,
  adminAlertReceiptState,
  notificationSourceKind,
  notificationEventType,
  adminAlertResolvedBy,
  adminAlertSeverity,
  adminAlertStatus,
  adminAlertScope,
  adminAlertType,
  resourceType,
  adminRole,
} from "./shared";

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

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toConvexError(error: unknown): never {
  if (error instanceof DomainError) {
    throw new ConvexError({ code: error.code, message: error.message });
  }

  throw error;
}

async function getAdminAlertById(ctx: MutationCtx, alertId: string) {
  return await ctx.db.get(alertId as AdminAlertId);
}

function createAlertWriteDeps(ctx: MutationCtx) {
  return {
    adminAlertRepository: createConvexAdminAlertRepository(ctx),
    adminAlertReceiptRepository: createConvexAdminAlertReceiptRepository(ctx),
    adminUserDirectory: createConvexAdminUserDirectory(ctx),
  };
}

function createAlertConditionDeps(ctx: MutationCtx) {
  return {
    ...createAlertWriteDeps(ctx),
    adminAlertConditionReader: createConvexAdminAlertConditionReader(ctx),
  };
}

function createAlertInboxDeps(ctx: Context) {
  return {
    adminAlertInboxRepository: createConvexAdminAlertInboxRepository(ctx),
  };
}

function createAlertProcessingDeps(ctx: MutationCtx) {
  return {
    ...createAlertConditionDeps(ctx),
    notificationEventRepository: createConvexNotificationEventRepository(ctx),
    notificationEventScheduler: createConvexNotificationEventScheduler(ctx),
  };
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
    try {
      const appendDomainEvents = createAppendDomainEventsUseCase({
        notificationEventRepository:
          createConvexNotificationEventRepository(ctx),
        notificationEventScheduler: createConvexNotificationEventScheduler(ctx),
      });

      const [eventId] = await appendDomainEvents([
        {
          eventType: args.eventType,
          sourceKind: args.sourceKind,
          resourceType: args.resourceType,
          resourceId: args.resourceId,
          dedupeKey: args.dedupeKey,
          payload: toRecord(args.payload),
          occurredAt: args.occurredAt,
        },
      ]);

      return eventId as any;
    } catch (error) {
      toConvexError(error);
    }
  },
});

export const processEvent = internalMutation({
  args: {
    eventId: v.id("notification_events"),
  },
  returns: v.object({
    eventId: v.id("notification_events"),
    processingStatus: notificationEventProcessingStatus,
  }),
  handler: async (ctx, args) => {
    try {
      const processAdminAlertEvent = createProcessAdminAlertEventUseCase(
        createAlertProcessingDeps(ctx),
      );

      const result = await processAdminAlertEvent({
        eventId: String(args.eventId),
      });

      return {
        eventId: result.eventId as any,
        processingStatus: result.processingStatus,
      };
    } catch (error) {
      toConvexError(error);
    }
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
    try {
      const sweepAdminAlertOutbox = createSweepAdminAlertOutboxUseCase(
        createAlertProcessingDeps(ctx),
      );

      return await sweepAdminAlertOutbox();
    } catch (error) {
      toConvexError(error);
    }
  },
});

export const evaluateQueueConditions = internalMutation({
  args: {},
  returns: v.object({
    changed: v.number(),
  }),
  handler: async (ctx) => {
    try {
      const evaluateAdminAlertConditions =
        createEvaluateAdminAlertConditionsUseCase(
          createAlertConditionDeps(ctx),
        );

      return await evaluateAdminAlertConditions();
    } catch (error) {
      toConvexError(error);
    }
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
    try {
      const upsertSharedAdminAlert = createUpsertSharedAdminAlertUseCase(
        createAlertWriteDeps(ctx),
      );
      const alert = await upsertSharedAdminAlert({
        alertType: args.alertType,
        severity: args.severity,
        title: args.title,
        body: args.body,
        fingerprint: args.fingerprint,
        metadata: toRecord(args.metadata),
        sourceEventId: args.sourceEventId
          ? String(args.sourceEventId)
          : undefined,
      });

      if (!alert) {
        return null;
      }

      return await getAdminAlertById(ctx, alert.id);
    } catch (error) {
      toConvexError(error);
    }
  },
});

export const fanOutReceipts = internalMutation({
  args: {
    alertId: v.id("admin_alerts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const fanOutAdminAlertReceipts = createFanOutAdminAlertReceiptsUseCase(
        createAlertWriteDeps(ctx),
      );
      await fanOutAdminAlertReceipts({ alertId: String(args.alertId) });
      return null;
    } catch (error) {
      toConvexError(error);
    }
  },
});

export const sendReminders = internalMutation({
  args: {},
  returns: v.object({
    reminded: v.number(),
  }),
  handler: async (ctx) => {
    try {
      const sendAdminAlertReminders = createSendAdminAlertRemindersUseCase(
        createAlertWriteDeps(ctx),
      );

      return { reminded: await sendAdminAlertReminders() };
    } catch (error) {
      toConvexError(error);
    }
  },
});

export const reconcileReceiptsForActiveAlerts = internalMutation({
  args: {},
  returns: v.object({
    alertsChecked: v.number(),
  }),
  handler: async (ctx) => {
    try {
      const reconcileAdminAlertReceipts =
        createReconcileAdminAlertReceiptsUseCase(createAlertWriteDeps(ctx));

      return {
        alertsChecked: await reconcileAdminAlertReceipts(),
      };
    } catch (error) {
      toConvexError(error);
    }
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
    const listAdminAlertInbox = createListAdminAlertInboxUseCase(
      createAlertInboxDeps(ctx),
    );

    const rows = await listAdminAlertInbox({
      adminUserId: String(admin._id),
      status: args.status,
      severity: args.severity,
      scope: args.scope,
      limit: args.limit,
    });

    return rows.map((row) => ({
      alert: {
        _id: row.alert.id as any,
        alert_type: row.alert.alertType,
        scope: row.alert.scope,
        severity: row.alert.severity,
        status: row.alert.status,
        title: row.alert.title,
        body: row.alert.body,
        fingerprint: row.alert.fingerprint,
        source_event_id: row.alert.sourceEventId as any,
        routing_roles: row.alert.routingRoles,
        metadata: row.alert.metadata,
        first_opened_at: row.alert.firstOpenedAt,
        last_triggered_at: row.alert.lastTriggeredAt,
        last_evaluated_at: row.alert.lastEvaluatedAt,
        next_reminder_at: row.alert.nextReminderAt,
        reminder_count: row.alert.reminderCount,
        resolution_kind: row.alert.resolutionKind,
        resolved_at: row.alert.resolvedAt,
        resolved_by:
          row.alert.resolvedBy?.actorType === "admin"
            ? {
                actor_type: "admin" as const,
                admin_user_id: row.alert.resolvedBy.adminUserId as any,
              }
            : row.alert.resolvedBy
              ? {
                  actor_type: "system" as const,
                  system_actor_type: row.alert.resolvedBy.systemActorType,
                }
              : undefined,
      },
      receipt: {
        receipt_id: row.receipt.id as any,
        delivery_state: row.receipt.deliveryState,
        delivered_at: row.receipt.deliveredAt,
        seen_at: row.receipt.seenAt,
        acknowledged_at: row.receipt.acknowledgedAt,
        last_notified_at: row.receipt.lastNotifiedAt,
      },
    }));
  },
});

export const getMyUnreadCount = query({
  args: {},
  returns: unreadCountValidator,
  handler: async (ctx) => {
    const admin = await getAdminUser(ctx);
    const getAdminAlertUnreadCount = createGetAdminAlertUnreadCountUseCase(
      createAlertInboxDeps(ctx),
    );
    return await getAdminAlertUnreadCount({
      adminUserId: String(admin._id),
    });
  },
});

export const getMyActiveSummary = query({
  args: {},
  returns: activeSummaryValidator,
  handler: async (ctx) => {
    const admin = await getAdminUser(ctx);
    const getAdminAlertActiveSummary = createGetAdminAlertActiveSummaryUseCase(
      createAlertInboxDeps(ctx),
    );
    return await getAdminAlertActiveSummary({
      adminUserId: String(admin._id),
    });
  },
});

export const markSeen = mutation({
  args: {
    alertId: v.id("admin_alerts"),
  },
  returns: adminAlertReceiptSummaryValidator,
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    try {
      const markAdminAlertSeen = createMarkAdminAlertSeenUseCase({
        adminAlertReceiptRepository:
          createConvexAdminAlertReceiptRepository(ctx),
      });
      const receipt = await markAdminAlertSeen({
        alertId: String(args.alertId),
        adminUserId: String(admin._id),
      });

      return {
        receipt_id: receipt.id as any,
        delivery_state: receipt.deliveryState,
        delivered_at: receipt.deliveredAt,
        seen_at: receipt.seenAt,
        acknowledged_at: receipt.acknowledgedAt,
        last_notified_at: receipt.lastNotifiedAt,
      };
    } catch (error) {
      toConvexError(error);
    }
  },
});

export const acknowledgeReceipt = mutation({
  args: {
    alertId: v.id("admin_alerts"),
  },
  returns: adminAlertReceiptSummaryValidator,
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    try {
      const acknowledgeAdminAlertReceipt =
        createAcknowledgeAdminAlertReceiptUseCase({
          adminAlertReceiptRepository:
            createConvexAdminAlertReceiptRepository(ctx),
        });
      const receipt = await acknowledgeAdminAlertReceipt({
        alertId: String(args.alertId),
        adminUserId: String(admin._id),
      });

      return {
        receipt_id: receipt.id as any,
        delivery_state: receipt.deliveryState,
        delivered_at: receipt.deliveredAt,
        seen_at: receipt.seenAt,
        acknowledged_at: receipt.acknowledgedAt,
        last_notified_at: receipt.lastNotifiedAt,
      };
    } catch (error) {
      toConvexError(error);
    }
  },
});

export const resolveAlert = mutation({
  args: {
    alertId: v.id("admin_alerts"),
  },
  returns: v.union(adminAlertSummaryValidator, v.null()),
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);

    try {
      const resolveAdminAlert = createResolveAdminAlertUseCase(
        createAlertConditionDeps(ctx),
      );
      const alert = await resolveAdminAlert({
        alertId: String(args.alertId),
        adminUserId: String(admin._id),
      });

      if (!alert) {
        return null;
      }

      return await getAdminAlertById(ctx, alert.id);
    } catch (error) {
      toConvexError(error);
    }
  },
});
