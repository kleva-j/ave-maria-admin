import type {
  WithdrawalReservation,
  SavingsPlanTemplate,
  UserSavingsPlan,
  Transaction,
  KycDocument,
  Withdrawal,
  AdminRole,
  User,
} from "@avm-daily/domain";

// --- Transaction Ports (ISP: split read vs write) ---

export interface TransactionReadRepository {
  findByReference(reference: string): Promise<Transaction | null>;
  findById(id: string): Promise<Transaction | null>;
  findByUserId(userId: string): Promise<Transaction[]>;
  findByReversalOfTransactionId(transactionId: string): Promise<Transaction[]>;
}

export interface TransactionWriteRepository {
  create(transaction: Omit<Transaction, "_id">): Promise<Transaction>;
  updateMetadata(id: string, metadata: Record<string, unknown>): Promise<void>;
}

// --- User / Plan Ports ---

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  updateBalance(
    id: string,
    totalBalanceKobo: bigint,
    savingsBalanceKobo: bigint,
    updatedAt: number,
  ): Promise<void>;
  updateStatus(
    id: string,
    status: User["status"],
    updatedAt: number,
  ): Promise<void>;
}

export type SavingsPlanUpdatePatch = Partial<
  Pick<
    UserSavingsPlan,
    | "custom_target_kobo"
    | "end_date"
    | "status"
    | "automation_enabled"
    | "updated_at"
  >
>;

export interface SavingsPlanRepository {
  findById(id: string): Promise<UserSavingsPlan | null>;
  findByUserId(userId: string): Promise<UserSavingsPlan[]>;
  findByUserIdAndTemplateId(
    userId: string,
    templateId: string,
  ): Promise<UserSavingsPlan | null>;
  create(plan: Omit<UserSavingsPlan, "_id">): Promise<UserSavingsPlan>;
  update(id: string, patch: SavingsPlanUpdatePatch): Promise<UserSavingsPlan>;
  updateAmount(
    id: string,
    currentAmountKobo: bigint,
    updatedAt: number,
  ): Promise<void>;
}

export interface SavingsPlanTemplateRepository {
  findById(id: string): Promise<SavingsPlanTemplate | null>;
  findByName(name: string): Promise<SavingsPlanTemplate | null>;
  create(
    template: Omit<SavingsPlanTemplate, "_id">,
  ): Promise<SavingsPlanTemplate>;
  update(
    id: string,
    patch: Partial<Omit<SavingsPlanTemplate, "_id" | "created_at">>,
  ): Promise<SavingsPlanTemplate>;
}

// --- Withdrawal Port ---

export interface WithdrawalRepository {
  findById(id: string): Promise<Withdrawal | null>;
  findByReference(reference: string): Promise<Withdrawal | null>;
  findByUserId(userId: string): Promise<Withdrawal[]>;
  create(withdrawal: Omit<Withdrawal, "_id">): Promise<Withdrawal>;
  update(
    id: string,
    patch: Partial<Omit<Withdrawal, "_id" | "requested_by" | "requested_at">>,
  ): Promise<Withdrawal>;
}

export interface WithdrawalReservationRepository {
  findById(id: string): Promise<WithdrawalReservation | null>;
  findByReference(reference: string): Promise<WithdrawalReservation | null>;
  findByUserId(userId: string): Promise<WithdrawalReservation[]>;
  create(
    reservation: Omit<WithdrawalReservation, "_id">,
  ): Promise<WithdrawalReservation>;
  update(
    id: string,
    patch: Partial<
      Omit<
        WithdrawalReservation,
        "_id" | "user_id" | "withdrawal_id" | "created_at"
      >
    >,
  ): Promise<WithdrawalReservation>;
}

export type VerifiedBankAccountRecord = {
  account_id: string;
  bank_name: string;
  account_name?: string;
  account_number_last4: string;
};

export interface BankAccountRepository {
  findVerifiedByIdForUser(
    userId: string,
    bankAccountId: string,
  ): Promise<VerifiedBankAccountRecord | null>;
  findPrimaryVerifiedForUser(
    userId: string,
  ): Promise<VerifiedBankAccountRecord | null>;
}

