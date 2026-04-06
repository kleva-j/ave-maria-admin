import type {
  SetSavingsPlanTemplateActiveStateDTO,
  RecordSavingsPlanContributionDTO,
  CreateSavingsPlanTemplateDTO,
  UpdateSavingsPlanSettingsDTO,
  UpdateSavingsPlanTemplateDTO,
  ChangeSavingsPlanStatusDTO,
  WithdrawalCapabilitiesDTO,
  ReverseTransactionOutput,
  PostTransactionOutput,
  ReverseTransactionDTO,
  ApproveWithdrawalDTO,
  UploadKycDocumentDTO,
  CreateSavingsPlanDTO,
  DeleteKycDocumentDTO,
  RequestWithdrawalDTO,
  ProcessWithdrawalDTO,
  ApplyKycDecisionDTO,
  RejectWithdrawalDTO,
  RunAutomatedKycDTO,
  PostTransactionDTO,
  RiskDecisionDTO,
} from "../dto";

import {
  assertSavingsPlanCanAcceptContribution,
  createSavingsPlanTemplateSnapshot,
  findLatestRejectedDocumentForType,
  determineSavingsPlanClosedStatus,
  assertWithdrawalBalanceAvailable,
  assertUserCanRunKycVerification,
  getDocumentStatusForKycDecision,
  assertPositiveWithdrawalAmount,
  assertWithdrawalCanBeProcessed,
  evaluateWithdrawalRiskDecision,
  assertWithdrawalCanBeApproved,
  assertWithdrawalCanBeRejected,
  assertKycDocumentCanBeDeleted,
  buildWithdrawalCapabilities,
  getUserStatusForKycDecision,
  assertSavingsPlanIsMutable,
  TransactionValidationError,
  assertKycVerificationReady,
  normalizeWithdrawalMethod,
  assertReservationIsActive,
  assertKycRejectionReason,
  InsufficientBalanceError,
  DuplicateReferenceError,
  normalizeOptionalString,
  calculateReservedAmount,
  WithdrawalBlockedError,
  computeProjectionDelta,
  validateDurationDays,
  validateTemplateName,
  validateInterestRate,
  validateTargetKobo,
  VELOCITY_WINDOW_MS,
  assertValidAmount,
  TransactionSource,
  resolvePlanDates,
  RiskHoldScope,
  DomainError,
  TxnType,
  DAY_MS,
} from "@avm-daily/domain";

import type {
  WithdrawalRiskEvaluationInput,
  WithdrawalReservation,
  SavingsPlanTemplate,
  WithdrawalStatus,
  WithdrawalAction,
  WithdrawalMethod,
  UserSavingsPlan,
  KycDocument,
  Transaction,
  Withdrawal,
  AdminRole,
  User,
} from "@avm-daily/domain";

import type {
  WithdrawalReservationRepository,
  SavingsPlanTemplateRepository,
  BankAccountEventRepository,
  TransactionWriteRepository,
  TransactionReadRepository,
  VerifiedBankAccountRecord,
  WithdrawalPayoutService,
  KycVerificationProvider,
  BankAccountRepository,
  SavingsPlanRepository,
  KycDocumentRepository,
  WithdrawalRepository,
  EventOutboxService,
  RiskHoldRepository,
  RiskEventService,
  AuditLogService,
  UserRepository,
} from "../ports";

export type EvaluateWithdrawalRiskInput = {
  userId: string;
  amountKobo: bigint;
  method: WithdrawalMethod;
  now?: number;
};

/**
 * createEvaluateWithdrawalRiskUseCase composes `RiskHoldRepository`,
 * `WithdrawalRepository`, and `BankAccountEventRepository` to produce a
 * withdrawal risk decision from the user's current hold state, recent
 * withdrawal activity, and latest bank-account change timestamp.
 *
 * `BankAccountEventRepository` intentionally replaced the older generic
 * risk-event dependency because bank-account changes are account-level events
 * with their own sourcing and aggregation concerns, while system-wide
 * `RiskEventService` records operational outcomes after a decision is made.
 * Keeping those responsibilities separate prevents this read-path use case from
 * depending on write-side risk event history that is broader than the bank
 * account freshness signal it actually needs.
 *
 * Consumers should pass a valid application `userId`, the requested withdrawal
 * amount, and method. The returned `RiskDecisionDTO` is derived only from those
 * repositories, so callers can rely on the invariant that bank-account-change
 * checks come from `BankAccountEventRepository` rather than generic risk events.
 */
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
      createdAt: input.now,
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
      createdAt: placedAt,
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
      createdAt: releasedAt,
    });

    // Release operations use logChange to capture the active->released transition,
    // whereas placeRiskHold uses auditLogService.log for the initial creation event.
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
    reversal_of_reference: input.reversalOfReference,
    reversal_of_type: input.reversalOfType,
    metadata: input.metadata ?? {},
  };
}

async function appendDomainEvents(
  eventOutboxService: EventOutboxService | undefined,
  events: Array<{
    eventType: string;
    sourceKind: "user" | "admin" | "system";
    resourceType: string;
    resourceId: string;
    dedupeKey: string;
    payload: Record<string, unknown>;
    occurredAt?: number;
  }>,
) {
  if (!eventOutboxService || events.length === 0) {
    return;
  }

  await eventOutboxService.append(events);
}

function buildComparablePayloadFromTx(tx: Transaction) {
  return {
    user_id: tx.user_id,
    user_plan_id: tx.user_plan_id,
    type: tx.type,
    amount_kobo: tx.amount_kobo.toString(),
    reference: tx.reference,
    reversal_of_transaction_id: tx.reversal_of_transaction_id,
    reversal_of_reference: tx.reversal_of_reference,
    reversal_of_type: tx.reversal_of_type,
    metadata: tx.metadata,
  };
}

