import type {
  WithdrawalCapabilitiesDTO,
  PostTransactionOutput,
  PostTransactionDTO,
  RiskDecisionDTO,
  TransactionDTO,
} from "@/app/dto";

import type {
  WithdrawalRiskEvaluationInput,
  WithdrawalMethod,
  WithdrawalStatus,
  Transaction,
  AdminRole,
} from "@avm-daily/domain";

import type {
  BankAccountEventRepository,
  TransactionWriteRepository,
  TransactionReadRepository,
  SavingsPlanRepository,
  WithdrawalRepository,
  RiskHoldRepository,
  RiskEventService,
  AuditLogService,
  UserRepository,
} from "@/app/ports";

import {
  evaluateWithdrawalRiskDecision,
  buildWithdrawalCapabilities,
  TransactionValidationError,
  DuplicateReferenceError,
  WithdrawalBlockedError,
  computeProjectionDelta,
  VELOCITY_WINDOW_MS,
  assertValidAmount,
  RiskHoldScope,
  DomainError,
  TxnType,
  DAY_MS,
} from "@avm-daily/domain";

export type EvaluateWithdrawalRiskInput = {
  userId: string;
  amountKobo: bigint;
  method: WithdrawalMethod;
  now?: number;
};

// 4.1: replaced riskEventRepository with bankAccountEventRepository; replaced inline constants with domain imports
export function createEvaluateWithdrawalRiskUseCase(deps: {
  riskHoldRepository: RiskHoldRepository;
  withdrawalRepository: WithdrawalRepository;
  bankAccountEventRepository: BankAccountEventRepository;
}) {
  return async function evaluateWithdrawalRisk(
    input: EvaluateWithdrawalRiskInput,
  ): Promise<RiskDecisionDTO> {
    const now = input.now ?? Date.now();

    const [activeHold, lastBankChange, recentWithdrawals] = await Promise.all([
      deps.riskHoldRepository.findActiveWithdrawalHold(input.userId),
      deps.bankAccountEventRepository.getLastBankAccountChangeAt(input.userId),
      deps.withdrawalRepository.findByUserId(input.userId),
    ]);

    const sinceDay = now - DAY_MS;
    const sinceVelocity = now - VELOCITY_WINDOW_MS;

    const recentDaily = recentWithdrawals.filter(
      (w) => w.requested_at >= sinceDay,
    );
    const recentVelocity = recentWithdrawals.filter(
      (w) => w.requested_at >= sinceVelocity,
    );

    const riskInput: WithdrawalRiskEvaluationInput = {
      amountKobo: input.amountKobo,
      method: input.method,
      now,
      lastBankAccountChangeAt: lastBankChange,
      activeHold: activeHold ?? undefined,
      recentDailyAmountKobo: recentDaily.reduce(
        (sum, w) => sum + w.requested_amount_kobo,
        0n,
      ),
      recentDailyCount: recentDaily.length,
      recentVelocityCount: recentVelocity.length,
    };

    const decision = evaluateWithdrawalRiskDecision(riskInput);

    if (!decision.blocked) {
      return { blocked: false };
    }

    return {
      blocked: true,
      rule: decision.rule,
      message: decision.message,
      severity: decision.severity,
      eventType: decision.eventType,
      details: decision.details,
    };
  };
}

// 4.2: replaced riskEventRepository with riskEventService
export function createAssertWithdrawalAllowedUseCase(deps: {
  evaluateWithdrawalRisk: ReturnType<
    typeof createEvaluateWithdrawalRiskUseCase
  >;
  riskEventService: RiskEventService;
}) {
  return async function assertWithdrawalAllowed(
    input: EvaluateWithdrawalRiskInput & { actorAdminId?: string },
  ): Promise<void> {
    const decision = await deps.evaluateWithdrawalRisk(input);

    if (!decision.blocked) {
      return;
    }

    const blockedDecision = decision as {
      blocked: true;
      rule: string;
      message: string;
      eventType: string;
      severity: string;
      details?: Record<string, unknown>;
    };

    await deps.riskEventService.record({
      userId: input.userId,
      scope: RiskHoldScope.WITHDRAWALS,
      eventType: blockedDecision.eventType,
      severity: blockedDecision.severity,
      message: blockedDecision.message,
      details: blockedDecision.details,
      actorAdminId: input.actorAdminId,
    });

    throw new WithdrawalBlockedError(
      blockedDecision.message,
      RiskHoldScope.WITHDRAWALS,
      blockedDecision.rule,
    );
  };
}

