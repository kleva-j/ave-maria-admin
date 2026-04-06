import { describe, expect, it } from "vitest";

import { AdminRole } from "@avm-daily/domain";

import type {
  AdminAlertInboxRepository,
  AdminAlertReceiptRepository,
  NotificationEventRepository,
  NotificationEventScheduler,
  AdminAlertConditionReader,
  AdminAlertReceiptRecord,
  NotificationEventRecord,
  AdminAlertRepository,
  AdminUserDirectory,
  AdminAlertRecord,
  DomainEvent,
} from "../ports";

import {
  NotificationEventProcessingStatus,
  AdminAlertResolutionKind,
  AdminAlertReceiptState,
  NotificationEventType,
  AdminAlertSeverity,
  AdminAlertStatus,
  AdminAlertScope,
  AdminAlertType,
} from "../ports";

import {
  createAcknowledgeAdminAlertReceiptUseCase,
  createEvaluateAdminAlertConditionsUseCase,
  createGetAdminAlertActiveSummaryUseCase,
  createGetAdminAlertUnreadCountUseCase,
  createListAdminAlertInboxUseCase,
  createMarkAdminAlertSeenUseCase,
  createProcessAdminAlertEventUseCase,
  createAppendDomainEventsUseCase,
  createResolveAdminAlertUseCase,
} from "../use-cases/index.js";

function createNotificationEventRepository(
  initialEvents: NotificationEventRecord[] = [],
): NotificationEventRepository & { values: () => NotificationEventRecord[] } {
  const events = new Map(
    initialEvents.map((event) => [event.id, { ...event }]),
  );
  let counter = initialEvents.length + 1;

  return {
    values: () => [...events.values()].map((event) => ({ ...event })),
    async findById(id) {
      const event = events.get(id);
      return event ? { ...event } : null;
    },
    async findByDedupeKey(dedupeKey) {
      for (const event of events.values()) {
        if (event.dedupeKey === dedupeKey) {
          return { ...event };
        }
      }
      return null;
    },
    async create(event) {
      const created: NotificationEventRecord = {
        id: `event-${counter++}`,
        processingStatus:
          event.processingStatus ?? NotificationEventProcessingStatus.PENDING,
        attemptCount: event.attemptCount ?? 0,
        ...event,
      };
      events.set(created.id, created);
      return { ...created };
    },
    async update(id, patch) {
      const current = events.get(id);
      if (!current) {
        throw new Error(`Missing event ${id}`);
      }
      const updated = { ...current, ...patch };
      events.set(id, updated);
      return { ...updated };
    },
    async listDueForProcessing(now, limit) {
      return [...events.values()]
        .filter(
          (event) =>
            event.nextAttemptAt <= now &&
            event.processingStatus === NotificationEventProcessingStatus.PENDING,
        )
        .slice(0, limit)
        .map((event) => ({ ...event }));
    },
  };
}

function createNotificationEventScheduler(): NotificationEventScheduler & {
  scheduled: string[];
} {
  return {
    scheduled: [],
    async scheduleProcessEvent(eventId) {
      this.scheduled.push(eventId);
    },
  };
}

function createAdminAlertRepository(
  initialAlerts: AdminAlertRecord[] = [],
): AdminAlertRepository & { values: () => AdminAlertRecord[] } {
  const alerts = new Map(
    initialAlerts.map((alert) => [alert.id, { ...alert }]),
  );
  let counter = initialAlerts.length + 1;

  return {
    values: () => [...alerts.values()].map((alert) => ({ ...alert })),
    async findById(id) {
      const alert = alerts.get(id);
      return alert ? { ...alert } : null;
    },
    async findByFingerprint(fingerprint) {
      for (const alert of alerts.values()) {
        if (alert.fingerprint === fingerprint) {
          return { ...alert };
        }
      }
      return null;
    },
    async create(alert) {
      const created: AdminAlertRecord = {
        id: `alert-${counter++}`,
        ...alert,
      };
      alerts.set(created.id, created);
      return { ...created };
    },
    async update(id, patch) {
      const current = alerts.get(id);
      if (!current) {
        throw new Error(`Missing alert ${id}`);
      }
      const updated = { ...current, ...patch };
      alerts.set(id, updated);
      return { ...updated };
    },
    async listDueForReminder(now, limit) {
      return [...alerts.values()]
        .filter(
          (alert) =>
            alert.status === AdminAlertStatus.ACTIVE &&
            alert.nextReminderAt !== undefined &&
            alert.nextReminderAt <= now,
        )
        .slice(0, limit)
        .map((alert) => ({ ...alert }));
    },
    async listActive(limit) {
      return [...alerts.values()]
        .filter((alert) => alert.status === AdminAlertStatus.ACTIVE)
        .slice(0, limit)
        .map((alert) => ({ ...alert }));
    },
  };
}

