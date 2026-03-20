import type { WithdrawalCapabilitiesDTO, RiskDecisionDTO } from "@/app/dto";

import type {
  WithdrawalRiskEvaluationInput,
  WithdrawalMethod,
  WithdrawalStatus,
  AdminRole,
} from "@avm-daily/domain";

import type {
  BankAccountEventRepository,
  WithdrawalRepository,
  RiskHoldRepository,
  RiskEventService,
  AuditLogService,
} from "@/app/ports";

import {
  evaluateWithdrawalRiskDecision,
  buildWithdrawalCapabilities,
  WithdrawalBlockedError,
  VELOCITY_WINDOW_MS,
  RiskHoldScope,
  DomainError,
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