async function findIdempotentTransaction(
  transactionReadRepository: TransactionReadRepository,
  input: PostTransactionDTO,
) {
  const existing = await transactionReadRepository.findByReference(
    input.reference,
  );

  if (!existing) {
    return null;
  }

  const existingPayload = buildComparablePayloadFromTx(existing);
  const inputPayload = buildComparablePayload(input);

  if (stableStringify(existingPayload) === stableStringify(inputPayload)) {
    return existing;
  }

  throw new DuplicateReferenceError(input.reference);
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
    const existing = await findIdempotentTransaction(
      deps.transactionReadRepository,
      input,
    );
    if (existing) {
      return { transaction: existing, idempotent: true };
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
        ? ((input.metadata?.original_type as string | undefined) ?? input.type)
        : input.type;

    const delta = computeProjectionDelta(
      effectiveType as Parameters<typeof computeProjectionDelta>[0],
      input.amountKobo,
      input.userPlanId,
    );

    const createdAt = input.createdAt ?? Date.now();

    const nextTotalBalance = user.total_balance_kobo + delta.totalBalanceKobo;
    if (nextTotalBalance < 0n) {
      throw new InsufficientBalanceError(
        `Projected total balance would go negative for delta ${delta.totalBalanceKobo.toString()}`,
      );
    }

    const nextSavingsBalance =
      user.savings_balance_kobo + delta.savingsBalanceKobo;
    if (nextSavingsBalance < 0n) {
      throw new InsufficientBalanceError(
        `Projected savings balance would go negative for delta ${delta.savingsBalanceKobo.toString()}`,
      );
    }

    const nextPlanAmount =
      userPlan && delta.planAmountKobo !== 0n
        ? userPlan.current_amount_kobo + delta.planAmountKobo
        : undefined;
    if (userPlan && nextPlanAmount !== undefined && nextPlanAmount < 0n) {
      throw new InsufficientBalanceError(
        `Projected plan amount would go negative for delta ${delta.planAmountKobo.toString()}`,
      );
    }

    // 8. Write transaction
    const newTx = await deps.transactionWriteRepository.create({
      user_id: input.userId,
      user_plan_id: input.userPlanId,
      type: input.type,
      amount_kobo: input.amountKobo,
      reference: input.reference,
      reversal_of_transaction_id: input.reversalOfTransactionId,
      reversal_of_reference: input.reversalOfReference,
      reversal_of_type: input.reversalOfType,
      metadata: input.metadata ?? {},
      created_at: createdAt,
    });

    // 9. Update user balance and savings plan balance concurrently
    const balanceUpdates: Promise<void>[] = [
      deps.userRepository.updateBalance(
        input.userId,
        nextTotalBalance,
        nextSavingsBalance,
        createdAt,
      ),
    ];

    if (userPlan && nextPlanAmount !== undefined) {
      balanceUpdates.push(
        deps.savingsPlanRepository.updateAmount(
          userPlan._id,
          nextPlanAmount,
          createdAt,
        ),
      );
    }

    await Promise.all(balanceUpdates);

    return { transaction: newTx, idempotent: false };
  };
}

export type ReverseTransactionDeps = PostTransactionDeps;

// 7.1: createReverseTransactionUseCase — validates original exists and is not a reversal, then delegates to postTransaction
export function createReverseTransactionUseCase(deps: ReverseTransactionDeps) {
  const postTransaction = createPostTransactionUseCase(deps);

  return async function reverseTransaction(
    input: ReverseTransactionDTO,
  ): Promise<ReverseTransactionOutput> {
    // 1. Look up the original transaction
    const original = await deps.transactionReadRepository.findById(
      input.originalTransactionId,
    );

    if (!original) {
      throw new TransactionValidationError(
        `Original transaction not found: ${input.originalTransactionId}`,
      );
    }

    // 2. Reject reversals of reversals (Property 10, Requirement 10.4)
    if (original.type === TxnType.REVERSAL) {
      throw new TransactionValidationError(
        `Cannot reverse a reversal transaction: ${input.originalTransactionId}`,
      );
    }

    // 3. Delegate to createPostTransactionUseCase with type REVERSAL
    const result = await postTransaction({
      userId: original.user_id,
      userPlanId: original.user_plan_id,
      type: TxnType.REVERSAL,
      amountKobo: -original.amount_kobo,
      reference: input.reference,
      reversalOfTransactionId: original._id,
      reversalOfReference: original.reference,
      reversalOfType: original.type,
      metadata: {
        ...input.metadata,
        original_type: original.type,
        reason: input.reason,
      },
      source: input.source,
      actorId: input.actorId,
      createdAt: input.createdAt,
    });

    return { transaction: result.transaction };
  };
}

function requireUser(user: User | null, userId: string) {
  if (!user) {
    throw new DomainError(`User not found: ${userId}`, "user_not_found");
  }

  return user;
}

function requireSavingsPlan(
  plan: UserSavingsPlan | null,
  planId: string,
): UserSavingsPlan {
  if (!plan) {
    throw new DomainError(
      `Savings plan not found: ${planId}`,
      "savings_plan_not_found",
    );
  }

  return plan;
}

function requireOwnedSavingsPlan(
  plan: UserSavingsPlan,
  userId: string,
): UserSavingsPlan {
  if (plan.user_id !== userId) {
    throw new DomainError(
      "Savings plan does not belong to the user",
      "savings_plan_ownership_mismatch",
    );
  }

  return plan;
}

function requireTemplate(
  template: SavingsPlanTemplate | null,
  templateId: string,
): SavingsPlanTemplate {
  if (!template) {
    throw new DomainError(
      `Savings plan template not found: ${templateId}`,
      "savings_plan_template_not_found",
    );
  }

  return template;
}

function requireWithdrawal(
  withdrawal: Withdrawal | null,
  withdrawalId: string,
): Withdrawal {
  if (!withdrawal) {
    throw new DomainError(
      `Withdrawal not found: ${withdrawalId}`,
      "withdrawal_not_found",
    );
  }

  return withdrawal;
}

function requireWithdrawalReservation(
  reservation: WithdrawalReservation | null,
  reservationId: string,
): WithdrawalReservation {
  if (!reservation) {
    throw new DomainError(
      `Withdrawal reservation not found: ${reservationId}`,
      "withdrawal_reservation_not_found",
    );
  }

  return reservation;
}

function requireKycDocument(
  document: KycDocument | null,
  documentId: string,
): KycDocument {
  if (!document) {
    throw new DomainError(
      `KYC document not found: ${documentId}`,
      "kyc_document_not_found",
    );
  }

  return document;
}

function requireVerifiedBankAccount(
  account: VerifiedBankAccountRecord | null,
): VerifiedBankAccountRecord {
  if (!account) {
    throw new DomainError(
      "Add and verify a bank account before withdrawing",
      "withdrawal_bank_account_missing",
    );
  }

  return account;
}

function ensureActiveUser(user: User): User {
  if (user.status !== "active") {
    throw new DomainError(
      "User must be active to manage savings plans",
      "user_not_active_for_savings_plan",
    );
  }

  return user;
}

