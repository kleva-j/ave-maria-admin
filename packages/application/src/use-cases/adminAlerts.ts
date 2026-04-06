import {
  durationMinutesToMilliseconds,
  differenceInSafeMilliseconds,
  durationHoursToMilliseconds,
  addMillisecondsToTimestamp,
  differenceInSafeMinutes,
  isTimestampAfter,
  DomainError,
  AdminRole,
} from "@avm-daily/domain";

import type {
  NotificationEventRepository,
  AdminAlertReceiptRepository,
  NotificationEventScheduler,
  AdminAlertConditionReader,
  NotificationEventRecord,
  AdminAlertRepository,
  AdminAlertResolvedBy,
  AdminUserDirectory,
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
  SystemActorType,
  AdminAlertType,
} from "../ports";

export const DEFAULT_ADMIN_ALERT_BATCH_SIZE = 100;

function durationMinutesMs(minutes: number) {
  return durationMinutesToMilliseconds(minutes);
}

function durationHoursMs(hours: number) {
  return durationHoursToMilliseconds(hours);
}

const PROCESSING_LEASE_MS = durationMinutesMs(5);

export type AdminAlertPolicy = {
  alertType: AdminAlertType;
  scope: (typeof AdminAlertScope)[keyof typeof AdminAlertScope];
  routingRoles: readonly (typeof AdminRole)[keyof typeof AdminRole][];
  requiresHealthyConditionForManualResolve: boolean;
};

export const ADMIN_ALERT_POLICIES: Record<AdminAlertType, AdminAlertPolicy> = {
  [AdminAlertType.WITHDRAWALS_PENDING_OLDEST]: {
    alertType: AdminAlertType.WITHDRAWALS_PENDING_OLDEST,
    scope: AdminAlertScope.WITHDRAWALS,
    routingRoles: [
      AdminRole.OPERATIONS,
      AdminRole.FINANCE,
      AdminRole.SUPER_ADMIN,
    ],
    requiresHealthyConditionForManualResolve: true,
  },
  [AdminAlertType.WITHDRAWALS_APPROVED_UNPROCESSED_OLDEST]: {
    alertType: AdminAlertType.WITHDRAWALS_APPROVED_UNPROCESSED_OLDEST,
    scope: AdminAlertScope.WITHDRAWALS,
    routingRoles: [
      AdminRole.OPERATIONS,
      AdminRole.FINANCE,
      AdminRole.SUPER_ADMIN,
    ],
    requiresHealthyConditionForManualResolve: true,
  },
  [AdminAlertType.KYC_PENDING_OLDEST]: {
    alertType: AdminAlertType.KYC_PENDING_OLDEST,
    scope: AdminAlertScope.KYC,
    routingRoles: [
      AdminRole.COMPLIANCE,
      AdminRole.SUPPORT,
      AdminRole.SUPER_ADMIN,
    ],
    requiresHealthyConditionForManualResolve: true,
  },
  [AdminAlertType.BANK_VERIFICATION_PENDING_OLDEST]: {
    alertType: AdminAlertType.BANK_VERIFICATION_PENDING_OLDEST,
    scope: AdminAlertScope.BANK_VERIFICATION,
    routingRoles: [
      AdminRole.OPERATIONS,
      AdminRole.COMPLIANCE,
      AdminRole.SUPER_ADMIN,
    ],
    requiresHealthyConditionForManualResolve: true,
  },
  [AdminAlertType.RECONCILIATION_RUN_FAILED]: {
    alertType: AdminAlertType.RECONCILIATION_RUN_FAILED,
    scope: AdminAlertScope.RECONCILIATION,
    routingRoles: [AdminRole.FINANCE, AdminRole.SUPER_ADMIN],
    requiresHealthyConditionForManualResolve: false,
  },
  [AdminAlertType.RECONCILIATION_RUN_STALE]: {
    alertType: AdminAlertType.RECONCILIATION_RUN_STALE,
    scope: AdminAlertScope.RECONCILIATION,
    routingRoles: [AdminRole.FINANCE, AdminRole.SUPER_ADMIN],
    requiresHealthyConditionForManualResolve: true,
  },
  [AdminAlertType.RECONCILIATION_OPEN_ISSUES]: {
    alertType: AdminAlertType.RECONCILIATION_OPEN_ISSUES,
    scope: AdminAlertScope.RECONCILIATION,
    routingRoles: [AdminRole.FINANCE, AdminRole.SUPER_ADMIN],
    requiresHealthyConditionForManualResolve: true,
  },
};

