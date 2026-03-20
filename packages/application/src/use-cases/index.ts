import type { WithdrawalCapabilitiesDTO, RiskDecisionDTO } from "@/app/dto";

import type {
  WithdrawalRiskEvaluationInput,
  WithdrawalMethod,
  WithdrawalStatus,
  AdminRole,
} from "@avm-daily/domain";

import type {
  WithdrawalRepository,
  RiskEventRepository,
  RiskHoldRepository,
  AuditLogService,
} from "@/app/ports";

import {
  evaluateWithdrawalRiskDecision,
  buildWithdrawalCapabilities,
  WithdrawalBlockedError,
  RiskHoldScope,
} from "@avm-daily/domain";

export type EvaluateWithdrawalRiskInput = {
  userId: string;
  amountKobo: bigint;
  method: WithdrawalMethod;
  now?: number;
};

export function createEvaluateWithdrawalRiskUseCase(deps: {
  riskHoldRepository: RiskHoldRepository;
  withdrawalRepository: WithdrawalRepository;
  riskEventRepository: RiskEventRepository;
}) {
  return async function evaluateWithdrawalRisk(
    input: EvaluateWithdrawalRiskInput,
  ): Promise<RiskDecisionDTO> {
    const now = input.now ?? Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const VELOCITY_WINDOW_MS = 15 * 60 * 1000;

    const activeHold = await deps.riskHoldRepository.findActiveWithdrawalHold(
      input.userId,
    );
    const lastBankChange =
      await deps.riskEventRepository.getLastBankAccountChangeAt(input.userId);
    const recentWithdrawals = await deps.withdrawalRepository.findByUserId(
      input.userId,
    );

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

export function createAssertWithdrawalAllowedUseCase(deps: {
  evaluateWithdrawalRisk: ReturnType<
    typeof createEvaluateWithdrawalRiskUseCase
  >;
  riskEventRepository: RiskEventRepository;
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

    await deps.riskEventRepository.create({
      user_id: input.userId,
      scope: RiskHoldScope.WITHDRAWALS,
      event_type: blockedDecision.eventType,
      severity: blockedDecision.severity,
      message: blockedDecision.message,
      details: blockedDecision.details,
      actor_admin_id: input.actorAdminId,
      created_at: Date.now(),
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

export function createPlaceRiskHoldUseCase(deps: {
  riskHoldRepository: RiskHoldRepository;
  riskEventRepository: RiskEventRepository;
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
      throw new Error("User already has an active withdrawal hold");
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

    await deps.riskEventRepository.create({
      user_id: input.userId,
      scope: RiskHoldScope.WITHDRAWALS,
      event_type: "hold_placed",
      severity: "warning",
      message: `Withdrawal hold placed: ${input.reason.trim()}`,
      details: { hold_id: hold._id },
      actor_admin_id: input.adminId,
      created_at: placedAt,
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

export function createReleaseRiskHoldUseCase(deps: {
  riskHoldRepository: RiskHoldRepository;
  riskEventRepository: RiskEventRepository;
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
      throw new Error("User does not have an active withdrawal hold");
    }

    const releasedAt = Date.now();
    await deps.riskHoldRepository.release(
      activeHold._id,
      input.adminId,
      releasedAt,
    );

    await deps.riskEventRepository.create({
      user_id: input.userId,
      scope: RiskHoldScope.WITHDRAWALS,
      event_type: "hold_released",
      severity: "info",
      message: "Withdrawal hold released.",
      details: { hold_id: activeHold._id },
      actor_admin_id: input.adminId,
      created_at: releasedAt,
    });

    await deps.auditLogService.log({
      action: "risk.hold_released",
      actorId: input.adminId,
      resourceType: "user_risk_hold",
      resourceId: activeHold._id,
      severity: "info",
    });
  };
}
