import { describe, expect, it } from "vitest";

import { RiskEventType, RiskSeverity, WithdrawalMethod } from "../shared";

process.env.WORKOS_CLIENT_ID = "test_client_id";
process.env.WORKOS_API_KEY = "test_api_key";
process.env.WORKOS_WEBHOOK_SECRET = "test_webhook_secret";

import {
  WITHDRAWAL_VELOCITY_COUNT_LIMIT,
  evaluateWithdrawalRiskDecision,
  WITHDRAWAL_DAILY_COUNT_LIMIT,
  WITHDRAWAL_DAILY_LIMIT_KOBO,
} from "../risk";

describe("evaluateWithdrawalRiskDecision", () => {
  const now = Date.now();
  const baseInput = {
    amountKobo: 50_000n,
    method: WithdrawalMethod.BANK_TRANSFER,
    now,
    recentDailyAmountKobo: 0n,
    recentDailyCount: 0,
    recentVelocityCount: 0,
  };

  it("blocks withdrawals when a manual hold is active", () => {
    const result = evaluateWithdrawalRiskDecision({
      ...baseInput,
      activeHold: {
        _id: "hold_1" as never,
        reason: "Compliance review",
        placed_at: now - 1_000,
      },
    });

    expect(result).toMatchObject({
      blocked: true,
      rule: "manual_hold",
      eventType: RiskEventType.WITHDRAWAL_BLOCKED_HOLD,
      severity: RiskSeverity.CRITICAL,
    });
  });

  it("blocks bank transfer withdrawals during the cooldown window", () => {
    const result = evaluateWithdrawalRiskDecision({
      ...baseInput,
      lastBankAccountChangeAt: now - 60_000,
    });

    expect(result).toMatchObject({
      blocked: true,
      rule: "bank_account_cooldown",
      eventType: RiskEventType.WITHDRAWAL_BLOCKED_BANK_COOLDOWN,
      severity: RiskSeverity.WARNING,
    });
  });

  it("blocks when the daily amount limit would be exceeded", () => {
    const result = evaluateWithdrawalRiskDecision({
      ...baseInput,
      amountKobo: 10_000n,
      recentDailyAmountKobo: WITHDRAWAL_DAILY_LIMIT_KOBO,
    });

    expect(result).toMatchObject({
      blocked: true,
      rule: "daily_amount_limit",
      eventType: RiskEventType.WITHDRAWAL_BLOCKED_DAILY_AMOUNT,
    });
  });

  it("blocks when the daily count limit would be exceeded", () => {
    const result = evaluateWithdrawalRiskDecision({
      ...baseInput,
      recentDailyCount: WITHDRAWAL_DAILY_COUNT_LIMIT,
    });

    expect(result).toMatchObject({
      blocked: true,
      rule: "daily_count_limit",
      eventType: RiskEventType.WITHDRAWAL_BLOCKED_DAILY_COUNT,
    });
  });

  it("blocks when too many withdrawals happen in a short window", () => {
    const result = evaluateWithdrawalRiskDecision({
      ...baseInput,
      recentVelocityCount: WITHDRAWAL_VELOCITY_COUNT_LIMIT,
    });

    expect(result).toMatchObject({
      blocked: true,
      rule: "velocity_limit",
      eventType: RiskEventType.WITHDRAWAL_BLOCKED_VELOCITY,
    });
  });

  it("allows withdrawals when no risk rule is triggered", () => {
    const result = evaluateWithdrawalRiskDecision({
      ...baseInput,
      method: WithdrawalMethod.CASH,
    });

    expect(result).toEqual({ blocked: false });
  });
});