type ConditionEvaluation = {
  alertType: AdminAlertType;
  fingerprint: string;
  severity: AdminAlertSeverity | null;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
};

type AlertWriteDeps = {
  adminAlertRepository: AdminAlertRepository;
  adminAlertReceiptRepository: AdminAlertReceiptRepository;
  adminUserDirectory: AdminUserDirectory;
};

function toMetadataRecord(
  value: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return value ? { ...value } : {};
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
  actorType: (typeof SystemActorType)[keyof typeof SystemActorType],
): AdminAlertResolvedBy {
  return {
    actorType: "system",
    systemActorType: actorType,
  };
}

function buildAdminResolvedBy(adminUserId: string): AdminAlertResolvedBy {
  return {
    actorType: "admin",
    adminUserId,
  };
}

function ageMinutes(now: number, timestamp: number) {
  return differenceInSafeMinutes(now, timestamp);
}

function ageMilliseconds(now: number, timestamp: number) {
  return differenceInSafeMilliseconds(now, timestamp);
}

function addDurationMs(timestamp: number, durationMs: number) {
  return addMillisecondsToTimestamp(timestamp, durationMs);
}

export function computeNotificationRetryBackoffMs(attemptCount: number) {
  const retryDelayMs = durationMinutesMs(2 ** Math.max(0, attemptCount - 1));
  const maxRetryDelayMs = durationMinutesMs(30);

  return Math.min(maxRetryDelayMs, retryDelayMs);
}

export function getAdminAlertPolicy(alertType: AdminAlertType) {
  return ADMIN_ALERT_POLICIES[alertType];
}

export function requiresHealthyConditionForManualResolve(
  alertType: AdminAlertType,
) {
  return getAdminAlertPolicy(alertType)
    .requiresHealthyConditionForManualResolve;
}

export function getReminderIntervalMs(severity: AdminAlertSeverity): number {
  return durationMinutesMs(severity === AdminAlertSeverity.CRITICAL ? 15 : 30);
}

async function getEligibleAdminIdsForRoles(
  adminUserDirectory: AdminUserDirectory,
  roles: readonly (typeof AdminRole)[keyof typeof AdminRole][],
) {
  const eligible = new Set(
    await adminUserDirectory.findActiveAdminIdsByRoles(roles),
  );
  return [...eligible];
}

async function resetReceiptsForReopenedAlert(
  adminAlertReceiptRepository: AdminAlertReceiptRepository,
  alertId: string,
  now: number,
) {
  const receipts = await adminAlertReceiptRepository.listByAlertId(alertId);
  await Promise.all(
    receipts.map((receipt) =>
      adminAlertReceiptRepository.update(receipt.id, {
        deliveryState: AdminAlertReceiptState.UNREAD,
        deliveredAt: now,
        seenAt: undefined,
        acknowledgedAt: undefined,
        lastNotifiedAt: now,
      }),
    ),
  );
}

async function fanOutAlertReceiptsInternal(
  deps: AlertWriteDeps,
  alertId: string,
  now: number,
) {
  const alert = await deps.adminAlertRepository.findById(alertId);
  if (!alert) {
    throw new DomainError("Alert not found", "admin_alert_not_found");
  }

  const eligibleAdminIds = await getEligibleAdminIdsForRoles(
    deps.adminUserDirectory,
    alert.routingRoles,
  );

  for (const adminUserId of eligibleAdminIds) {
    const existing =
      await deps.adminAlertReceiptRepository.findByAlertIdAndAdminUserId(
        alertId,
        adminUserId,
      );
    if (existing) {
      continue;
    }

    await deps.adminAlertReceiptRepository.create({
      alertId,
      adminUserId,
      deliveryState: AdminAlertReceiptState.UNREAD,
      deliveredAt: now,
      lastNotifiedAt: now,
    });
  }
}

