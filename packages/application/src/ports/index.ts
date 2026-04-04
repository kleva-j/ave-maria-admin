import type { Transaction, User, UserSavingsPlan } from "@avm-daily/domain";

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
}

export interface SavingsPlanRepository {
  findById(id: string): Promise<UserSavingsPlan | null>;
  findByUserId(userId: string): Promise<UserSavingsPlan[]>;
  updateAmount(
    id: string,
    currentAmountKobo: bigint,
    updatedAt: number,
  ): Promise<void>;
}

// --- Withdrawal Port ---

export interface WithdrawalRepository {
  findById(id: string): Promise<{
    _id: string;
    status: string;
    method: string;
  } | null>;
  findByUserId(
    userId: string,
  ): Promise<Array<{ requested_at: number; requested_amount_kobo: bigint }>>;
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
  logChange<
    T extends AuditLogChangeSnapshot = AuditLogChangeSnapshot,
  >(params: AuditLogChangeParams<T>): Promise<void>;
}
