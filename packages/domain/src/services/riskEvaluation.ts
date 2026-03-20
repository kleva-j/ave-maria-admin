import type {
  WithdrawalMethod,
  RiskEventType,
  RiskSeverity,
} from "../enums";

import {
  WithdrawalMethod as WM,
  RiskEventType as RE,
  RiskSeverity as RS,
} from "../enums";

import {
  WITHDRAWAL_VELOCITY_COUNT_LIMIT,
  WITHDRAWAL_DAILY_COUNT_LIMIT,
  WITHDRAWAL_DAILY_LIMIT_KOBO,
  BANK_ACCOUNT_COOLDOWN_MS,
  VELOCITY_WINDOW_MS,
} from "../services/constants";

export type WithdrawalRiskRule =
  | "manual_hold"
  | "daily_amount_limit"
  | "daily_count_limit"
  | "velocity_limit"
  | "bank_account_cooldown";

export type WithdrawalRiskDecision =
  | {
      blocked: false;
    }
  | {
      blocked: true;
      rule: WithdrawalRiskRule;
      message: string;
      eventType: RiskEventType;
      severity: RiskSeverity;
      details?: Record<string, string | number | boolean | undefined>;
    };

export type WithdrawalRiskEvaluationInput = {
  amountKobo: bigint;
  method: WithdrawalMethod;
  now: number;
  lastBankAccountChangeAt?: number;
  activeHold?: { _id: string; reason: string; placed_at: number };
  recentDailyAmountKobo: bigint;
  recentDailyCount: number;
  recentVelocityCount: number;
};

export function evaluateWithdrawalRiskDecision(
  input: WithdrawalRiskEvaluationInput,
): WithdrawalRiskDecision {
  if (input.activeHold) {
    return {
      blocked: true,
      rule: "manual_hold",
      message: `Withdrawals are currently blocked for this user: ${input.activeHold.reason}`,
      eventType: RE.WITHDRAWAL_BLOCKED_HOLD,
      severity: RS.CRITICAL,
      details: {
        hold_id: String(input.activeHold._id),
        hold_reason: input.activeHold.reason,
        placed_at: input.activeHold.placed_at,
      },
    };
  }

  if (
    input.method === WM.BANK_TRANSFER &&
    input.lastBankAccountChangeAt !== undefined &&
    input.now - input.lastBankAccountChangeAt < BANK_ACCOUNT_COOLDOWN_MS
  ) {
    return {
      blocked: true,
      rule: "bank_account_cooldown",
      message:
        "Wait 24 hours after changing bank account details before requesting a bank transfer withdrawal.",
      eventType: RE.WITHDRAWAL_BLOCKED_BANK_COOLDOWN,
      severity: RS.WARNING,
      details: {
        last_bank_account_change_at: input.lastBankAccountChangeAt,
        cooldown_ms: BANK_ACCOUNT_COOLDOWN_MS,
      },
    };
  }

  if (
    input.recentDailyAmountKobo + input.amountKobo >
    WITHDRAWAL_DAILY_LIMIT_KOBO
  ) {
    return {
      blocked: true,
      rule: "daily_amount_limit",
      message: "Daily withdrawal amount limit exceeded.",
      eventType: RE.WITHDRAWAL_BLOCKED_DAILY_AMOUNT,
      severity: RS.WARNING,
      details: {
        attempted_amount_kobo: input.amountKobo.toString(),
        recent_daily_amount_kobo: input.recentDailyAmountKobo.toString(),
        daily_limit_kobo: WITHDRAWAL_DAILY_LIMIT_KOBO.toString(),
      },
    };
  }

  if (input.recentDailyCount + 1 > WITHDRAWAL_DAILY_COUNT_LIMIT) {
    return {
      blocked: true,
      rule: "daily_count_limit",
      message: "Daily withdrawal count limit exceeded.",
      eventType: RE.WITHDRAWAL_BLOCKED_DAILY_COUNT,
      severity: RS.WARNING,
      details: {
        recent_daily_count: input.recentDailyCount,
        daily_count_limit: WITHDRAWAL_DAILY_COUNT_LIMIT,
      },
    };
  }

  if (input.recentVelocityCount + 1 > WITHDRAWAL_VELOCITY_COUNT_LIMIT) {
    return {
      blocked: true,
      rule: "velocity_limit",
      message: "Too many withdrawal attempts in a short time.",
      eventType: RE.WITHDRAWAL_BLOCKED_VELOCITY,
      severity: RS.WARNING,
      details: {
        recent_velocity_count: input.recentVelocityCount,
        velocity_count_limit: WITHDRAWAL_VELOCITY_COUNT_LIMIT,
        velocity_window_ms: VELOCITY_WINDOW_MS,
      },
    };
  }

  return { blocked: false };
}