function normalizeTemplateCreateInput(input: CreateSavingsPlanTemplateDTO) {
  return {
    name: validateTemplateName(input.name),
    description: normalizeOptionalString(input.description),
    default_target_kobo: validateTargetKobo(
      input.defaultTargetKobo,
      "Default target",
    ),
    duration_days: validateDurationDays(input.durationDays),
    interest_rate: validateInterestRate(input.interestRate),
    automation_type: normalizeOptionalString(input.automationType),
  };
}

function buildCashWithdrawalDetails(
  user: Pick<User, "first_name" | "last_name" | "phone">,
  pickupNote?: string,
) {
  const recipientName = [user.first_name, user.last_name]
    .filter((value): value is string =>
      Boolean(value && value.trim().length > 0),
    )
    .join(" ")
    .trim();

  return {
    recipient_name: recipientName || user.phone,
    recipient_phone: user.phone,
    pickup_note: normalizeOptionalString(pickupNote),
  };
}

function createWorkflowReference(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeRequiredReason(reason: string | undefined, code: string) {
  const normalized = normalizeOptionalString(reason);
  if (!normalized) {
    throw new DomainError("Rejection reason is required", code);
  }

  return normalized;
}

const withdrawalSettlementRetryDelaysMs = [0, 25, 100] as const;

async function retryWithdrawalSettlementUpdate<T>(
  operation: string,
  execute: () => Promise<T>,
): Promise<T> {
  let lastError: unknown;

  for (const [
    attempt,
    delayMs,
  ] of withdrawalSettlementRetryDelaysMs.entries()) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    try {
      return await execute();
    } catch (error) {
      lastError = error;
      console.warn(`[${operation}] attempt ${attempt + 1} failed`, error);
    }
  }

  throw lastError;
}

export function createCreateSavingsPlanTemplateUseCase(deps: {
  savingsPlanTemplateRepository: SavingsPlanTemplateRepository;
  auditLogService: AuditLogService;
}) {
  return async function createSavingsPlanTemplate(
    input: CreateSavingsPlanTemplateDTO & { actorId: string },
  ): Promise<SavingsPlanTemplate> {
    const normalized = normalizeTemplateCreateInput(input);
    const existing = await deps.savingsPlanTemplateRepository.findByName(
      normalized.name,
    );

    if (existing) {
      throw new DomainError(
        "A savings plan template with this name already exists",
        "savings_plan_template_name_taken",
      );
    }

    const created = await deps.savingsPlanTemplateRepository.create({
      ...normalized,
      is_active: true,
      created_at: Date.now(),
    });

    await deps.auditLogService.logChange({
      action: "savings_plan_template.created",
      actorId: input.actorId,
      resourceType: "savings_plan_templates",
      resourceId: created._id,
      before: {},
      after: {
        name: created.name,
        description: created.description ?? null,
        default_target_kobo: created.default_target_kobo.toString(),
        duration_days: created.duration_days,
        interest_rate: created.interest_rate,
        automation_type: created.automation_type ?? null,
        is_active: created.is_active,
      },
      severity: "info",
    });

    return created;
  };
}

export function createUpdateSavingsPlanTemplateUseCase(deps: {
  savingsPlanTemplateRepository: SavingsPlanTemplateRepository;
  auditLogService: AuditLogService;
}) {
  return async function updateSavingsPlanTemplate(
    input: UpdateSavingsPlanTemplateDTO & { actorId: string },
  ): Promise<SavingsPlanTemplate> {
    const existing = requireTemplate(
      await deps.savingsPlanTemplateRepository.findById(input.templateId),
      input.templateId,
    );

    if (
      input.name === undefined &&
      input.description === undefined &&
      input.defaultTargetKobo === undefined &&
      input.durationDays === undefined &&
      input.interestRate === undefined &&
      input.automationType === undefined
    ) {
      throw new DomainError(
        "No template changes provided",
        "savings_plan_template_no_changes",
      );
    }

    const nextValues = normalizeTemplateCreateInput({
      name: input.name ?? existing.name,
      description: input.description ?? existing.description,
      defaultTargetKobo:
        input.defaultTargetKobo ?? existing.default_target_kobo,
      durationDays: input.durationDays ?? existing.duration_days,
      interestRate: input.interestRate ?? existing.interest_rate,
      automationType: input.automationType ?? existing.automation_type,
    });

    if (nextValues.name !== existing.name) {
      const duplicate = await deps.savingsPlanTemplateRepository.findByName(
        nextValues.name,
      );
      if (duplicate && duplicate._id !== existing._id) {
        throw new DomainError(
          "A savings plan template with this name already exists",
          "savings_plan_template_name_taken",
        );
      }
    }

    const updated = await deps.savingsPlanTemplateRepository.update(
      existing._id,
      nextValues,
    );

    await deps.auditLogService.logChange({
      action: "savings_plan_template.updated",
      actorId: input.actorId,
      resourceType: "savings_plan_templates",
      resourceId: updated._id,
      before: {
        name: existing.name,
        description: existing.description ?? null,
        default_target_kobo: existing.default_target_kobo.toString(),
        duration_days: existing.duration_days,
        interest_rate: existing.interest_rate,
        automation_type: existing.automation_type ?? null,
        is_active: existing.is_active,
      },
      after: {
        name: updated.name,
        description: updated.description ?? null,
        default_target_kobo: updated.default_target_kobo.toString(),
        duration_days: updated.duration_days,
        interest_rate: updated.interest_rate,
        automation_type: updated.automation_type ?? null,
        is_active: updated.is_active,
      },
      severity: "info",
    });

    return updated;
  };
}

export function createSetSavingsPlanTemplateActiveStateUseCase(deps: {
  savingsPlanTemplateRepository: SavingsPlanTemplateRepository;
  auditLogService: AuditLogService;
}) {
  return async function setSavingsPlanTemplateActiveState(
    input: SetSavingsPlanTemplateActiveStateDTO,
  ): Promise<SavingsPlanTemplate> {
    const existing = requireTemplate(
      await deps.savingsPlanTemplateRepository.findById(input.templateId),
      input.templateId,
    );

    if (existing.is_active === input.isActive) {
      return existing;
    }

    const updated = await deps.savingsPlanTemplateRepository.update(
      existing._id,
      {
        is_active: input.isActive,
      },
    );

    await deps.auditLogService.logChange({
      action: input.isActive
        ? "savings_plan_template.reactivated"
        : "savings_plan_template.archived",
      actorId: input.actorId,
      resourceType: "savings_plan_templates",
      resourceId: updated._id,
      before: { is_active: existing.is_active },
      after: { is_active: updated.is_active },
      severity: input.isActive ? "info" : "warning",
    });

    return updated;
  };
}