async function resolveAlertInternal(
  adminAlertRepository: AdminAlertRepository,
  input: {
    alertId: string;
    now: number;
    resolutionKind: AdminAlertResolutionKind;
    resolvedBy: AdminAlertResolvedBy;
  },
) {
  const alert = await adminAlertRepository.findById(input.alertId);
  if (!alert || alert.status === AdminAlertStatus.RESOLVED) {
    return alert;
  }

  return await adminAlertRepository.update(input.alertId, {
    status: AdminAlertStatus.RESOLVED,
    resolutionKind: input.resolutionKind,
    resolvedAt: input.now,
    resolvedBy: input.resolvedBy,
    nextReminderAt: undefined,
    lastEvaluatedAt: input.now,
  });
}

async function upsertSharedAlertInternal(
  deps: AlertWriteDeps,
  input: {
    alertType: AdminAlertType;
    severity: AdminAlertSeverity;
    title: string;
    body: string;
    fingerprint: string;
    metadata: Record<string, unknown>;
    sourceEventId?: string;
    now: number;
  },
) {
  const policy = getAdminAlertPolicy(input.alertType);
  const existing = await deps.adminAlertRepository.findByFingerprint(
    input.fingerprint,
  );
  const nextReminderAt = addDurationMs(
    input.now,
    getReminderIntervalMs(input.severity),
  );

  if (existing) {
    const reopening = existing.status === AdminAlertStatus.RESOLVED;
    const severityChanged = existing.severity !== input.severity;

    const updated = await deps.adminAlertRepository.update(existing.id, {
      severity: input.severity,
      status: AdminAlertStatus.ACTIVE,
      title: input.title,
      body: input.body,
      sourceEventId: input.sourceEventId ?? existing.sourceEventId,
      routingRoles: [...policy.routingRoles],
      metadata: input.metadata,
      lastTriggeredAt: input.now,
      lastEvaluatedAt: input.now,
      nextReminderAt:
        reopening || severityChanged
          ? nextReminderAt
          : (existing.nextReminderAt ?? nextReminderAt),
      reminderCount: reopening ? 0 : existing.reminderCount,
      resolutionKind: undefined,
      resolvedAt: undefined,
      resolvedBy: undefined,
    });

    if (reopening) {
      await resetReceiptsForReopenedAlert(
        deps.adminAlertReceiptRepository,
        existing.id,
        input.now,
      );
    }

    await fanOutAlertReceiptsInternal(deps, existing.id, input.now);
    return updated;
  }

  const created = await deps.adminAlertRepository.create({
    alertType: input.alertType,
    scope: policy.scope,
    severity: input.severity,
    status: AdminAlertStatus.ACTIVE,
    title: input.title,
    body: input.body,
    fingerprint: input.fingerprint,
    sourceEventId: input.sourceEventId,
    routingRoles: [...policy.routingRoles],
    metadata: input.metadata,
    firstOpenedAt: input.now,
    lastTriggeredAt: input.now,
    lastEvaluatedAt: input.now,
    nextReminderAt,
    reminderCount: 0,
  });

  await fanOutAlertReceiptsInternal(deps, created.id, input.now);
  return created;
}