function createAdminAlertReceiptRepository(
  initialReceipts: AdminAlertReceiptRecord[] = [],
): AdminAlertReceiptRepository & { values: () => AdminAlertReceiptRecord[] } {
  const receipts = new Map(
    initialReceipts.map((receipt) => [receipt.id, { ...receipt }]),
  );
  let counter = initialReceipts.length + 1;

  return {
    values: () => [...receipts.values()].map((receipt) => ({ ...receipt })),
    async findByAlertIdAndAdminUserId(alertId, adminUserId) {
      for (const receipt of receipts.values()) {
        if (
          receipt.alertId === alertId &&
          receipt.adminUserId === adminUserId
        ) {
          return { ...receipt };
        }
      }
      return null;
    },
    async listByAlertId(alertId) {
      return [...receipts.values()]
        .filter((receipt) => receipt.alertId === alertId)
        .map((receipt) => ({ ...receipt }));
    },
    async create(receipt) {
      const created: AdminAlertReceiptRecord = {
        id: `receipt-${counter++}`,
        ...receipt,
      };
      receipts.set(created.id, created);
      return { ...created };
    },
    async update(id, patch) {
      const current = receipts.get(id);
      if (!current) {
        throw new Error(`Missing receipt ${id}`);
      }
      const updated = { ...current, ...patch };
      receipts.set(id, updated);
      return { ...updated };
    },
  };
}

function createAdminAlertInboxRepository(
  entries: Array<{
    adminUserId: string;
    entry: {
      alert: AdminAlertRecord;
      receipt: AdminAlertReceiptRecord;
    };
  }>,
): AdminAlertInboxRepository {
  return {
    async listByAdminUserId(adminUserId, filters) {
      return entries
        .filter((item) => item.adminUserId === adminUserId)
        .map((item) => item.entry)
        .filter((item) =>
          filters.status ? item.alert.status === filters.status : true,
        )
        .filter((item) =>
          filters.severity ? item.alert.severity === filters.severity : true,
        )
        .filter((item) =>
          filters.scope ? item.alert.scope === filters.scope : true,
        )
        .slice(0, filters.limit ?? 100)
        .map((item) => ({
          alert: { ...item.alert },
          receipt: { ...item.receipt },
        }));
    },
    async getUnreadCountByAdminUserId(adminUserId) {
      return entries.filter(
        (item) =>
          item.adminUserId === adminUserId &&
          item.entry.receipt.deliveryState === AdminAlertReceiptState.UNREAD,
      ).length;
    },
    async getActiveSummaryByAdminUserId(adminUserId) {
      const active = entries
        .filter((item) => item.adminUserId === adminUserId)
        .map((item) => item.entry)
        .filter((item) => item.alert.status === AdminAlertStatus.ACTIVE);

      return {
        activeCount: active.length,
        criticalCount: active.filter(
          (item) => item.alert.severity === AdminAlertSeverity.CRITICAL,
        ).length,
        warningCount: active.filter(
          (item) => item.alert.severity === AdminAlertSeverity.WARNING,
        ).length,
        unreadCount: active.filter(
          (item) => item.receipt.deliveryState === AdminAlertReceiptState.UNREAD,
        ).length,
      };
    },
  };
}

function createAdminUserDirectory(
  directory: Partial<Record<AdminRole, string[]>>,
): AdminUserDirectory {
  return {
    async findActiveAdminIdsByRoles(roles) {
      const eligible = new Set<string>();
      for (const role of roles) {
        for (const adminId of directory[role] ?? []) {
          eligible.add(adminId);
        }
      }
      return [...eligible];
    },
  };
}

function createConditionReader(
  overrides: Partial<AdminAlertConditionReader> = {},
): AdminAlertConditionReader {
  return {
    async getPendingWithdrawalsSnapshot() {
      return { pendingCount: 0, oldestRequestedAt: undefined };
    },
    async getApprovedWithdrawalsSnapshot() {
      return { approvedCount: 0, oldestApprovedAt: undefined };
    },
    async getKycPendingSnapshot() {
      return {
        pendingUserCount: 0,
        pendingDocumentCount: 0,
        oldestPendingDocumentAt: undefined,
      };
    },
    async getBankVerificationPendingSnapshot() {
      return { pendingAccountCount: 0, oldestSubmissionAt: undefined };
    },
    async getReconciliationRunSnapshot() {
      return { latestCompletedAt: Date.now(), latestRunId: "run-1" };
    },
    async getReconciliationOpenIssuesSnapshot() {
      return { openIssueCount: 0, latestIssueAt: undefined };
    },
    ...overrides,
  };
}

