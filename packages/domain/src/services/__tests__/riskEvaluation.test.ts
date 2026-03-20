import { describe, it, expect } from "vitest";
import {
  type WithdrawalRiskEvaluationInput,
  evaluateWithdrawalRiskDecision,
} from "../riskEvaluation";

function createBaseInput(
  overrides: Partial<WithdrawalRiskEvaluationInput> = {},
) {
  return {
    amountKobo: 1000n,
    method: "bank_transfer" as const,
    now: Date.now(),
    lastBankAccountChangeAt: undefined,
    activeHold: undefined,
    recentDailyAmountKobo: 0n,
    recentDailyCount: 0,
    recentVelocityCount: 0,
    ...overrides,
  };
}

describe("riskEvaluation", () => {
  it("should allow withdrawal with no risk factors", () => {
    const decision = evaluateWithdrawalRiskDecision(createBaseInput());
    expect(decision.blocked).toBe(false);
  });

  describe("manual hold", () => {
    it("should block withdrawal when active hold exists", () => {
      const input = createBaseInput({
        activeHold: {
          _id: "hold-1",
          reason: "Suspicious activity",
          placed_at: Date.now(),
        },
      });
      const decision = evaluateWithdrawalRiskDecision(input);
      expect(decision.blocked).toBe(true);
      if (decision.blocked) {
        expect(decision.rule).toBe("manual_hold");
        expect(decision.severity).toBe("critical");
      }
    });
  });

  describe("bank account cooldown", () => {
    it("should block withdrawal within 24h of bank account change", () => {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;
      const input = createBaseInput({
        lastBankAccountChangeAt: oneHourAgo,
      });
      const decision = evaluateWithdrawalRiskDecision(input);
      expect(decision.blocked).toBe(true);
      if (decision.blocked) {
        expect(decision.rule).toBe("bank_account_cooldown");
        expect(decision.severity).toBe("warning");
      }
    });

    it("should allow withdrawal after 24h of bank account change", () => {
      const now = Date.now();
      const twoDaysAgo = now - 48 * 60 * 60 * 1000;
      const input = createBaseInput({
        lastBankAccountChangeAt: twoDaysAgo,
      });
      const decision = evaluateWithdrawalRiskDecision(input);
      expect(decision.blocked).toBe(false);
    });

    it("should not apply cooldown to cash withdrawals", () => {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;
      const input = createBaseInput({
        method: "cash",
        lastBankAccountChangeAt: oneHourAgo,
      });
      const decision = evaluateWithdrawalRiskDecision(input);
      expect(decision.blocked).toBe(false);
    });
  });

  describe("daily amount limit", () => {
    it("should block withdrawal exceeding daily limit", () => {
      const input = createBaseInput({
        recentDailyAmountKobo: 49_000_000n,
        amountKobo: 2_000_000n,
      });
      const decision = evaluateWithdrawalRiskDecision(input);
      expect(decision.blocked).toBe(true);
      if (decision.blocked) {
        expect(decision.rule).toBe("daily_amount_limit");
        expect(decision.severity).toBe("warning");
      }
    });

    it("should allow withdrawal within daily limit", () => {
      const input = createBaseInput({
        recentDailyAmountKobo: 40_000_000n,
        amountKobo: 10_000_000n,
      });
      const decision = evaluateWithdrawalRiskDecision(input);
      expect(decision.blocked).toBe(false);
    });

    it("should allow exact daily limit amount", () => {
      const input = createBaseInput({
        recentDailyAmountKobo: 40_000_000n,
        amountKobo: 10_000_000n,
      });
      const decision = evaluateWithdrawalRiskDecision(input);
      expect(decision.blocked).toBe(false);
    });
  });

  describe("daily count limit", () => {
    it("should block withdrawal exceeding daily count limit", () => {
      const input = createBaseInput({
        recentDailyCount: 3,
      });
      const decision = evaluateWithdrawalRiskDecision(input);
      expect(decision.blocked).toBe(true);
      if (decision.blocked) {
        expect(decision.rule).toBe("daily_count_limit");
      }
    });

    it("should allow withdrawal within daily count limit", () => {
      const input = createBaseInput({
        recentDailyCount: 2,
      });
      const decision = evaluateWithdrawalRiskDecision(input);
      expect(decision.blocked).toBe(false);
    });
  });

  describe("velocity limit", () => {
    it("should block withdrawal exceeding velocity limit", () => {
      const input = createBaseInput({
        recentVelocityCount: 2,
      });
      const decision = evaluateWithdrawalRiskDecision(input);
      expect(decision.blocked).toBe(true);
      if (decision.blocked) {
        expect(decision.rule).toBe("velocity_limit");
      }
    });

    it("should allow withdrawal within velocity limit", () => {
      const input = createBaseInput({
        recentVelocityCount: 1,
      });
      const decision = evaluateWithdrawalRiskDecision(input);
      expect(decision.blocked).toBe(false);
    });
  });

  describe("priority order", () => {
    it("should check manual hold before other rules", () => {
      const input = createBaseInput({
        activeHold: {
          _id: "hold-1",
          reason: "Hold reason",
          placed_at: Date.now(),
        },
        recentDailyCount: 3,
      });
      const decision = evaluateWithdrawalRiskDecision(input);
      expect(decision.blocked).toBe(true);
      if (decision.blocked) {
        expect(decision.rule).toBe("manual_hold");
      }
    });
  });
});