async function applyConditionEvaluation(
  deps: AlertWriteDeps,
  evaluation: ConditionEvaluation,
  now: number,
) {
  const existing = await deps.adminAlertRepository.findByFingerprint(
    evaluation.fingerprint,
  );

  if (evaluation.severity) {
    await upsertSharedAlertInternal(deps, {
      alertType: evaluation.alertType,
      severity: evaluation.severity,
      title: evaluation.title,
      body: evaluation.body,
      fingerprint: evaluation.fingerprint,
      metadata: buildHealthyMetadata(evaluation.metadata, 0),
      now,
    });
    return { changed: true };
  }

  if (!existing || existing.status === AdminAlertStatus.RESOLVED) {
    return { changed: false };
  }

  const currentMetadata = toMetadataRecord(existing.metadata);
  const healthyStreak = Number(currentMetadata.healthy_streak ?? 0) + 1;

  if (healthyStreak >= 2) {
    await resolveAlertInternal(deps.adminAlertRepository, {
      alertId: existing.id,
      now,
      resolutionKind: AdminAlertResolutionKind.AUTOMATIC,
      resolvedBy: buildSystemResolvedBy(SystemActorType.CRON),
    });
    return { changed: true };
  }

  await deps.adminAlertRepository.update(existing.id, {
    metadata: buildHealthyMetadata(currentMetadata, healthyStreak),
    lastEvaluatedAt: now,
  });

  return { changed: true };
}

async function evaluatePendingWithdrawalsCondition(
  reader: AdminAlertConditionReader,
  now: number,
): Promise<ConditionEvaluation> {
  const snapshot = await reader.getPendingWithdrawalsSnapshot();
  if (snapshot.oldestRequestedAt === undefined) {
    return {
      alertType: AdminAlertType.WITHDRAWALS_PENDING_OLDEST,
      fingerprint: AdminAlertType.WITHDRAWALS_PENDING_OLDEST,
      severity: null,
      title: "Withdrawal queue is healthy",
      body: "No pending withdrawals require action.",
      metadata: { pending_count: 0 },
    };
  }

  const ageMs = ageMilliseconds(now, snapshot.oldestRequestedAt);
  const severity =
    ageMs >= durationHoursMs(1) || snapshot.pendingCount >= 10
      ? AdminAlertSeverity.CRITICAL
      : ageMs >= durationMinutesMs(15)
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
    body: `${snapshot.pendingCount} pending withdrawals remain open. The oldest request has been waiting ${ageMinutes(
      now,
      snapshot.oldestRequestedAt,
    )} minutes.`,
    metadata: {
      pending_count: snapshot.pendingCount,
      oldest_pending_requested_at: snapshot.oldestRequestedAt,
      oldest_pending_age_ms: ageMs,
    },
  };
}

async function evaluateApprovedWithdrawalsCondition(
  reader: AdminAlertConditionReader,
  now: number,
): Promise<ConditionEvaluation> {
  const snapshot = await reader.getApprovedWithdrawalsSnapshot();
  if (snapshot.oldestApprovedAt === undefined) {
    return {
      alertType: AdminAlertType.WITHDRAWALS_APPROVED_UNPROCESSED_OLDEST,
      fingerprint: AdminAlertType.WITHDRAWALS_APPROVED_UNPROCESSED_OLDEST,
      severity: null,
      title: "Approved withdrawals are healthy",
      body: "No approved withdrawals are waiting for processing.",
      metadata: { approved_count: 0 },
    };
  }

  const ageMs = ageMilliseconds(now, snapshot.oldestApprovedAt);
  const severity =
    ageMs >= durationHoursMs(2) || snapshot.approvedCount >= 5
      ? AdminAlertSeverity.CRITICAL
      : ageMs >= durationMinutesMs(30)
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
    body: `${snapshot.approvedCount} approved withdrawals still need settlement. The oldest approved withdrawal has been waiting ${ageMinutes(
      now,
      snapshot.oldestApprovedAt,
    )} minutes.`,
    metadata: {
      approved_count: snapshot.approvedCount,
      oldest_approved_at: snapshot.oldestApprovedAt,
      oldest_approved_age_ms: ageMs,
    },
  };
}