export function createCreateSavingsPlanUseCase(deps: {
  userRepository: UserRepository;
  savingsPlanRepository: SavingsPlanRepository;
  savingsPlanTemplateRepository: SavingsPlanTemplateRepository;
  auditLogService: AuditLogService;
}) {
  return async function createSavingsPlan(
    input: CreateSavingsPlanDTO,
  ): Promise<UserSavingsPlan> {
    const user = ensureActiveUser(
      requireUser(
        await deps.userRepository.findById(input.userId),
        input.userId,
      ),
    );
    const template = requireTemplate(
      await deps.savingsPlanTemplateRepository.findById(input.templateId),
      input.templateId,
    );

    if (!template.is_active) {
      throw new DomainError(
        "Savings plan template is not active",
        "savings_plan_template_inactive",
      );
    }

    const existingPlan =
      await deps.savingsPlanRepository.findByUserIdAndTemplateId(
        user._id,
        template._id,
      );

    if (existingPlan) {
      throw new DomainError(
        "A savings plan for this template already exists",
        "savings_plan_already_exists",
      );
    }

    const targetKobo = validateTargetKobo(
      input.customTargetKobo ?? template.default_target_kobo,
      "Savings plan target",
    );
    const { startDate, endDate } = resolvePlanDates({
      durationDays: template.duration_days,
      startDate: input.startDate,
      endDate: input.endDate,
      today: input.today,
    });
    const now = Date.now();

    const created = await deps.savingsPlanRepository.create({
      user_id: user._id,
      template_id: template._id,
      custom_target_kobo: targetKobo,
      current_amount_kobo: 0n,
      start_date: startDate,
      end_date: endDate,
      status: "active",
      automation_enabled: false,
      metadata: {
        template_snapshot: createSavingsPlanTemplateSnapshot(template),
      },
      created_at: now,
      updated_at: now,
    });

    await deps.auditLogService.logChange({
      action: "savings_plan.created",
      actorId: user._id,
      resourceType: "user_savings_plans",
      resourceId: created._id,
      before: {},
      after: {
        template_id: created.template_id,
        custom_target_kobo: created.custom_target_kobo.toString(),
        start_date: created.start_date,
        end_date: created.end_date,
        status: created.status,
      },
      severity: "info",
    });

    return created;
  };
}

export function createPauseSavingsPlanUseCase(deps: {
  userRepository: UserRepository;
  savingsPlanRepository: SavingsPlanRepository;
  auditLogService: AuditLogService;
}) {
  return async function pauseSavingsPlan(
    input: ChangeSavingsPlanStatusDTO,
  ): Promise<UserSavingsPlan> {
    ensureActiveUser(
      requireUser(
        await deps.userRepository.findById(input.userId),
        input.userId,
      ),
    );
    const plan = requireOwnedSavingsPlan(
      requireSavingsPlan(
        await deps.savingsPlanRepository.findById(input.planId),
        input.planId,
      ),
      input.userId,
    );

    if (plan.status !== "active") {
      throw new DomainError(
        "Only active savings plans can be paused",
        "savings_plan_pause_invalid_status",
      );
    }

    const updated = await deps.savingsPlanRepository.update(plan._id, {
      status: "paused",
      updated_at: Date.now(),
    });

    await deps.auditLogService.logChange({
      action: "savings_plan.paused",
      actorId: input.userId,
      resourceType: "user_savings_plans",
      resourceId: updated._id,
      before: { status: plan.status },
      after: { status: updated.status },
      severity: "info",
    });

    return updated;
  };
}

export function createResumeSavingsPlanUseCase(deps: {
  userRepository: UserRepository;
  savingsPlanRepository: SavingsPlanRepository;
  auditLogService: AuditLogService;
}) {
  return async function resumeSavingsPlan(
    input: ChangeSavingsPlanStatusDTO,
  ): Promise<UserSavingsPlan> {
    ensureActiveUser(
      requireUser(
        await deps.userRepository.findById(input.userId),
        input.userId,
      ),
    );
    const plan = requireOwnedSavingsPlan(
      requireSavingsPlan(
        await deps.savingsPlanRepository.findById(input.planId),
        input.planId,
      ),
      input.userId,
    );

    if (plan.status !== "paused") {
      throw new DomainError(
        "Only paused savings plans can be resumed",
        "savings_plan_resume_invalid_status",
      );
    }

    const updated = await deps.savingsPlanRepository.update(plan._id, {
      status: "active",
      updated_at: Date.now(),
    });

    await deps.auditLogService.logChange({
      action: "savings_plan.resumed",
      actorId: input.userId,
      resourceType: "user_savings_plans",
      resourceId: updated._id,
      before: { status: plan.status },
      after: { status: updated.status },
      severity: "info",
    });

    return updated;
  };
}

export function createUpdateSavingsPlanSettingsUseCase(deps: {
  userRepository: UserRepository;
  savingsPlanRepository: SavingsPlanRepository;
  auditLogService: AuditLogService;
}) {
  return async function updateSavingsPlanSettings(
    input: UpdateSavingsPlanSettingsDTO,
  ): Promise<UserSavingsPlan> {
    ensureActiveUser(
      requireUser(
        await deps.userRepository.findById(input.userId),
        input.userId,
      ),
    );
    const plan = requireOwnedSavingsPlan(
      requireSavingsPlan(
        await deps.savingsPlanRepository.findById(input.planId),
        input.planId,
      ),
      input.userId,
    );
    assertSavingsPlanIsMutable(plan);

    if (input.customTargetKobo === undefined && input.endDate === undefined) {
      throw new DomainError(
        "No savings plan changes provided",
        "savings_plan_no_changes",
      );
    }

    const nextTargetKobo =
      input.customTargetKobo === undefined
        ? plan.custom_target_kobo
        : validateTargetKobo(input.customTargetKobo, "Savings plan target");

    if (nextTargetKobo < plan.current_amount_kobo) {
      throw new DomainError(
        "Savings plan target cannot be below the current saved amount",
        "savings_plan_target_below_current_amount",
      );
    }

    const nextEndDate = input.endDate ?? plan.end_date;
    const { endDate } = resolvePlanDates({
      durationDays: 1,
      startDate: plan.start_date,
      endDate: nextEndDate,
      today: plan.start_date,
    });

    const updated = await deps.savingsPlanRepository.update(plan._id, {
      custom_target_kobo: nextTargetKobo,
      end_date: endDate,
      updated_at: Date.now(),
    });

    await deps.auditLogService.logChange({
      action: "savings_plan.updated",
      actorId: input.userId,
      resourceType: "user_savings_plans",
      resourceId: updated._id,
      before: {
        custom_target_kobo: plan.custom_target_kobo.toString(),
        end_date: plan.end_date,
      },
      after: {
        custom_target_kobo: updated.custom_target_kobo.toString(),
        end_date: updated.end_date,
      },
      severity: "info",
    });

    return updated;
  };
}