export interface KycDocumentRepository {
  findById(id: string): Promise<KycDocument | null>;
  findByUserId(userId: string): Promise<KycDocument[]>;
  findByUserIdAndStatus(
    userId: string,
    status: KycDocument["status"],
  ): Promise<KycDocument[]>;
  create(document: Omit<KycDocument, "_id">): Promise<KycDocument>;
  update(
    id: string,
    patch: Partial<
      Omit<KycDocument, "_id" | "user_id" | "document_type" | "created_at">
    >,
  ): Promise<KycDocument>;
  delete(id: string): Promise<void>;
}

// --- Risk Hold Port ---

export interface RiskHoldRepository {
  findActiveWithdrawalHold(userId: string): Promise<{
    _id: string;
    reason: string;
    placed_at: number;
  } | null>;
  create(hold: {
    user_id: string;
    scope: string;
    status: string;
    reason: string;
    placed_by_admin_id: string;
    placed_at: number;
  }): Promise<{ _id: string }>;
  release(
    id: string,
    releasedByAdminId: string,
    releasedAt: number,
  ): Promise<void>;
}

// --- Risk Event Ports (ISP: bank-account events separated from risk events) ---

export interface RiskEventRepository {
  findLatestByUserId(userId: string): Promise<{
    event_type: string;
    severity: string;
    message: string;
    created_at: number;
  } | null>;
}

/** Separated from RiskEventRepository per ISP — queries a different table. */
export interface BankAccountEventRepository {
  getLastBankAccountChangeAt(userId: string): Promise<number | undefined>;
}

/** Delegate pattern: use-cases record risk events through this service port. */
export interface RiskEventService {
  record(event: {
    userId: string;
    scope: string;
    eventType: string;
    severity: string;
    message: string;
    details?: Record<string, unknown>;
    actorAdminId?: string;
    createdAt?: number;
  }): Promise<{ id: string }>;
}