export type BuildWithdrawalCapabilitiesInput = {
  withdrawal: {
    status: WithdrawalStatus;
    method: WithdrawalMethod;
  };
  userId: string;
  adminRole: AdminRole;
};

export function createBuildWithdrawalCapabilitiesUseCase(deps: {
  riskHoldRepository: RiskHoldRepository;
}) {
  return async function buildCapabilities(
    input: BuildWithdrawalCapabilitiesInput,
  ): Promise<WithdrawalCapabilitiesDTO> {
    const activeHold = await deps.riskHoldRepository.findActiveWithdrawalHold(
      input.userId,
    );

    const risk = {
      has_active_hold: activeHold !== null,
      block_reason: activeHold?.reason,
    };

    return buildWithdrawalCapabilities(input.adminRole, input.withdrawal, risk);
  };
}

// 4.3: replaced riskEventRepository with riskEventService; throw typed DomainError
export function createPlaceRiskHoldUseCase(deps: {
  riskHoldRepository: RiskHoldRepository;
  riskEventService: RiskEventService;
  auditLogService: AuditLogService;
}) {
  return async function placeRiskHold(input: {
    userId: string;
    reason: string;
    adminId: string;
  }): Promise<{ id: string }> {
    const existing = await deps.riskHoldRepository.findActiveWithdrawalHold(
      input.userId,
    );
    if (existing) {
      throw new DomainError(
        "User already has an active withdrawal hold",
        "hold_already_active",
      );
    }

    const placedAt = Date.now();
    const hold = await deps.riskHoldRepository.create({
      user_id: input.userId,
      scope: RiskHoldScope.WITHDRAWALS,
      status: "active",
      reason: input.reason.trim(),
      placed_by_admin_id: input.adminId,
      placed_at: placedAt,
    });

    await deps.riskEventService.record({
      userId: input.userId,
      scope: RiskHoldScope.WITHDRAWALS,
      eventType: "hold_placed",
      severity: "warning",
      message: `Withdrawal hold placed: ${input.reason.trim()}`,
      details: { hold_id: hold._id },
      actorAdminId: input.adminId,
    });

    await deps.auditLogService.log({
      action: "risk.hold_placed",
      actorId: input.adminId,
      resourceType: "user_risk_hold",
      resourceId: hold._id,
      severity: "warning",
      metadata: {
        user_id: input.userId,
        scope: RiskHoldScope.WITHDRAWALS,
        reason: input.reason.trim(),
      },
    });

    return { id: hold._id };
  };
}

// 4.3: replaced riskEventRepository with riskEventService; use auditLogService.logChange; throw typed DomainError
export function createReleaseRiskHoldUseCase(deps: {
  riskHoldRepository: RiskHoldRepository;
  riskEventService: RiskEventService;
  auditLogService: AuditLogService;
}) {
  return async function releaseRiskHold(input: {
    userId: string;
    adminId: string;
  }): Promise<void> {
    const activeHold = await deps.riskHoldRepository.findActiveWithdrawalHold(
      input.userId,
    );

    if (!activeHold) {
      throw new DomainError(
        "User does not have an active withdrawal hold",
        "hold_not_found",
      );
    }

    const releasedAt = Date.now();
    await deps.riskHoldRepository.release(
      activeHold._id,
      input.adminId,
      releasedAt,
    );

    await deps.riskEventService.record({
      userId: input.userId,
      scope: RiskHoldScope.WITHDRAWALS,
      eventType: "hold_released",
      severity: "info",
      message: "Withdrawal hold released.",
      details: { hold_id: activeHold._id },
      actorAdminId: input.adminId,
    });

    await deps.auditLogService.logChange({
      action: "risk.hold_released",
      actorId: input.adminId,
      resourceType: "user_risk_hold",
      resourceId: activeHold._id,
      before: {
        status: "active",
        reason: activeHold.reason,
        placed_at: activeHold.placed_at,
      },
      after: { status: "released", released_at: releasedAt },
      severity: "info",
    });
  };
}

function transactionToDTO(tx: Transaction): TransactionDTO {
  return {
    id: tx._id,
    userId: tx.user_id,
    userPlanId: tx.user_plan_id,
    type: tx.type as TransactionDTO["type"],
    amountKobo: tx.amount_kobo,
    reference: tx.reference,
    reversalOfTransactionId: tx.reversal_of_transaction_id,
    reversalOfReference: tx.reversal_of_reference,
    reversalOfType: tx.reversal_of_type as TransactionDTO["reversalOfType"],
    metadata: tx.metadata,
    createdAt: tx.created_at,
  };
}

