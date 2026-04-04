import * as fc from "fast-check";

import { describe, it, expect } from "vitest";
import {
  type WithdrawalRiskEvaluationInput,
  type WithdrawalRiskRule,
  evaluateWithdrawalRiskDecision,
  defaultWithdrawalRiskRules,
  bankAccountCooldownRule,
  dailyAmountLimitRule,
  dailyCountLimitRule,
  velocityLimitRule,
  manualHoldRule,
} from "../riskEvaluation";

import {
  WITHDRAWAL_VELOCITY_COUNT_LIMIT,
  WITHDRAWAL_DAILY_COUNT_LIMIT,
  WITHDRAWAL_DAILY_LIMIT_KOBO,
  BANK_ACCOUNT_COOLDOWN_MS,
} from "../constants";

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

describe("Property 3: Risk evaluation is a pure function", () => {
  const arbitraryRiskInput = fc.record<WithdrawalRiskEvaluationInput>({
    amountKobo: fc.bigInt({ min: 1n, max: 100_000_000n }),
    method: fc.constantFrom("bank_transfer" as const, "cash" as const),
    now: fc.integer({ min: 1_000_000_000_000, max: 9_999_999_999_999 }),
    lastBankAccountChangeAt: fc.option(
      fc.integer({ min: 0, max: 9_999_999_999_999 }),
      { nil: undefined },
    ),
    activeHold: fc.option(
      fc.record({
        _id: fc.string({ minLength: 1, maxLength: 32 }),
        reason: fc.string({ minLength: 1, maxLength: 64 }),
        placed_at: fc.integer({ min: 0, max: 9_999_999_999_999 }),
      }),
      { nil: undefined },
    ),
    recentDailyAmountKobo: fc.bigInt({ min: 0n, max: 100_000_000n }),
    recentDailyCount: fc.integer({ min: 0, max: 10 }),
    recentVelocityCount: fc.integer({ min: 0, max: 10 }),
  });

  it("returns structurally equal results for the same input (purity)", () => {
    // Validates: Requirements 2.1, 4.2
    fc.assert(
      fc.property(arbitraryRiskInput, (input) => {
        const r1 = evaluateWithdrawalRiskDecision(input);
        const r2 = evaluateWithdrawalRiskDecision(input);
        return JSON.stringify(r1) === JSON.stringify(r2);
      }),
      { numRuns: 100 },
    );
  });

  it("does not throw for any valid input", () => {
    // Validates: Requirements 2.1, 4.2
    fc.assert(
      fc.property(arbitraryRiskInput, (input) => {
        expect(() => evaluateWithdrawalRiskDecision(input)).not.toThrow();
      }),
      { numRuns: 100 },
    );
  });
});