async function evaluateKycPendingCondition(
  reader: AdminAlertConditionReader,
  now: number,
): Promise<ConditionEvaluation> {
  const snapshot = await reader.getKycPendingSnapshot();
  if (snapshot.oldestPendingDocumentAt === undefined) {
    return {
      alertType: AdminAlertType.KYC_PENDING_OLDEST,
      fingerprint: AdminAlertType.KYC_PENDING_OLDEST,
      severity: null,
      title: "KYC queue is healthy",
      body: "No pending KYC documents require manual review.",
      metadata: { pending_user_count: 0, pending_document_count: 0 },
    };
  }

  const ageMs = ageMilliseconds(now, snapshot.oldestPendingDocumentAt);
  const severity =
    ageMs >= durationHoursMs(4) || snapshot.pendingUserCount >= 15
      ? AdminAlertSeverity.CRITICAL
      : ageMs >= durationMinutesMs(30)
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
    body: `${snapshot.pendingUserCount} users are still waiting in the KYC queue. The oldest pending document has been open for ${ageMinutes(
      now,
      snapshot.oldestPendingDocumentAt,
    )} minutes.`,
    metadata: {
      pending_user_count: snapshot.pendingUserCount,
      pending_document_count: snapshot.pendingDocumentCount,
      oldest_pending_document_at: snapshot.oldestPendingDocumentAt,
      oldest_pending_document_age_ms: ageMs,
    },
  };
}

async function evaluateBankVerificationCondition(
  reader: AdminAlertConditionReader,
  now: number,
): Promise<ConditionEvaluation> {
  const snapshot = await reader.getBankVerificationPendingSnapshot();
  if (snapshot.oldestSubmissionAt === undefined) {
    return {
      alertType: AdminAlertType.BANK_VERIFICATION_PENDING_OLDEST,
      fingerprint: AdminAlertType.BANK_VERIFICATION_PENDING_OLDEST,
      severity: null,
      title: "Bank verification queue is healthy",
      body: "No bank account submissions require review.",
      metadata: { pending_account_count: 0 },
    };
  }

  const ageMs = ageMilliseconds(now, snapshot.oldestSubmissionAt);
  const severity =
    ageMs >= durationHoursMs(4) || snapshot.pendingAccountCount >= 10
      ? AdminAlertSeverity.CRITICAL
      : ageMs >= durationMinutesMs(30)
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
    body: `${snapshot.pendingAccountCount} bank account submissions are waiting for review. The oldest submission has been pending for ${ageMinutes(
      now,
      snapshot.oldestSubmissionAt,
    )} minutes.`,
    metadata: {
      pending_account_count: snapshot.pendingAccountCount,
      oldest_submission_at: snapshot.oldestSubmissionAt,
      oldest_submission_age_ms: ageMs,
    },
  };
}