function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeValue);
  }
  if (typeof value === "object" && value !== null) {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalizeValue((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalizeValue(value));
}

function buildComparablePayload(input: PostTransactionDTO) {
  return {
    user_id: input.userId,
    user_plan_id: input.userPlanId,
    type: input.type,
    amount_kobo: input.amountKobo.toString(),
    reference: input.reference,
    reversal_of_transaction_id: input.reversalOfTransactionId,
    metadata: input.metadata ?? {},
  };
}

function buildComparablePayloadFromTx(tx: Transaction) {
  return {
    user_id: tx.user_id,
    user_plan_id: tx.user_plan_id,
    type: tx.type,
    amount_kobo: tx.amount_kobo.toString(),
    reference: tx.reference,
    reversal_of_transaction_id: tx.reversal_of_transaction_id,
    metadata: tx.metadata,
  };
}

export type PostTransactionDeps = {
  transactionReadRepository: TransactionReadRepository;
  transactionWriteRepository: TransactionWriteRepository;
  userRepository: UserRepository;
  savingsPlanRepository: SavingsPlanRepository;
};

// 6.2: createPostTransactionUseCase — idempotency, conflict detection, balance projection
export function createPostTransactionUseCase(deps: PostTransactionDeps) {
  return async function postTransaction(
    input: PostTransactionDTO,
  ): Promise<PostTransactionOutput> {
    // 1. Validate reference is non-empty
    if (!input.reference || input.reference.trim().length === 0) {
      throw new TransactionValidationError("reference is required");
    }

    // 2. Look up existing transaction with same reference
    const existing = await deps.transactionReadRepository.findByReference(
      input.reference,
    );

    if (existing) {
      // 3. If found and payload matches → idempotent return
      const existingPayload = buildComparablePayloadFromTx(existing);
      const inputPayload = buildComparablePayload(input);

      if (stableStringify(existingPayload) === stableStringify(inputPayload)) {
        return { transaction: transactionToDTO(existing), idempotent: true };
      }

      // 4. If found and payload differs → throw DuplicateReferenceError
      throw new DuplicateReferenceError(input.reference);
    }

    // 5. Validate amount sign
    assertValidAmount(input.type, input.amountKobo);

    // 6. Fetch user and savings plan concurrently
    const [user, userPlan] = await Promise.all([
      deps.userRepository.findById(input.userId),
      input.userPlanId
        ? deps.savingsPlanRepository.findById(input.userPlanId)
        : Promise.resolve(undefined),
    ]);

    if (!user) {
      throw new TransactionValidationError("User not found");
    }

    if (input.userPlanId && !userPlan) {
      throw new TransactionValidationError("Savings plan not found");
    }

    // 7. Compute projection delta
    const effectiveType =
      input.type === TxnType.REVERSAL
        ? (input.metadata?.original_type as string | undefined) ?? input.type
        : input.type;

    const delta = computeProjectionDelta(
      effectiveType as Parameters<typeof computeProjectionDelta>[0],
      input.amountKobo,
      input.userPlanId,
    );

    const createdAt = input.createdAt ?? Date.now();

    // 8. Write transaction
    const newTx = await deps.transactionWriteRepository.create({
      user_id: input.userId,
      user_plan_id: input.userPlanId,
      type: input.type,
      amount_kobo: input.amountKobo,
      reference: input.reference,
      reversal_of_transaction_id: input.reversalOfTransactionId,
      reversal_of_reference: undefined,
      reversal_of_type: undefined,
      metadata: input.metadata ?? {},
      created_at: createdAt,
    });

    // 9. Update user balance and savings plan balance concurrently
    const nextTotalBalance = user.total_balance_kobo + delta.totalBalanceKobo;
    const nextSavingsBalance =
      user.savings_balance_kobo + delta.savingsBalanceKobo;

    const balanceUpdates: Promise<void>[] = [
      deps.userRepository.updateBalance(
        input.userId,
        nextTotalBalance,
        nextSavingsBalance,
        createdAt,
      ),
    ];

    if (userPlan && delta.planAmountKobo !== 0n) {
      const nextPlanAmount =
        userPlan.current_amount_kobo + delta.planAmountKobo;
      balanceUpdates.push(
        deps.savingsPlanRepository.updateAmount(
          userPlan._id,
          nextPlanAmount,
          createdAt,
        ),
      );
    }

    await Promise.all(balanceUpdates);

    return { transaction: transactionToDTO(newTx), idempotent: false };
  };
}