export function createCloseSavingsPlanUseCase(deps: {
  userRepository: UserRepository;
  savingsPlanRepository: SavingsPlanRepository;
  auditLogService: AuditLogService;
}) {
  return async function closeSavingsPlan(
    input: ChangeSavingsPlanStatusDTO,
  ): Promise<UserSavingsPlan> {
    ensureActiveUser(
      requireUser(
        await deps.userRepository.findById(input.userId),
        input.userId,
      ),
    );
    const plan = requireOwnedSavingsPlan(
      requireSavingsPlan(
        await deps.savingsPlanRepository.findById(input.planId),
        input.planId,
      ),
      input.userId,
    );
    assertSavingsPlanIsMutable(plan);

    const nextStatus = determineSavingsPlanClosedStatus(plan);
    const updated = await deps.savingsPlanRepository.update(plan._id, {
      status: nextStatus,
      updated_at: Date.now(),
    });

    await deps.auditLogService.logChange({
      action: "savings_plan.closed",
      actorId: input.userId,
      resourceType: "user_savings_plans",
      resourceId: updated._id,
      before: { status: plan.status },
      after: { status: updated.status },
      severity: nextStatus === "completed" ? "info" : "warning",
    });

    return updated;
  };
}

export function createRecordSavingsPlanContributionUseCase(deps: {
  savingsPlanRepository: SavingsPlanRepository;
  transactionReadRepository: TransactionReadRepository;
  postTransaction: (
    input: PostTransactionDTO,
  ) => Promise<PostTransactionOutput>;
}) {
  return async function recordSavingsPlanContribution(
    input: RecordSavingsPlanContributionDTO,
  ): Promise<PostTransactionOutput> {
    validateTargetKobo(input.amountKobo, "Contribution amount");

    const plan = requireOwnedSavingsPlan(
      requireSavingsPlan(
        await deps.savingsPlanRepository.findById(input.planId),
        input.planId,
      ),
      input.userId,
    );
    const transactionInput: PostTransactionDTO = {
      userId: input.userId,
      userPlanId: plan._id,
      type: TxnType.CONTRIBUTION,
      amountKobo: input.amountKobo,
      reference: input.reference,
      metadata: input.metadata,
      source: input.source,
      actorId: input.actorId,
    };

    const existing = await findIdempotentTransaction(
      deps.transactionReadRepository,
      transactionInput,
    );

    if (existing) {
      return { transaction: existing, idempotent: true };
    }

    assertSavingsPlanCanAcceptContribution(plan);

    return await deps.postTransaction(transactionInput);
  };
}

type AssertWithdrawalAllowedHandler = (
  input: EvaluateWithdrawalRiskInput & { actorAdminId?: string },
) => Promise<void>;

type AssertWithdrawalAdminActionAllowedHandler = (input: {
  userId: string;
  adminId: string;
  adminRole: AdminRole;
  action: WithdrawalAction;
  withdrawal: Withdrawal;
}) => Promise<void>;

export function createRequestWithdrawalUseCase(deps: {
  userRepository: UserRepository;
  withdrawalRepository: WithdrawalRepository;
  withdrawalReservationRepository: WithdrawalReservationRepository;
  bankAccountRepository: BankAccountRepository;
  auditLogService: AuditLogService;
  eventOutboxService?: EventOutboxService;
  assertWithdrawalAllowed: AssertWithdrawalAllowedHandler;
}) {
  return async function requestWithdrawal(
    input: RequestWithdrawalDTO,
  ): Promise<{
    withdrawal: Withdrawal;
    reservation: WithdrawalReservation;
  }> {
    const user = requireUser(
      await deps.userRepository.findById(input.userId),
      input.userId,
    );

    if (user.status !== "active") {
      throw new DomainError(
        "Only active users can request withdrawals",
        "user_not_active_for_withdrawal",
      );
    }

    const method = normalizeWithdrawalMethod(input.method);
    assertPositiveWithdrawalAmount(input.amountKobo);

    if (method === "cash" && input.bankAccountId) {
      throw new DomainError(
        "Cash withdrawals do not require a bank account",
        "withdrawal_bank_account_not_allowed",
      );
    }

    const reservations =
      await deps.withdrawalReservationRepository.findByUserId(user._id);
    const reservedAmountKobo = calculateReservedAmount(reservations);
    assertWithdrawalBalanceAvailable({
      totalBalanceKobo: user.total_balance_kobo,
      savingsBalanceKobo: user.savings_balance_kobo,
      reservedAmountKobo,
      requestedAmountKobo: input.amountKobo,
    });

    await deps.assertWithdrawalAllowed({
      userId: user._id,
      amountKobo: input.amountKobo,
      method,
      now: Date.now(),
    });

    let bankAccountDetails: VerifiedBankAccountRecord | undefined;
    let cashDetails:
      | {
          recipient_name: string;
          recipient_phone: string;
          pickup_note?: string;
        }
      | undefined;

    if (method === "bank_transfer") {
      const bankAccount = input.bankAccountId
        ? await deps.bankAccountRepository.findVerifiedByIdForUser(
            user._id,
            input.bankAccountId,
          )
        : await deps.bankAccountRepository.findPrimaryVerifiedForUser(user._id);

      bankAccountDetails = requireVerifiedBankAccount(bankAccount);
    } else {
      cashDetails = buildCashWithdrawalDetails(user, input.pickupNote);
    }

    const reference =
      normalizeOptionalString(input.reference) ??
      createWorkflowReference(method === "cash" ? "cwdr" : "wdr");

    const existing = await deps.withdrawalRepository.findByReference(reference);
    if (existing) {
      throw new DomainError(
        "Withdrawal reference already exists",
        "withdrawal_reference_taken",
      );
    }

    const now = Date.now();
    const createdWithdrawal = await deps.withdrawalRepository.create({
      reference,
      requested_by: user._id,
      requested_amount_kobo: input.amountKobo,
      method,
      status: "pending",
      requested_at: now,
      bank_account_details: bankAccountDetails,
      cash_details: cashDetails,
    });

    const reservation = await deps.withdrawalReservationRepository.create({
      withdrawal_id: createdWithdrawal._id,
      user_id: user._id,
      amount_kobo: input.amountKobo,
      reference: `wres_${reference}`,
      status: "active",
      created_at: now,
    });

    const withdrawal = await deps.withdrawalRepository.update(
      createdWithdrawal._id,
      {
        reservation_id: reservation._id,
      },
    );

    await deps.auditLogService.log({
      action: "withdrawal.requested",
      actorId: user._id,
      resourceType: "withdrawals",
      resourceId: withdrawal._id,
      severity: "info",
      metadata: {
        reference,
        method,
        amount_kobo: input.amountKobo.toString(),
        reservation_id: reservation._id,
      },
    });

    await appendDomainEvents(deps.eventOutboxService, [
      {
        eventType: "withdrawal_requested",
        sourceKind: "user",
        resourceType: "withdrawals",
        resourceId: withdrawal._id,
        dedupeKey: `withdrawal_requested:${withdrawal._id}`,
        occurredAt: now,
        payload: {
          user_id: user._id,
          withdrawal_id: withdrawal._id,
          reservation_id: reservation._id,
          reference,
          method,
          amount_kobo: input.amountKobo.toString(),
          status: withdrawal.status,
          requested_at: now,
        },
      },
    ]);

    return { withdrawal, reservation };
  };
}