async function evaluateReconciliationRunStaleCondition(
  reader: AdminAlertConditionReader,
  now: number,
): Promise<ConditionEvaluation> {
  const snapshot = await reader.getReconciliationRunSnapshot();
  if (snapshot.latestCompletedAt === undefined) {
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

  const ageMs = ageMilliseconds(now, snapshot.latestCompletedAt);
  const severity =
    ageMs >= durationHoursMs(4)
      ? AdminAlertSeverity.CRITICAL
      : ageMs >= durationHoursMs(2)
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
      snapshot.latestCompletedAt,
    )} minutes ago.`,
    metadata: {
      latest_completed_at: snapshot.latestCompletedAt,
      latest_completed_age_ms: ageMs,
      latest_run_id: snapshot.latestRunId,
    },
  };
}

async function evaluateReconciliationOpenIssuesCondition(
  reader: AdminAlertConditionReader,
  now: number,
): Promise<ConditionEvaluation> {
  const snapshot = await reader.getReconciliationOpenIssuesSnapshot();
  const severity =
    snapshot.openIssueCount >= 5
      ? AdminAlertSeverity.CRITICAL
      : snapshot.openIssueCount > 0
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
      snapshot.openIssueCount > 0
        ? `${snapshot.openIssueCount} reconciliation issue${snapshot.openIssueCount === 1 ? "" : "s"} remain open.`
        : "No reconciliation issues remain open.",
    metadata: {
      open_issue_count: snapshot.openIssueCount,
      latest_issue_at: snapshot.latestIssueAt,
      evaluated_at: now,
    },
  };
}

async function evaluateConditionByAlertType(
  reader: AdminAlertConditionReader,
  alertType: AdminAlertType,
  now: number,
) {
  switch (alertType) {
    case AdminAlertType.WITHDRAWALS_PENDING_OLDEST:
      return await evaluatePendingWithdrawalsCondition(reader, now);
    case AdminAlertType.WITHDRAWALS_APPROVED_UNPROCESSED_OLDEST:
      return await evaluateApprovedWithdrawalsCondition(reader, now);
    case AdminAlertType.KYC_PENDING_OLDEST:
      return await evaluateKycPendingCondition(reader, now);
    case AdminAlertType.BANK_VERIFICATION_PENDING_OLDEST:
      return await evaluateBankVerificationCondition(reader, now);
    case AdminAlertType.RECONCILIATION_RUN_STALE:
      return await evaluateReconciliationRunStaleCondition(reader, now);
    case AdminAlertType.RECONCILIATION_OPEN_ISSUES:
      return await evaluateReconciliationOpenIssuesCondition(reader, now);
    default:
      throw new DomainError(
        `Unsupported condition alert type: ${alertType}`,
        "unsupported_admin_alert_condition",
      );
  }
}

async function handleNotificationEvent(
  deps: AlertWriteDeps & {
    notificationEventRepository: NotificationEventRepository;
  },
  event: NotificationEventRecord,
  now: number,
) {
  const payload = toMetadataRecord(event.payload);

  switch (event.eventType) {
    case NotificationEventType.RECONCILIATION_RUN_FAILED: {
      await upsertSharedAlertInternal(deps, {
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
        sourceEventId: event.id,
        now,
      });
      break;
    }
    case NotificationEventType.RECONCILIATION_RUN_COMPLETED: {
      const failedAlert = await deps.adminAlertRepository.findByFingerprint(
        AdminAlertType.RECONCILIATION_RUN_FAILED,
      );
      if (failedAlert?.status === AdminAlertStatus.ACTIVE) {
        await resolveAlertInternal(deps.adminAlertRepository, {
          alertId: failedAlert.id,
          now,
          resolutionKind: AdminAlertResolutionKind.AUTOMATIC,
          resolvedBy: buildSystemResolvedBy(SystemActorType.WORKER),
        });
      }
      break;
    }
    default:
      break;
  }
}

async function sendRemindersInternal(
  deps: AlertWriteDeps,
  now: number,
  limit = 200,
) {
  const alerts = await deps.adminAlertRepository.listDueForReminder(now, limit);

  for (const alert of alerts) {
    const receipts = await deps.adminAlertReceiptRepository.listByAlertId(
      alert.id,
    );

    await Promise.all(
      receipts.map(async (receipt) => {
        if (receipt.deliveryState === AdminAlertReceiptState.ACKNOWLEDGED) {
          return;
        }

        await deps.adminAlertReceiptRepository.update(receipt.id, {
          deliveryState: AdminAlertReceiptState.UNREAD,
          lastNotifiedAt: now,
        });
      }),
    );

    await deps.adminAlertRepository.update(alert.id, {
      nextReminderAt: addDurationMs(now, getReminderIntervalMs(alert.severity)),
      reminderCount: alert.reminderCount + 1,
    });
  }

  return alerts.length;
}

async function reconcileReceiptsForActiveAlertsInternal(
  deps: AlertWriteDeps,
  now: number,
  limit = 500,
) {
  const alerts = await deps.adminAlertRepository.listActive(limit);
  for (const alert of alerts) {
    await fanOutAlertReceiptsInternal(deps, alert.id, now);
  }
  return alerts.length;
}

export function createAppendDomainEventsUseCase(deps: {
  notificationEventRepository: NotificationEventRepository;
  notificationEventScheduler: NotificationEventScheduler;
}) {
  return async function appendDomainEvents(events: DomainEvent[]) {
    const eventIds: string[] = [];

    for (const event of events) {
      const existing = await deps.notificationEventRepository.findByDedupeKey(
        event.dedupeKey,
      );
      if (existing) {
        eventIds.push(existing.id);
        continue;
      }

      const occurredAt = event.occurredAt ?? Date.now();
      const created = await deps.notificationEventRepository.create({
        eventType: event.eventType as NotificationEventType,
        sourceKind: event.sourceKind,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        dedupeKey: event.dedupeKey,
        payload: event.payload,
        occurredAt,
        nextAttemptAt: occurredAt,
      });

      await deps.notificationEventScheduler.scheduleProcessEvent(created.id);
      eventIds.push(created.id);
    }

    return eventIds;
  };
}

export function createUpsertSharedAdminAlertUseCase(deps: AlertWriteDeps) {
  return async function upsertSharedAdminAlert(input: {
    alertType: AdminAlertType;
    severity: AdminAlertSeverity;
    title: string;
    body: string;
    fingerprint: string;
    metadata?: Record<string, unknown>;
    sourceEventId?: string;
    now?: number;
  }) {
    return await upsertSharedAlertInternal(deps, {
      ...input,
      metadata: buildHealthyMetadata(toMetadataRecord(input.metadata), 0),
      now: input.now ?? Date.now(),
    });
  };
}

export function createFanOutAdminAlertReceiptsUseCase(deps: AlertWriteDeps) {
  return async function fanOutAdminAlertReceipts(input: {
    alertId: string;
    now?: number;
  }) {
    await fanOutAlertReceiptsInternal(
      deps,
      input.alertId,
      input.now ?? Date.now(),
    );
  };
}

export function createSendAdminAlertRemindersUseCase(deps: AlertWriteDeps) {
  return async function sendAdminAlertReminders(input?: { now?: number }) {
    return await sendRemindersInternal(deps, input?.now ?? Date.now());
  };
}

export function createReconcileAdminAlertReceiptsUseCase(deps: AlertWriteDeps) {
  return async function reconcileAdminAlertReceipts(input?: { now?: number }) {
    return await reconcileReceiptsForActiveAlertsInternal(
      deps,
      input?.now ?? Date.now(),
    );
  };
}

export function createResolveAdminAlertUseCase(
  deps: AlertWriteDeps & {
    adminAlertConditionReader: AdminAlertConditionReader;
  },
) {
  return async function resolveAdminAlert(input: {
    alertId: string;
    adminUserId: string;
    now?: number;
  }) {
    const now = input.now ?? Date.now();
    const alert = await deps.adminAlertRepository.findById(input.alertId);
    if (!alert) {
      throw new DomainError("Alert not found", "admin_alert_not_found");
    }

    if (alert.status === AdminAlertStatus.RESOLVED) {
      return alert;
    }

    if (requiresHealthyConditionForManualResolve(alert.alertType)) {
      const evaluation = await evaluateConditionByAlertType(
        deps.adminAlertConditionReader,
        alert.alertType,
        now,
      );

      if (evaluation.severity !== null) {
        throw new DomainError(
          "This alert cannot be resolved while the underlying condition is still active",
          "admin_alert_condition_still_active",
        );
      }
    }

    const resolved = await resolveAlertInternal(deps.adminAlertRepository, {
      alertId: input.alertId,
      now,
      resolutionKind: AdminAlertResolutionKind.MANUAL,
      resolvedBy: buildAdminResolvedBy(input.adminUserId),
    });

    const receipt =
      await deps.adminAlertReceiptRepository.findByAlertIdAndAdminUserId(
        input.alertId,
        input.adminUserId,
      );
    if (receipt) {
      await deps.adminAlertReceiptRepository.update(receipt.id, {
        deliveryState: AdminAlertReceiptState.ACKNOWLEDGED,
        seenAt: receipt.seenAt ?? now,
        acknowledgedAt: now,
      });
    }

    return resolved;
  };
}

export function createProcessAdminAlertEventUseCase(
  deps: AlertWriteDeps & {
    notificationEventRepository: NotificationEventRepository;
  },
) {
  return async function processAdminAlertEvent(input: {
    eventId: string;
    now?: number;
  }) {
    const event = await deps.notificationEventRepository.findById(
      input.eventId,
    );
    if (!event) {
      throw new DomainError(
        "Notification event not found",
        "notification_event_not_found",
      );
    }

    const now = input.now ?? Date.now();
    const isLeased =
      event.processingStatus === NotificationEventProcessingStatus.PROCESSING &&
      isTimestampAfter(event.nextAttemptAt, now);

    if (
      event.processingStatus === NotificationEventProcessingStatus.PROCESSED
    ) {
      return {
        eventId: input.eventId,
        processingStatus: event.processingStatus,
      };
    }

    if (isLeased) {
      return {
        eventId: input.eventId,
        processingStatus: event.processingStatus,
      };
    }

    const nextAttemptCount = event.attemptCount + 1;
    await deps.notificationEventRepository.update(input.eventId, {
      processingStatus: NotificationEventProcessingStatus.PROCESSING,
      attemptCount: nextAttemptCount,
      nextAttemptAt: addDurationMs(now, PROCESSING_LEASE_MS),
      lastError: undefined,
    });

    try {
      await handleNotificationEvent(deps, event, now);
      const processed = await deps.notificationEventRepository.update(
        input.eventId,
        {
          processingStatus: NotificationEventProcessingStatus.PROCESSED,
          processedAt: Date.now(),
        },
      );

      return {
        eventId: input.eventId,
        processingStatus: processed.processingStatus,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown notification error";
      await deps.notificationEventRepository.update(input.eventId, {
        processingStatus: NotificationEventProcessingStatus.FAILED,
        nextAttemptAt: addDurationMs(
          Date.now(),
          computeNotificationRetryBackoffMs(nextAttemptCount),
        ),
        lastError: message,
      });
      throw error;
    }
  };
}

export function createEvaluateAdminAlertConditionsUseCase(
  deps: AlertWriteDeps & {
    adminAlertConditionReader: AdminAlertConditionReader;
  },
) {
  return async function evaluateAdminAlertConditions(input?: { now?: number }) {
    const now = input?.now ?? Date.now();
    const evaluations = await Promise.all([
      evaluatePendingWithdrawalsCondition(deps.adminAlertConditionReader, now),
      evaluateApprovedWithdrawalsCondition(deps.adminAlertConditionReader, now),
      evaluateKycPendingCondition(deps.adminAlertConditionReader, now),
      evaluateBankVerificationCondition(deps.adminAlertConditionReader, now),
      evaluateReconciliationRunStaleCondition(
        deps.adminAlertConditionReader,
        now,
      ),
      evaluateReconciliationOpenIssuesCondition(
        deps.adminAlertConditionReader,
        now,
      ),
    ]);

    const results = await Promise.all(
      evaluations.map((evaluation) =>
        applyConditionEvaluation(deps, evaluation, now),
      ),
    );

    return {
      changed: results.filter((result) => result.changed).length,
    };
  };
}

export function createSweepAdminAlertOutboxUseCase(
  deps: AlertWriteDeps & {
    notificationEventRepository: NotificationEventRepository;
    notificationEventScheduler: NotificationEventScheduler;
  },
) {
  return async function sweepAdminAlertOutbox(input?: {
    now?: number;
    batchSize?: number;
  }) {
    const now = input?.now ?? Date.now();
    const dueEvents =
      await deps.notificationEventRepository.listDueForProcessing(
        now,
        input?.batchSize ?? DEFAULT_ADMIN_ALERT_BATCH_SIZE,
      );

    const uniqueEventIds = Array.from(
      new Set(dueEvents.map((event) => event.id)),
    );
    await Promise.all(
      uniqueEventIds.map((eventId) =>
        deps.notificationEventScheduler.scheduleProcessEvent(eventId),
      ),
    );

    const reminded = await sendRemindersInternal(deps, now);
    const alertsChecked = await reconcileReceiptsForActiveAlertsInternal(
      deps,
      now,
    );

    return {
      scheduled: uniqueEventIds.length,
      reminded,
      alertsChecked,
    };
  };
}
