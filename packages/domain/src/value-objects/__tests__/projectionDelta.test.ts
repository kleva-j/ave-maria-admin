import * as fc from "fast-check";

import { describe, it, expect } from "vitest";

import { computeProjectionDelta, assertValidAmount } from "..";
import { TxnType } from "../../enums";

// Non-reversal TxnType values that computeProjectionDelta accepts
const nonReversalTypes = [
  TxnType.CONTRIBUTION,
  TxnType.INTEREST_ACCRUAL,
  TxnType.INVESTMENT_YIELD,
  TxnType.REFERRAL_BONUS,
  TxnType.WITHDRAWAL,
] as const;

type NonReversalTxnType = (typeof nonReversalTypes)[number];

// Positive-type transactions (must have amountKobo > 0)
const positiveTypes = [
  TxnType.CONTRIBUTION,
  TxnType.INTEREST_ACCRUAL,
  TxnType.INVESTMENT_YIELD,
  TxnType.REFERRAL_BONUS,
] as const;

type PositiveTxnType = (typeof positiveTypes)[number];

// Negative-type transactions (must have amountKobo < 0)
const negativeTypes = [TxnType.WITHDRAWAL] as const;
type NegativeTxnType = (typeof negativeTypes)[number];

// Arbitrary for a non-empty optional plan ID
const arbitraryPlanId = fc.option(fc.string({ minLength: 1, maxLength: 32 }), {
  nil: undefined,
});

// Arbitrary for a non-zero bigint amount (positive or negative)
const arbitraryPositiveAmount = fc.bigInt({ min: 1n, max: 1_000_000_000n });
const arbitraryNegativeAmount = fc.bigInt({ min: -1_000_000_000n, max: -1n });

describe("Property 11: computeProjectionDelta correctness for all TxnTypes", () => {
  // Validates: Requirements 10.5, 13.3

  it("totalBalanceKobo always equals amountKobo for any non-reversal type", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...nonReversalTypes),
        fc
          .bigInt({ min: -1_000_000_000n, max: 1_000_000_000n })
          .filter((n) => n !== 0n),
        arbitraryPlanId,
        (type, amount, planId) => {
          const delta = computeProjectionDelta(
            type as NonReversalTxnType,
            amount,
            planId ?? undefined,
          );
          return delta.totalBalanceKobo === amount;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("savingsBalanceKobo always equals amountKobo for any non-reversal type", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...nonReversalTypes),
        fc
          .bigInt({ min: -1_000_000_000n, max: 1_000_000_000n })
          .filter((n) => n !== 0n),
        arbitraryPlanId,
        (type, amount, planId) => {
          const delta = computeProjectionDelta(
            type as NonReversalTxnType,
            amount,
            planId ?? undefined,
          );
          return delta.savingsBalanceKobo === amount;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("planAmountKobo is always 0n for REFERRAL_BONUS regardless of userPlanId", () => {
    fc.assert(
      fc.property(
        arbitraryPositiveAmount,
        arbitraryPlanId,
        (amount, planId) => {
          const delta = computeProjectionDelta(
            TxnType.REFERRAL_BONUS,
            amount,
            planId ?? undefined,
          );
          return delta.planAmountKobo === 0n;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("planAmountKobo equals amountKobo when userPlanId is provided (non-REFERRAL_BONUS)", () => {
    const planBoundTypes = [
      TxnType.CONTRIBUTION,
      TxnType.INTEREST_ACCRUAL,
      TxnType.INVESTMENT_YIELD,
      TxnType.WITHDRAWAL,
    ] as const;

    fc.assert(
      fc.property(
        fc.constantFrom(...planBoundTypes),
        fc
          .bigInt({ min: -1_000_000_000n, max: 1_000_000_000n })
          .filter((n) => n !== 0n),
        fc.string({ minLength: 1, maxLength: 32 }),
        (type, amount, planId) => {
          const delta = computeProjectionDelta(type, amount, planId);
          return delta.planAmountKobo === amount;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("planAmountKobo is 0n when userPlanId is absent (non-REFERRAL_BONUS)", () => {
    const planBoundTypes = [
      TxnType.CONTRIBUTION,
      TxnType.INTEREST_ACCRUAL,
      TxnType.INVESTMENT_YIELD,
      TxnType.WITHDRAWAL,
    ] as const;

    fc.assert(
      fc.property(
        fc.constantFrom(...planBoundTypes),
        fc
          .bigInt({ min: -1_000_000_000n, max: 1_000_000_000n })
          .filter((n) => n !== 0n),
        (type, amount) => {
          const delta = computeProjectionDelta(type, amount, undefined);
          return delta.planAmountKobo === 0n;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("throws for REVERSAL type regardless of amount or planId", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: -1_000_000_000n, max: 1_000_000_000n }),
        arbitraryPlanId,
        (amount, planId) => {
          expect(() =>
            computeProjectionDelta(
              TxnType.REVERSAL,
              amount,
              planId ?? undefined,
            ),
          ).toThrow("effectiveType cannot be reversal");
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("Property 12: assertValidAmount rejects wrong-sign amounts", () => {
  // Validates: Requirements 13.4

  it("throws for positive-type transactions with amountKobo <= 0", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...positiveTypes),
        fc.bigInt({ min: -1_000_000_000n, max: 0n }),
        (type, amount) => {
          expect(() =>
            assertValidAmount(type as PositiveTxnType, amount),
          ).toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("does not throw for positive-type transactions with amountKobo > 0", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...positiveTypes),
        arbitraryPositiveAmount,
        (type, amount) => {
          expect(() =>
            assertValidAmount(type as PositiveTxnType, amount),
          ).not.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("throws for WITHDRAWAL with amountKobo >= 0", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...negativeTypes),
        fc.bigInt({ min: 0n, max: 1_000_000_000n }),
        (type, amount) => {
          expect(() =>
            assertValidAmount(type as NegativeTxnType, amount),
          ).toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("does not throw for WITHDRAWAL with amountKobo < 0", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...negativeTypes),
        arbitraryNegativeAmount,
        (type, amount) => {
          expect(() =>
            assertValidAmount(type as NegativeTxnType, amount),
          ).not.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("boundary: positive-type with amountKobo = 1n is valid", () => {
    for (const type of positiveTypes) {
      expect(() => assertValidAmount(type, 1n)).not.toThrow();
    }
  });

  it("boundary: WITHDRAWAL with amountKobo = -1n is valid", () => {
    expect(() => assertValidAmount(TxnType.WITHDRAWAL, -1n)).not.toThrow();
  });
});