export function createApproveWithdrawalUseCase(deps: {
  withdrawalRepository: WithdrawalRepository;
  auditLogService: AuditLogService;
  eventOutboxService?: EventOutboxService;
  assertAdminActionAllowed: AssertWithdrawalAdminActionAllowedHandler;
}) {
  return async function approveWithdrawal(
    input: ApproveWithdrawalDTO,
  ): Promise<Withdrawal> {
    const withdrawal = requireWithdrawal(
      await deps.withdrawalRepository.findById(input.withdrawalId),
      input.withdrawalId,
    );

    assertWithdrawalCanBeApproved(withdrawal.status);
    await deps.assertAdminActionAllowed({
      userId: withdrawal.requested_by,
      adminId: input.adminId,
      adminRole: input.adminRole,
      action: "approve",
      withdrawal,
    });

    const updated = await deps.withdrawalRepository.update(withdrawal._id, {
      status: "approved",
      approved_by: input.adminId,
      approved_at: Date.now(),
      rejection_reason: undefined,
      last_processing_error: undefined,
    });

    await deps.auditLogService.logChange({
      action: "withdrawal.approved",
      actorId: input.adminId,
      resourceType: "withdrawals",
      resourceId: updated._id,
      before: {
        status: withdrawal.status,
        approved_by: withdrawal.approved_by,
        approved_at: withdrawal.approved_at,
      },
      after: {
        status: updated.status,
        approved_by: updated.approved_by,
        approved_at: updated.approved_at,
      },
      severity: "info",
    });

    await appendDomainEvents(deps.eventOutboxService, [
      {
        eventType: "withdrawal_approved",
        sourceKind: "admin",
        resourceType: "withdrawals",
        resourceId: updated._id,
        dedupeKey: `withdrawal_approved:${updated._id}:${updated.approved_at ?? "none"}`,
        occurredAt: updated.approved_at,
        payload: {
          withdrawal_id: updated._id,
          user_id: updated.requested_by,
          approved_by: updated.approved_by,
          approved_at: updated.approved_at,
          status: updated.status,
        },
      },
    ]);

    return updated;
  };
}

export function createRejectWithdrawalUseCase(deps: {
  withdrawalRepository: WithdrawalRepository;
  withdrawalReservationRepository: WithdrawalReservationRepository;
  auditLogService: AuditLogService;
  eventOutboxService?: EventOutboxService;
  assertAdminActionAllowed: AssertWithdrawalAdminActionAllowedHandler;
}) {
  return async function rejectWithdrawal(input: RejectWithdrawalDTO): Promise<{
    withdrawal: Withdrawal;
    reservation: WithdrawalReservation;
  }> {
    const withdrawal = requireWithdrawal(
      await deps.withdrawalRepository.findById(input.withdrawalId),
      input.withdrawalId,
    );

    assertWithdrawalCanBeRejected(withdrawal.status);
    const rejectionReason = normalizeRequiredReason(
      input.reason,
      "withdrawal_rejection_reason_required",
    );

    await deps.assertAdminActionAllowed({
      userId: withdrawal.requested_by,
      adminId: input.adminId,
      adminRole: input.adminRole,
      action: "reject",
      withdrawal,
    });

    const reservation = requireWithdrawalReservation(
      await deps.withdrawalReservationRepository.findById(
        withdrawal.reservation_id ?? "",
      ),
      withdrawal.reservation_id ?? "",
    );
    assertReservationIsActive(reservation);

    const now = Date.now();
    const releasedReservation =
      await deps.withdrawalReservationRepository.update(reservation._id, {
        status: "released",
        released_at: now,
      });

    const updated = await deps.withdrawalRepository.update(withdrawal._id, {
      status: "rejected",
      rejection_reason: rejectionReason,
      last_processing_error: undefined,
    });

    await deps.auditLogService.logChange({
      action: "withdrawal.rejected",
      actorId: input.adminId,
      resourceType: "withdrawals",
      resourceId: updated._id,
      before: {
        status: withdrawal.status,
        rejection_reason: withdrawal.rejection_reason,
      },
      after: {
        status: updated.status,
        rejection_reason: updated.rejection_reason,
        reservation_status: releasedReservation.status,
      },
      severity: "warning",
    });

    await appendDomainEvents(deps.eventOutboxService, [
      {
        eventType: "withdrawal_rejected",
        sourceKind: "admin",
        resourceType: "withdrawals",
        resourceId: updated._id,
        dedupeKey: `withdrawal_rejected:${updated._id}:${releasedReservation._id}`,
        occurredAt: now,
        payload: {
          withdrawal_id: updated._id,
          user_id: updated.requested_by,
          reservation_id: releasedReservation._id,
          rejected_by: input.adminId,
          rejection_reason: rejectionReason,
          status: updated.status,
        },
      },
    ]);

    return { withdrawal: updated, reservation: releasedReservation };
  };
}

