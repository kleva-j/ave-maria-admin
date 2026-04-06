import type { MutationCtx } from "./_generated/server";
import type { AdminAlertId } from "./types";

import { DomainError } from "@avm-daily/domain";
import {
  createEvaluateAdminAlertConditionsUseCase,
  createReconcileAdminAlertReceiptsUseCase,
  createFanOutAdminAlertReceiptsUseCase,
  createSendAdminAlertRemindersUseCase,
  createUpsertSharedAdminAlertUseCase,
  createProcessAdminAlertEventUseCase,
  createSweepAdminAlertOutboxUseCase,
  createAppendDomainEventsUseCase,
  createResolveAdminAlertUseCase,
} from "@avm-daily/application/use-cases";

import { ConvexError, v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";
import { getAdminUser } from "./utils";

import {
  createConvexAdminAlertReceiptRepository,
  createConvexNotificationEventRepository,
  createConvexNotificationEventScheduler,
  createConvexAdminAlertConditionReader,
  createConvexAdminAlertRepository,
  createConvexAdminUserDirectory,
} from "./adapters/adminAlertAdapters";

import {
  notificationEventProcessingStatus,
  adminAlertResolutionKind,
  AdminAlertReceiptState,
  adminAlertReceiptState,
  notificationSourceKind,
  notificationEventType,
  adminAlertResolvedBy,
  adminAlertSeverity,
  AdminAlertStatus,
  adminAlertStatus,
  adminAlertScope,
  adminAlertType,
  resourceType,
  TABLE_NAMES,
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

async function getReceiptForAdmin(
  ctx: MutationCtx,
  alertId: AdminAlertId,
  adminUserId: string,
) {
  return await ctx.db
    .query(TABLE_NAMES.ADMIN_ALERT_RECEIPTS)
    .withIndex("by_alert_id_and_admin_user_id", (q) =>
      q.eq("alert_id", alertId).eq("admin_user_id", adminUserId as any),
    )
    .first();
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
      criticalCount: rows.filter((entry) => entry.alert.severity === "critical")
        .length,
      warningCount: rows.filter((entry) => entry.alert.severity === "warning")
        .length,
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
      ctx,
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
      ctx,
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
