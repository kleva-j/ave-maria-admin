import type { Transaction, User, UserSavingsPlan } from "@avm-daily/domain";

export interface TransactionRepository {
  findByReference(reference: string): Promise<Transaction | null>;
  findById(id: string): Promise<Transaction | null>;
  findByUserId(userId: string): Promise<Transaction[]>;
  findByReversalOfTransactionId(transactionId: string): Promise<Transaction[]>;
  create(transaction: Omit<Transaction, "_id">): Promise<Transaction>;
}

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

export interface RiskEventRepository {
  findLatestByUserId(userId: string): Promise<{
    event_type: string;
    severity: string;
    message: string;
    created_at: number;
  } | null>;
  getLastBankAccountChangeAt(userId: string): Promise<number | undefined>;
  create(event: {
    user_id: string;
    scope: string;
    event_type: string;
    severity: string;
    message: string;
    details?: Record<string, unknown>;
    actor_admin_id?: string;
    created_at: number;
  }): Promise<{ _id: string }>;
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
}