export interface KycVerificationProvider {
  verify(input: {
    userId: string;
    documentTypes: KycDocument["document_type"][];
  }): Promise<{
    approved: boolean;
    reason: string;
    providerReference?: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface WithdrawalPayoutService {
  execute(input: {
    withdrawalId: string;
    userId: string;
    method: Withdrawal["method"];
    amountKobo: bigint;
    reference: string;
    bankAccountDetails?: Record<string, unknown>;
    cashDetails?: Record<string, unknown>;
  }): Promise<{
    provider: string;
    reference: string;
    metadata?: Record<string, unknown>;
  }>;
}

// --- Audit Log Port ---

export type AuditLogChangeSnapshot = Record<string, unknown>;

export interface AuditLogChangeParams<
  T extends AuditLogChangeSnapshot = AuditLogChangeSnapshot,
> {
  action: string;
  actorId?: string;
  resourceType: string;
  resourceId: string;
  before: T;
  after: T;
  severity: string;
}

export interface AuditLogService {
  log(params: {
    action: string;
    actorId?: string;
    resourceType: string;
    resourceId: string;
    severity: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  logChange<T extends AuditLogChangeSnapshot = AuditLogChangeSnapshot>(
    params: AuditLogChangeParams<T>,
  ): Promise<void>;
}

export type DomainEvent = {
  eventType: NotificationEventType;
  sourceKind: "user" | "admin" | "system";
  resourceType: string;
  resourceId: string;
  dedupeKey: string;
  payload: Record<string, unknown>;
  occurredAt?: number;
};

export interface EventOutboxService {
  append(events: DomainEvent[]): Promise<void>;
}

export const NotificationEventProcessingStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  PROCESSED: "processed",
  FAILED: "failed",
} as const;

export type NotificationEventProcessingStatus =
  (typeof NotificationEventProcessingStatus)[keyof typeof NotificationEventProcessingStatus];

export const NotificationEventType = {
  WITHDRAWAL_REQUESTED: "withdrawal_requested",
  WITHDRAWAL_APPROVED: "withdrawal_approved",
  WITHDRAWAL_REJECTED: "withdrawal_rejected",
  WITHDRAWAL_PROCESSED: "withdrawal_processed",
  WITHDRAWAL_PROCESSING_FAILED: "withdrawal_processing_failed",
  KYC_DECISION_APPLIED: "kyc_decision_applied",
  BANK_VERIFICATION_SUBMITTED: "bank_verification_submitted",
  BANK_VERIFICATION_APPROVED: "bank_verification_approved",
  BANK_VERIFICATION_REJECTED: "bank_verification_rejected",
  RECONCILIATION_RUN_COMPLETED: "reconciliation_run_completed",
  RECONCILIATION_RUN_FAILED: "reconciliation_run_failed",
} as const;

export type NotificationEventType =
  (typeof NotificationEventType)[keyof typeof NotificationEventType];

export const AdminAlertType = {
  WITHDRAWALS_PENDING_OLDEST: "withdrawals_pending_oldest",
  WITHDRAWALS_APPROVED_UNPROCESSED_OLDEST:
    "withdrawals_approved_unprocessed_oldest",
  KYC_PENDING_OLDEST: "kyc_pending_oldest",
  BANK_VERIFICATION_PENDING_OLDEST: "bank_verification_pending_oldest",
  RECONCILIATION_RUN_FAILED: "reconciliation_run_failed",
  RECONCILIATION_RUN_STALE: "reconciliation_run_stale",
  RECONCILIATION_OPEN_ISSUES: "reconciliation_open_issues",
} as const;

export type AdminAlertType =
  (typeof AdminAlertType)[keyof typeof AdminAlertType];

export const AdminAlertScope = {
  WITHDRAWALS: "withdrawals",
  KYC: "kyc",
  BANK_VERIFICATION: "bank_verification",
  RECONCILIATION: "reconciliation",
  SYSTEM: "system",
} as const;

export type AdminAlertScope =
  (typeof AdminAlertScope)[keyof typeof AdminAlertScope];

export const AdminAlertSeverity = {
  WARNING: "warning",
  CRITICAL: "critical",
} as const;

export type AdminAlertSeverity =
  (typeof AdminAlertSeverity)[keyof typeof AdminAlertSeverity];

export const AdminAlertStatus = {
  ACTIVE: "active",
  RESOLVED: "resolved",
} as const;

export type AdminAlertStatus =
  (typeof AdminAlertStatus)[keyof typeof AdminAlertStatus];

export const AdminAlertReceiptState = {
  UNREAD: "unread",
  SEEN: "seen",
  ACKNOWLEDGED: "acknowledged",
} as const;

export type AdminAlertReceiptState =
  (typeof AdminAlertReceiptState)[keyof typeof AdminAlertReceiptState];

export const AdminAlertResolutionKind = {
  AUTOMATIC: "automatic",
  MANUAL: "manual",
} as const;

export type AdminAlertResolutionKind =
  (typeof AdminAlertResolutionKind)[keyof typeof AdminAlertResolutionKind];

export const SystemActorType = {
  CRON: "cron",
  WORKER: "worker",
} as const;

export type SystemActorType =
  (typeof SystemActorType)[keyof typeof SystemActorType];

export type AdminAlertResolvedBy =
  | {
      actorType: "admin";
      adminUserId: string;
    }
  | {
      actorType: "system";
      systemActorType: SystemActorType;
    };

export type NotificationEventRecord = {
  id: string;
  eventType: NotificationEventType;
  sourceKind: DomainEvent["sourceKind"];
  resourceType: string;
  resourceId: string;
  dedupeKey: string;
  payload: Record<string, unknown>;
  occurredAt: number;
  processingStatus: NotificationEventProcessingStatus;
  attemptCount: number;
  nextAttemptAt: number;
  lastError?: string;
  processedAt?: number;
};

export type AdminAlertRecord = {
  id: string;
  alertType: AdminAlertType;
  scope: AdminAlertScope;
  severity: AdminAlertSeverity;
  status: AdminAlertStatus;
  title: string;
  body: string;
  fingerprint: string;
  sourceEventId?: string;
  routingRoles: AdminRole[];
  metadata?: Record<string, unknown>;
  firstOpenedAt: number;
  lastTriggeredAt: number;
  lastEvaluatedAt: number;
  nextReminderAt?: number;
  reminderCount: number;
  resolutionKind?: AdminAlertResolutionKind;
  resolvedAt?: number;
  resolvedBy?: AdminAlertResolvedBy;
};

export type AdminAlertReceiptRecord = {
  id: string;
  alertId: string;
  adminUserId: string;
  deliveryState: AdminAlertReceiptState;
  deliveredAt: number;
  seenAt?: number;
  acknowledgedAt?: number;
  lastNotifiedAt: number;
};

export type AdminAlertInboxFilters = {
  status?: AdminAlertStatus;
  severity?: AdminAlertSeverity;
  scope?: AdminAlertScope;
  limit?: number;
};

export type AdminAlertInboxEntry = {
  alert: AdminAlertRecord;
  receipt: AdminAlertReceiptRecord;
};

export type AdminAlertActiveSummary = {
  activeCount: number;
  criticalCount: number;
  warningCount: number;
  unreadCount: number;
};

export type PendingWithdrawalsAlertSnapshot = {
  pendingCount: number;
  oldestRequestedAt?: number;
};

export type ApprovedWithdrawalsAlertSnapshot = {
  approvedCount: number;
  oldestApprovedAt?: number;
};

export type KycPendingAlertSnapshot = {
  pendingUserCount: number;
  pendingDocumentCount: number;
  oldestPendingDocumentAt?: number;
};

export type BankVerificationPendingAlertSnapshot = {
  pendingAccountCount: number;
  oldestSubmissionAt?: number;
};

export type ReconciliationRunAlertSnapshot = {
  latestCompletedAt?: number;
  latestRunId?: string;
};

export type ReconciliationOpenIssuesAlertSnapshot = {
  openIssueCount: number;
  latestIssueAt?: number;
};

export interface NotificationEventRepository {
  findById(id: string): Promise<NotificationEventRecord | null>;
  findByDedupeKey(dedupeKey: string): Promise<NotificationEventRecord | null>;
  create(
    event: Omit<
      NotificationEventRecord,
      "id" | "processingStatus" | "attemptCount" | "processedAt" | "lastError"
    > & {
      processingStatus?: NotificationEventProcessingStatus;
      attemptCount?: number;
    },
  ): Promise<NotificationEventRecord>;
  update(
    id: string,
    patch: Partial<
      Omit<
        NotificationEventRecord,
        "id" | "eventType" | "sourceKind" | "resourceType" | "resourceId"
      >
    >,
  ): Promise<NotificationEventRecord>;
  listDueForProcessing(
    now: number,
    limit: number,
  ): Promise<NotificationEventRecord[]>;
}

export interface NotificationEventScheduler {
  scheduleProcessEvent(eventId: string): Promise<void>;
}

export interface AdminAlertRepository {
  findById(id: string): Promise<AdminAlertRecord | null>;
  findByFingerprint(fingerprint: string): Promise<AdminAlertRecord | null>;
  create(alert: Omit<AdminAlertRecord, "id">): Promise<AdminAlertRecord>;
  update(
    id: string,
    patch: Partial<
      Omit<
        AdminAlertRecord,
        "id" | "alertType" | "scope" | "fingerprint" | "firstOpenedAt"
      >
    >,
  ): Promise<AdminAlertRecord>;
  listDueForReminder(now: number, limit: number): Promise<AdminAlertRecord[]>;
  listActive(limit: number): Promise<AdminAlertRecord[]>;
}

export interface AdminAlertReceiptRepository {
  findByAlertIdAndAdminUserId(
    alertId: string,
    adminUserId: string,
  ): Promise<AdminAlertReceiptRecord | null>;
  listByAlertId(alertId: string): Promise<AdminAlertReceiptRecord[]>;
  create(
    receipt: Omit<AdminAlertReceiptRecord, "id">,
  ): Promise<AdminAlertReceiptRecord>;
  update(
    id: string,
    patch: Partial<
      Omit<AdminAlertReceiptRecord, "id" | "alertId" | "adminUserId">
    >,
  ): Promise<AdminAlertReceiptRecord>;
}

export interface AdminAlertInboxRepository {
  listByAdminUserId(
    adminUserId: string,
    filters: AdminAlertInboxFilters,
  ): Promise<AdminAlertInboxEntry[]>;
  getUnreadCountByAdminUserId(adminUserId: string): Promise<number>;
  getActiveSummaryByAdminUserId(
    adminUserId: string,
  ): Promise<AdminAlertActiveSummary>;
}

export interface AdminUserDirectory {
  findActiveAdminIdsByRoles(roles: readonly AdminRole[]): Promise<string[]>;
}

export interface AdminAlertConditionReader {
  getPendingWithdrawalsSnapshot(): Promise<PendingWithdrawalsAlertSnapshot>;
  getApprovedWithdrawalsSnapshot(): Promise<ApprovedWithdrawalsAlertSnapshot>;
  getKycPendingSnapshot(): Promise<KycPendingAlertSnapshot>;
  getBankVerificationPendingSnapshot(): Promise<BankVerificationPendingAlertSnapshot>;
  getReconciliationRunSnapshot(): Promise<ReconciliationRunAlertSnapshot>;
  getReconciliationOpenIssuesSnapshot(): Promise<ReconciliationOpenIssuesAlertSnapshot>;
}