export function createProcessWithdrawalUseCase(deps: {
  withdrawalRepository: WithdrawalRepository;
  withdrawalReservationRepository: WithdrawalReservationRepository;
  payoutService: WithdrawalPayoutService;
  postTransaction: (
    input: PostTransactionDTO,
  ) => Promise<PostTransactionOutput>;
  auditLogService: AuditLogService;
  eventOutboxService?: EventOutboxService;
  assertAdminActionAllowed: AssertWithdrawalAdminActionAllowedHandler;
}) {
  return async function processWithdrawal(
    input: ProcessWithdrawalDTO,
  ): Promise<{
    withdrawal: Withdrawal;
    reservation: WithdrawalReservation;
    transaction: Transaction;
  }> {
    const withdrawal = requireWithdrawal(
      await deps.withdrawalRepository.findById(input.withdrawalId),
      input.withdrawalId,
    );

    assertWithdrawalCanBeProcessed(withdrawal.status);
    await deps.assertAdminActionAllowed({
      userId: withdrawal.requested_by,
      adminId: input.adminId,
      adminRole: input.adminRole,
      action: "process",
      withdrawal,
    });

    const reservation = requireWithdrawalReservation(
      await deps.withdrawalReservationRepository.findById(
        withdrawal.reservation_id ?? "",
      ),
      withdrawal.reservation_id ?? "",
    );
    assertReservationIsActive(reservation);

    let payoutResult:
      | {
          provider: string;
          reference: string;
          metadata?: Record<string, unknown>;
        }
      | undefined;

    try {
      payoutResult = await deps.payoutService.execute({
        withdrawalId: withdrawal._id,
        userId: withdrawal.requested_by,
        method: withdrawal.method,
        amountKobo: withdrawal.requested_amount_kobo,
        reference: withdrawal.reference,
        bankAccountDetails: withdrawal.bank_account_details,
        cashDetails: withdrawal.cash_details,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Withdrawal payout failed";

      const failed = await deps.withdrawalRepository.update(withdrawal._id, {
        last_processing_error: message,
      });

      await deps.auditLogService.logChange({
        action: "withdrawal.processing_failed",
        actorId: input.adminId,
        resourceType: "withdrawals",
        resourceId: failed._id,
        before: {
          status: withdrawal.status,
          last_processing_error: withdrawal.last_processing_error,
        },
        after: {
          status: failed.status,
          last_processing_error: failed.last_processing_error,
        },
        severity: "warning",
      });

      await appendDomainEvents(deps.eventOutboxService, [
        {
          eventType: "withdrawal_processing_failed",
          sourceKind: "admin",
          resourceType: "withdrawals",
          resourceId: failed._id,
          dedupeKey: `withdrawal_processing_failed:${failed._id}:${message}`,
          occurredAt: Date.now(),
          payload: {
            withdrawal_id: failed._id,
            user_id: failed.requested_by,
            attempted_by: input.adminId,
            error: message,
            status: failed.status,
          },
        },
      ]);

      throw error;
    }

    const transactionResult = await retryWithdrawalSettlementUpdate(
      "withdrawal.process.postTransaction",
      async () =>
        await deps.postTransaction({
          userId: withdrawal.requested_by,
          type: TxnType.WITHDRAWAL,
          amountKobo: -withdrawal.requested_amount_kobo,
          reference: withdrawal.reference,
          metadata: {
            source: TransactionSource.ADMIN,
            actor_id: input.adminId,
            withdrawal_status: "processed",
            method: withdrawal.method,
            bank_account: withdrawal.bank_account_details,
            cash_details: withdrawal.cash_details,
            payout_provider: payoutResult.provider,
            payout_reference: payoutResult.reference,
            ...(payoutResult.metadata ?? {}),
          },
          source: TransactionSource.ADMIN,
          actorId: input.adminId,
        }),
    );

    const now = Date.now();
    const updatedWithdrawal = await retryWithdrawalSettlementUpdate(
      "withdrawal.process.updateWithdrawal",
      async () =>
        await deps.withdrawalRepository.update(withdrawal._id, {
          status: "processed",
          transaction_id: transactionResult.transaction._id,
          processed_by: input.adminId,
          processed_at: now,
          payout_provider: payoutResult.provider,
          payout_reference: payoutResult.reference,
          last_processing_error: undefined,
        }),
    );

    const consumedReservation = await retryWithdrawalSettlementUpdate(
      "withdrawal.process.consumeReservation",
      async () =>
        await deps.withdrawalReservationRepository.update(reservation._id, {
          status: "consumed",
          consumed_at: now,
        }),
    );

    await deps.auditLogService.logChange({
      action: "withdrawal.processed",
      actorId: input.adminId,
      resourceType: "withdrawals",
      resourceId: updatedWithdrawal._id,
      before: {
        status: withdrawal.status,
        transaction_id: withdrawal.transaction_id,
      },
      after: {
        status: updatedWithdrawal.status,
        transaction_id: updatedWithdrawal.transaction_id,
        payout_provider: updatedWithdrawal.payout_provider,
        payout_reference: updatedWithdrawal.payout_reference,
      },
      severity: "info",
    });

    await appendDomainEvents(deps.eventOutboxService, [
      {
        eventType: "withdrawal_processed",
        sourceKind: "admin",
        resourceType: "withdrawals",
        resourceId: updatedWithdrawal._id,
        dedupeKey: `withdrawal_processed:${updatedWithdrawal._id}:${transactionResult.transaction._id}`,
        occurredAt: now,
        payload: {
          withdrawal_id: updatedWithdrawal._id,
          user_id: updatedWithdrawal.requested_by,
          reservation_id: consumedReservation._id,
          transaction_id: transactionResult.transaction._id,
          processed_by: input.adminId,
          processed_at: updatedWithdrawal.processed_at,
          payout_provider: updatedWithdrawal.payout_provider,
          payout_reference: updatedWithdrawal.payout_reference,
          status: updatedWithdrawal.status,
        },
      },
    ]);

    return {
      withdrawal: updatedWithdrawal,
      reservation: consumedReservation,
      transaction: transactionResult.transaction,
    };
  };
}

export function createUploadKycDocumentUseCase(deps: {
  userRepository: UserRepository;
  kycDocumentRepository: KycDocumentRepository;
  auditLogService: AuditLogService;
}) {
  return async function uploadKycDocument(
    input: UploadKycDocumentDTO,
  ): Promise<KycDocument> {
    const user = requireUser(
      await deps.userRepository.findById(input.userId),
      input.userId,
    );
    assertUserCanRunKycVerification(user.status);

    const documents = await deps.kycDocumentRepository.findByUserId(user._id);
    const duplicatePending = documents.find(
      (document) =>
        document.document_type === input.documentType &&
        document.status === "pending",
    );
    if (duplicatePending) {
      throw new DomainError(
        `A pending ${input.documentType} document already exists`,
        "kyc_pending_document_already_exists",
      );
    }

    const superseded = findLatestRejectedDocumentForType(
      documents,
      input.documentType,
    );
    const now = Date.now();
    const created = await deps.kycDocumentRepository.create({
      user_id: user._id,
      document_type: input.documentType,
      file_url: normalizeOptionalString(input.fileUrl),
      storage_id: input.storageId,
      file_name: normalizeOptionalString(input.fileName),
      file_size: input.fileSize,
      mime_type: normalizeOptionalString(input.mimeType),
      uploaded_at: now,
      status: "pending",
      supersedes_document_id: superseded?._id,
      created_at: now,
    });

    await deps.auditLogService.log({
      action: "kyc.document_uploaded",
      actorId: user._id,
      resourceType: "kyc_documents",
      resourceId: created._id,
      severity: "info",
      metadata: {
        document_type: created.document_type,
        storage_id: created.storage_id,
        supersedes_document_id: created.supersedes_document_id,
      },
    });

    return created;
  };
}

export function createDeleteKycDocumentUseCase(deps: {
  userRepository: UserRepository;
  kycDocumentRepository: KycDocumentRepository;
  auditLogService: AuditLogService;
}) {
  return async function deleteKycDocument(
    input: DeleteKycDocumentDTO,
  ): Promise<KycDocument> {
    requireUser(await deps.userRepository.findById(input.userId), input.userId);
    const document = requireKycDocument(
      await deps.kycDocumentRepository.findById(input.documentId),
      input.documentId,
    );

    if (document.user_id !== input.userId) {
      throw new DomainError(
        "Not authorized to delete this document",
        "kyc_document_ownership_mismatch",
      );
    }

    assertKycDocumentCanBeDeleted(document.status);
    await deps.kycDocumentRepository.delete(document._id);

    await deps.auditLogService.log({
      action: "kyc.document_deleted",
      actorId: input.userId,
      resourceType: "kyc_documents",
      resourceId: document._id,
      severity: "warning",
      metadata: {
        document_type: document.document_type,
        previous_status: document.status,
      },
    });

    return document;
  };
}

export function createRunAutomatedKycUseCase(deps: {
  userRepository: UserRepository;
  kycDocumentRepository: KycDocumentRepository;
  kycVerificationProvider: KycVerificationProvider;
}) {
  return async function runAutomatedKyc(input: RunAutomatedKycDTO): Promise<{
    approved: boolean;
    reason: string;
    providerReference?: string;
    metadata?: Record<string, unknown>;
    documents: KycDocument[];
  }> {
    const user = requireUser(
      await deps.userRepository.findById(input.userId),
      input.userId,
    );
    assertUserCanRunKycVerification(user.status);

    const documents = await deps.kycDocumentRepository.findByUserIdAndStatus(
      user._id,
      "pending",
    );
    assertKycVerificationReady(documents);

    const result = await deps.kycVerificationProvider.verify({
      userId: user._id,
      documentTypes: documents.map((document) => document.document_type),
    });

    return {
      approved: result.approved,
      reason: result.reason,
      providerReference: result.providerReference,
      metadata: result.metadata,
      documents,
    };
  };
}

export function createApplyKycDecisionUseCase(deps: {
  userRepository: UserRepository;
  kycDocumentRepository: KycDocumentRepository;
  auditLogService: AuditLogService;
  eventOutboxService?: EventOutboxService;
}) {
  return async function applyKycDecision(input: ApplyKycDecisionDTO): Promise<{
    userId: string;
    newStatus: User["status"];
    documentsReviewed: number;
  }> {
    const user = requireUser(
      await deps.userRepository.findById(input.userId),
      input.userId,
    );
    assertUserCanRunKycVerification(user.status);

    const pendingDocuments =
      await deps.kycDocumentRepository.findByUserIdAndStatus(
        user._id,
        "pending",
      );
    assertKycVerificationReady(pendingDocuments);

    const rejectionReason = input.approved
      ? undefined
      : assertKycRejectionReason(input.reason);
    const nextStatus = getUserStatusForKycDecision(input.approved);
    const nextDocumentStatus = getDocumentStatusForKycDecision(input.approved);
    const now = Date.now();

    await deps.userRepository.updateStatus(user._id, nextStatus, now);
    await Promise.all(
      pendingDocuments.map((document) =>
        deps.kycDocumentRepository.update(document._id, {
          status: nextDocumentStatus,
          reviewed_by: input.reviewedBy,
          reviewed_at: now,
          rejection_reason: rejectionReason,
        }),
      ),
    );

    await deps.auditLogService.logChange({
      action: "kyc.decision_applied",
      actorId: input.reviewedBy,
      resourceType: "users",
      resourceId: user._id,
      before: {
        status: user.status,
      },
      after: {
        status: nextStatus,
        approved: input.approved,
        reason: rejectionReason,
        documents_reviewed: pendingDocuments.length,
        provider_reference: input.providerReference,
        ...(input.metadata ?? {}),
      },
      severity: input.approved ? "info" : "warning",
    });

    await appendDomainEvents(deps.eventOutboxService, [
      {
        eventType: "kyc_decision_applied",
        sourceKind: input.reviewedBy ? "admin" : "system",
        resourceType: "users",
        resourceId: user._id,
        dedupeKey: `kyc_decision_applied:${user._id}:${nextDocumentStatus}:${pendingDocuments
          .map((document) => document._id)
          .sort()
          .join(",")}`,
        occurredAt: now,
        payload: {
          user_id: user._id,
          approved: input.approved,
          new_status: nextStatus,
          document_status: nextDocumentStatus,
          documents_reviewed: pendingDocuments.length,
          document_ids: pendingDocuments.map((document) => document._id),
          reviewed_by: input.reviewedBy,
          reason: rejectionReason,
          provider_reference: input.providerReference,
          ...(input.metadata ?? {}),
        },
      },
    ]);

    return {
      userId: user._id,
      newStatus: nextStatus,
      documentsReviewed: pendingDocuments.length,
    };
  };
}