describe("admin alert use cases", () => {
  it("deduplicates appended domain events and schedules processing once", async () => {
    const notificationEventRepository = createNotificationEventRepository();
    const notificationEventScheduler = createNotificationEventScheduler();
    const appendDomainEvents = createAppendDomainEventsUseCase({
      notificationEventRepository,
      notificationEventScheduler,
    });

    const event: DomainEvent = {
      eventType: NotificationEventType.RECONCILIATION_RUN_FAILED,
      sourceKind: "system",
      resourceType: "transaction_reconciliation_runs",
      resourceId: "run-1",
      dedupeKey: "reconciliation_run_failed:run-1:1",
      payload: { run_id: "run-1" },
      occurredAt: 1,
    };

    const first = await appendDomainEvents([event]);
    const second = await appendDomainEvents([event]);

    expect(first).toHaveLength(1);
    expect(second).toEqual(first);
    expect(notificationEventRepository.values()).toHaveLength(1);
    expect(notificationEventScheduler.scheduled).toEqual([first[0]]);
  });

  it("processes reconciliation failures into a shared alert with per-admin receipts", async () => {
    const notificationEventRepository = createNotificationEventRepository([
      {
        id: "event-1",
        eventType: NotificationEventType.RECONCILIATION_RUN_FAILED,
        sourceKind: "system",
        resourceType: "transaction_reconciliation_runs",
        resourceId: "run-1",
        dedupeKey: "reconciliation_run_failed:run-1:1",
        payload: {
          run_id: "run-1",
          error: "ledger mismatch",
          issue_count: 2,
        },
        occurredAt: 1,
        processingStatus: NotificationEventProcessingStatus.PENDING,
        attemptCount: 0,
        nextAttemptAt: 1,
      },
    ]);
    const adminAlertRepository = createAdminAlertRepository();
    const adminAlertReceiptRepository = createAdminAlertReceiptRepository();
    const processAdminAlertEvent = createProcessAdminAlertEventUseCase({
      notificationEventRepository,
      adminAlertRepository,
      adminAlertReceiptRepository,
      adminUserDirectory: createAdminUserDirectory({
        [AdminRole.FINANCE]: ["admin-finance"],
        [AdminRole.SUPER_ADMIN]: ["admin-super"],
      }),
    });

    const result = await processAdminAlertEvent({
      eventId: "event-1",
      now: 10,
    });

    expect(result.processingStatus).toBe(
      NotificationEventProcessingStatus.PROCESSED,
    );

    const [alert] = adminAlertRepository.values();
    if (!alert) throw new Error("Missing alert");
    expect(alert).toMatchObject({
      alertType: AdminAlertType.RECONCILIATION_RUN_FAILED,
      scope: AdminAlertScope.RECONCILIATION,
      severity: AdminAlertSeverity.CRITICAL,
      status: AdminAlertStatus.ACTIVE,
      fingerprint: AdminAlertType.RECONCILIATION_RUN_FAILED,
    });

    expect(adminAlertReceiptRepository.values()).toEqual([
      expect.objectContaining({
        alertId: alert.id,
        adminUserId: "admin-finance",
        deliveryState: AdminAlertReceiptState.UNREAD,
      }),
      expect.objectContaining({
        alertId: alert.id,
        adminUserId: "admin-super",
        deliveryState: AdminAlertReceiptState.UNREAD,
      }),
    ]);
  });

  it("treats non-alerting notification events as handled no-ops", async () => {
    const notificationEventRepository = createNotificationEventRepository([
      {
        id: "event-1",
        eventType: NotificationEventType.WITHDRAWAL_REQUESTED,
        sourceKind: "user",
        resourceType: "withdrawals",
        resourceId: "withdrawal-1",
        dedupeKey: "withdrawal_requested:withdrawal-1",
        payload: {
          withdrawal_id: "withdrawal-1",
        },
        occurredAt: 1,
        processingStatus: NotificationEventProcessingStatus.PENDING,
        attemptCount: 0,
        nextAttemptAt: 1,
      },
    ]);
    const adminAlertRepository = createAdminAlertRepository();
    const adminAlertReceiptRepository = createAdminAlertReceiptRepository();
    const processAdminAlertEvent = createProcessAdminAlertEventUseCase({
      notificationEventRepository,
      adminAlertRepository,
      adminAlertReceiptRepository,
      adminUserDirectory: createAdminUserDirectory({}),
    });

    const result = await processAdminAlertEvent({
      eventId: "event-1",
      now: 10,
    });

    expect(result.processingStatus).toBe(
      NotificationEventProcessingStatus.PROCESSED,
    );
    expect(adminAlertRepository.values()).toEqual([]);
    expect(adminAlertReceiptRepository.values()).toEqual([]);
  });

  it("auto-resolves condition alerts after two healthy evaluations", async () => {
    let pendingSnapshot: { pendingCount: number; oldestRequestedAt?: number } = { pendingCount: 1, oldestRequestedAt: 1 };

    const adminAlertRepository = createAdminAlertRepository();
    const adminAlertReceiptRepository = createAdminAlertReceiptRepository();
    const evaluateAdminAlertConditions =
      createEvaluateAdminAlertConditionsUseCase({
        adminAlertRepository,
        adminAlertReceiptRepository,
        adminUserDirectory: createAdminUserDirectory({
          [AdminRole.OPERATIONS]: ["admin-ops"],
          [AdminRole.FINANCE]: ["admin-finance"],
          [AdminRole.SUPER_ADMIN]: ["admin-super"],
        }),
        adminAlertConditionReader: createConditionReader({
          async getPendingWithdrawalsSnapshot() {
            return pendingSnapshot;
          },
        }),
      });

    await evaluateAdminAlertConditions({ now: 16 * 60 * 1000 });
    let [alert] = adminAlertRepository.values();
    if (!alert) throw new Error("Missing alert");
    expect(alert.status).toBe(AdminAlertStatus.ACTIVE);

    pendingSnapshot = { pendingCount: 0, oldestRequestedAt: undefined };
    await evaluateAdminAlertConditions({ now: 17 * 60 * 1000 });
    [alert] = adminAlertRepository.values();
    if (!alert) throw new Error("Missing alert");
    expect(alert.status).toBe(AdminAlertStatus.ACTIVE);
    expect(alert.metadata).toMatchObject({ healthy_streak: 1 });

    await evaluateAdminAlertConditions({ now: 18 * 60 * 1000 });
    [alert] = adminAlertRepository.values();
    if (!alert) throw new Error("Missing alert");
    expect(alert.status).toBe(AdminAlertStatus.RESOLVED);
    expect(alert.resolutionKind).toBe(AdminAlertResolutionKind.AUTOMATIC);
  });

  it("rejects manual resolution while the underlying condition is still active", async () => {
    const adminAlertRepository = createAdminAlertRepository([
      {
        id: "alert-1",
        alertType: AdminAlertType.WITHDRAWALS_PENDING_OLDEST,
        scope: AdminAlertScope.WITHDRAWALS,
        severity: AdminAlertSeverity.WARNING,
        status: AdminAlertStatus.ACTIVE,
        title: "Withdrawal queue is aging",
        body: "Body",
        fingerprint: AdminAlertType.WITHDRAWALS_PENDING_OLDEST,
        routingRoles: [
          AdminRole.OPERATIONS,
          AdminRole.FINANCE,
          AdminRole.SUPER_ADMIN,
        ],
        metadata: { pending_count: 1, healthy_streak: 0 },
        firstOpenedAt: 1,
        lastTriggeredAt: 1,
        lastEvaluatedAt: 1,
        nextReminderAt: 2,
        reminderCount: 0,
      },
    ]);
    const adminAlertReceiptRepository = createAdminAlertReceiptRepository([
      {
        id: "receipt-1",
        alertId: "alert-1",
        adminUserId: "admin-1",
        deliveryState: AdminAlertReceiptState.UNREAD,
        deliveredAt: 1,
        lastNotifiedAt: 1,
      },
    ]);
    const resolveAdminAlert = createResolveAdminAlertUseCase({
      adminAlertRepository,
      adminAlertReceiptRepository,
      adminUserDirectory: createAdminUserDirectory({}),
      adminAlertConditionReader: createConditionReader({
        async getPendingWithdrawalsSnapshot() {
          return {
            pendingCount: 2,
            oldestRequestedAt: 1,
          };
        },
      }),
    });

    await expect(
      resolveAdminAlert({
        alertId: "alert-1",
        adminUserId: "admin-1",
        now: 16 * 60 * 1000,
      }),
    ).rejects.toMatchObject({
      code: "admin_alert_condition_still_active",
    });
  });

  it("lists inbox entries and derives unread and active summaries via the inbox port", async () => {
    const inboxRepository = createAdminAlertInboxRepository([
      {
        adminUserId: "admin-1",
        entry: {
          alert: {
            id: "alert-1",
            alertType: AdminAlertType.RECONCILIATION_RUN_FAILED,
            scope: AdminAlertScope.RECONCILIATION,
            severity: AdminAlertSeverity.CRITICAL,
            status: AdminAlertStatus.ACTIVE,
            title: "Reconciliation run failed",
            body: "Body",
            fingerprint: AdminAlertType.RECONCILIATION_RUN_FAILED,
            routingRoles: [AdminRole.FINANCE, AdminRole.SUPER_ADMIN],
            firstOpenedAt: 1,
            lastTriggeredAt: 2,
            lastEvaluatedAt: 2,
            nextReminderAt: 3,
            reminderCount: 0,
          },
          receipt: {
            id: "receipt-1",
            alertId: "alert-1",
            adminUserId: "admin-1",
            deliveryState: AdminAlertReceiptState.UNREAD,
            deliveredAt: 1,
            lastNotifiedAt: 2,
          },
        },
      },
      {
        adminUserId: "admin-1",
        entry: {
          alert: {
            id: "alert-2",
            alertType: AdminAlertType.KYC_PENDING_OLDEST,
            scope: AdminAlertScope.KYC,
            severity: AdminAlertSeverity.WARNING,
            status: AdminAlertStatus.RESOLVED,
            title: "KYC queue is aging",
            body: "Body",
            fingerprint: AdminAlertType.KYC_PENDING_OLDEST,
            routingRoles: [
              AdminRole.COMPLIANCE,
              AdminRole.SUPPORT,
              AdminRole.SUPER_ADMIN,
            ],
            firstOpenedAt: 1,
            lastTriggeredAt: 2,
            lastEvaluatedAt: 2,
            reminderCount: 0,
          },
          receipt: {
            id: "receipt-2",
            alertId: "alert-2",
            adminUserId: "admin-1",
            deliveryState: AdminAlertReceiptState.SEEN,
            deliveredAt: 1,
            seenAt: 2,
            lastNotifiedAt: 2,
          },
        },
      },
    ]);

    const listAdminAlertInbox = createListAdminAlertInboxUseCase({
      adminAlertInboxRepository: inboxRepository,
    });
    const getAdminAlertUnreadCount = createGetAdminAlertUnreadCountUseCase({
      adminAlertInboxRepository: inboxRepository,
    });
    const getAdminAlertActiveSummary = createGetAdminAlertActiveSummaryUseCase({
      adminAlertInboxRepository: inboxRepository,
    });

    const inbox = await listAdminAlertInbox({
      adminUserId: "admin-1",
      status: AdminAlertStatus.ACTIVE,
      limit: 10,
    });

    expect(inbox).toHaveLength(1);
    expect(inbox[0]?.alert.id).toBe("alert-1");
    expect(await getAdminAlertUnreadCount({ adminUserId: "admin-1" })).toEqual({
      unreadCount: 1,
    });
    expect(
      await getAdminAlertActiveSummary({ adminUserId: "admin-1" }),
    ).toEqual({
      activeCount: 1,
      criticalCount: 1,
      warningCount: 0,
      unreadCount: 1,
    });
  });

  it("marks receipts seen and acknowledged through the receipt repository", async () => {
    const adminAlertReceiptRepository = createAdminAlertReceiptRepository([
      {
        id: "receipt-1",
        alertId: "alert-1",
        adminUserId: "admin-1",
        deliveryState: AdminAlertReceiptState.UNREAD,
        deliveredAt: 1,
        lastNotifiedAt: 1,
      },
    ]);

    const markAdminAlertSeen = createMarkAdminAlertSeenUseCase({
      adminAlertReceiptRepository,
    });
    const acknowledgeAdminAlertReceipt =
      createAcknowledgeAdminAlertReceiptUseCase({
        adminAlertReceiptRepository,
      });

    const seen = await markAdminAlertSeen({
      alertId: "alert-1",
      adminUserId: "admin-1",
      now: 5,
    });
    expect(seen).toMatchObject({
      deliveryState: AdminAlertReceiptState.SEEN,
      seenAt: 5,
    });

    const acknowledged = await acknowledgeAdminAlertReceipt({
      alertId: "alert-1",
      adminUserId: "admin-1",
      now: 6,
    });
    expect(acknowledged).toMatchObject({
      deliveryState: AdminAlertReceiptState.ACKNOWLEDGED,
      seenAt: 5,
      acknowledgedAt: 6,
    });
  });
});
