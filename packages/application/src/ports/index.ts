import type {
  WithdrawalReservation,
  SavingsPlanTemplate,
  UserSavingsPlan,
  Transaction,
  KycDocument,
  Withdrawal,
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
  eventType: string;
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