describe("Property 4: Each risk rule is independently triggerable", () => {
  // Validates: Requirements 4.2, 4.4, 13.1

  const baseNow = 1_700_000_000_000;

  // Arbitrary for a valid hold object
  const arbitraryHold = fc.record({
    _id: fc.string({ minLength: 1, maxLength: 32 }),
    reason: fc.string({ minLength: 1, maxLength: 64 }),
    placed_at: fc.integer({ min: 0, max: baseNow }),
  });

  it("manual_hold rule triggers for any input with an active hold", () => {
    fc.assert(
      fc.property(arbitraryHold, (hold) => {
        const input = createBaseInput({ activeHold: hold, now: baseNow });
        const result = manualHoldRule(input);
        return (
          result !== null &&
          result.blocked === true &&
          result.rule === "manual_hold"
        );
      }),
      { numRuns: 100 },
    );
  });

  it("manual_hold rule does not trigger when there is no active hold", () => {
    fc.assert(
      fc.property(
        fc.record({
          amountKobo: fc.bigInt({ min: 1n, max: 100_000_000n }),
          method: fc.constantFrom("bank_transfer" as const, "cash" as const),
          recentDailyAmountKobo: fc.bigInt({ min: 0n, max: 100_000_000n }),
          recentDailyCount: fc.integer({ min: 0, max: 10 }),
          recentVelocityCount: fc.integer({ min: 0, max: 10 }),
        }),
        (fields) => {
          const input = createBaseInput({
            ...fields,
            activeHold: undefined,
            now: baseNow,
          });
          return manualHoldRule(input) === null;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("bank_account_cooldown rule triggers for bank_transfer within cooldown window", () => {
    // Any lastBankAccountChangeAt within (now - BANK_ACCOUNT_COOLDOWN_MS, now) triggers the rule
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: BANK_ACCOUNT_COOLDOWN_MS - 1 }),
        (msAgo) => {
          const input = createBaseInput({
            method: "bank_transfer",
            lastBankAccountChangeAt: baseNow - msAgo,
            now: baseNow,
          });
          const result = bankAccountCooldownRule(input);
          return (
            result !== null &&
            result.blocked === true &&
            result.rule === "bank_account_cooldown"
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("bank_account_cooldown rule does not trigger for cash method regardless of change time", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: baseNow }), (lastChangeAt) => {
        const input = createBaseInput({
          method: "cash",
          lastBankAccountChangeAt: lastChangeAt,
          now: baseNow,
        });
        return bankAccountCooldownRule(input) === null;
      }),
      { numRuns: 100 },
    );
  });

  it("bank_account_cooldown rule does not trigger after cooldown window has passed", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 30 * 24 * 60 * 60 * 1000 }),
        (extraMs) => {
          const input = createBaseInput({
            method: "bank_transfer",
            lastBankAccountChangeAt:
              baseNow - BANK_ACCOUNT_COOLDOWN_MS - extraMs,
            now: baseNow,
          });
          return bankAccountCooldownRule(input) === null;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("daily_amount_limit rule triggers when recentDailyAmountKobo + amountKobo exceeds limit", () => {
    // Pick recentDailyAmountKobo in [1, limit] and amountKobo such that sum > limit
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n, max: WITHDRAWAL_DAILY_LIMIT_KOBO }),
        (recent) => {
          const amount = WITHDRAWAL_DAILY_LIMIT_KOBO - recent + 1n;
          const input = createBaseInput({
            recentDailyAmountKobo: recent,
            amountKobo: amount,
          });
          const result = dailyAmountLimitRule(input);
          return (
            result !== null &&
            result.blocked === true &&
            result.rule === "daily_amount_limit"
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("daily_amount_limit rule does not trigger when sum is within limit", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: WITHDRAWAL_DAILY_LIMIT_KOBO }),
        fc.bigInt({ min: 1n, max: WITHDRAWAL_DAILY_LIMIT_KOBO }),
        (recent, amount) => {
          fc.pre(recent + amount <= WITHDRAWAL_DAILY_LIMIT_KOBO);
          const input = createBaseInput({
            recentDailyAmountKobo: recent,
            amountKobo: amount,
          });
          return dailyAmountLimitRule(input) === null;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("daily_count_limit rule triggers when recentDailyCount >= limit", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: WITHDRAWAL_DAILY_COUNT_LIMIT, max: 20 }),
        (count) => {
          const input = createBaseInput({ recentDailyCount: count });
          const result = dailyCountLimitRule(input);
          return (
            result !== null &&
            result.blocked === true &&
            result.rule === "daily_count_limit"
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("daily_count_limit rule does not trigger when recentDailyCount is below limit", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: WITHDRAWAL_DAILY_COUNT_LIMIT - 1 }),
        (count) => {
          const input = createBaseInput({ recentDailyCount: count });
          return dailyCountLimitRule(input) === null;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("velocity_limit rule triggers when recentVelocityCount >= limit", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: WITHDRAWAL_VELOCITY_COUNT_LIMIT, max: 20 }),
        (count) => {
          const input = createBaseInput({ recentVelocityCount: count });
          const result = velocityLimitRule(input);
          return (
            result !== null &&
            result.blocked === true &&
            result.rule === "velocity_limit"
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("velocity_limit rule does not trigger when recentVelocityCount is below limit", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: WITHDRAWAL_VELOCITY_COUNT_LIMIT - 1 }),
        (count) => {
          const input = createBaseInput({ recentVelocityCount: count });
          return velocityLimitRule(input) === null;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("all five rules are present in defaultWithdrawalRiskRules", () => {
    const allRules: WithdrawalRiskRule[] = [
      "manual_hold",
      "bank_account_cooldown",
      "daily_amount_limit",
      "daily_count_limit",
      "velocity_limit",
    ];
    // Each rule name must be producible by some evaluator in the default array
    for (const ruleName of allRules) {
      const triggeredByDefault = defaultWithdrawalRiskRules.some(
        (evaluator) => {
          // Build a maximally-triggering input for this rule
          const input = createBaseInput({
            now: baseNow,
            activeHold:
              ruleName === "manual_hold"
                ? { _id: "h1", reason: "test", placed_at: baseNow - 1000 }
                : undefined,
            method:
              ruleName === "bank_account_cooldown"
                ? "bank_transfer"
                : "bank_transfer",
            lastBankAccountChangeAt:
              ruleName === "bank_account_cooldown" ? baseNow - 1000 : undefined,
            recentDailyAmountKobo:
              ruleName === "daily_amount_limit"
                ? WITHDRAWAL_DAILY_LIMIT_KOBO
                : 0n,
            amountKobo: ruleName === "daily_amount_limit" ? 1n : 1000n,
            recentDailyCount:
              ruleName === "daily_count_limit"
                ? WITHDRAWAL_DAILY_COUNT_LIMIT
                : 0,
            recentVelocityCount:
              ruleName === "velocity_limit"
                ? WITHDRAWAL_VELOCITY_COUNT_LIMIT
                : 0,
          });
          const result = evaluator(input);
          return (
            result !== null &&
            result.blocked === true &&
            result.rule === ruleName
          );
        },
      );
      expect(triggeredByDefault).toBe(true);
    }
  });

  it("an input with no risk factors is allowed by evaluateWithdrawalRiskDecision", () => {
    fc.assert(
      fc.property(
        fc.record({
          amountKobo: fc.bigInt({ min: 1n, max: WITHDRAWAL_DAILY_LIMIT_KOBO }),
          method: fc.constantFrom("bank_transfer" as const, "cash" as const),
        }),
        ({ amountKobo, method }) => {
          const input = createBaseInput({
            amountKobo,
            method,
            now: baseNow,
            activeHold: undefined,
            lastBankAccountChangeAt: undefined,
            recentDailyAmountKobo: 0n,
            recentDailyCount: 0,
            recentVelocityCount: 0,
          });
          const decision = evaluateWithdrawalRiskDecision(input);
          return decision.blocked === false;
        },
      ),
      { numRuns: 100 },
    );
  });
});
