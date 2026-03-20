import { describe, it, expect } from "vitest";
import {
  computeProjectionDelta,
  assertValidAmount,
  isPositiveAmount,
  isNegativeAmount,
} from "..";

describe("computeProjectionDelta", () => {
  it("should correctly compute delta for contributions", () => {
    const delta = computeProjectionDelta("contribution", 1000n);
    expect(delta.totalBalanceKobo).toBe(1000n);
    expect(delta.savingsBalanceKobo).toBe(1000n);
    expect(delta.planAmountKobo).toBe(0n);
  });

  it("should correctly compute delta for contributions with plan", () => {
    const delta = computeProjectionDelta("contribution", 1000n, "plan-123");
    expect(delta.totalBalanceKobo).toBe(1000n);
    expect(delta.savingsBalanceKobo).toBe(1000n);
    expect(delta.planAmountKobo).toBe(1000n);
  });

  it("should correctly compute delta for withdrawals", () => {
    const delta = computeProjectionDelta("withdrawal", -500n);
    expect(delta.totalBalanceKobo).toBe(-500n);
    expect(delta.savingsBalanceKobo).toBe(-500n);
    expect(delta.planAmountKobo).toBe(0n);
  });

  it("should correctly compute delta for withdrawals with plan", () => {
    const delta = computeProjectionDelta("withdrawal", -500n, "plan-123");
    expect(delta.totalBalanceKobo).toBe(-500n);
    expect(delta.savingsBalanceKobo).toBe(-500n);
    expect(delta.planAmountKobo).toBe(-500n);
  });

  it("should correctly compute delta for referral bonuses", () => {
    const delta = computeProjectionDelta("referral_bonus", 500n);
    expect(delta.totalBalanceKobo).toBe(500n);
    expect(delta.savingsBalanceKobo).toBe(500n);
    expect(delta.planAmountKobo).toBe(0n);
  });

  it("should throw for reversal type", () => {
    expect(() => computeProjectionDelta("reversal", 1000n)).toThrow(
      "effectiveType cannot be reversal",
    );
  });
});

describe("amount validators", () => {
  it("should identify positive amount types correctly", () => {
    expect(isPositiveAmount("contribution")).toBe(true);
    expect(isPositiveAmount("interest_accrual")).toBe(true);
    expect(isPositiveAmount("investment_yield")).toBe(true);
    expect(isPositiveAmount("referral_bonus")).toBe(true);
    expect(isPositiveAmount("withdrawal")).toBe(false);
    expect(isPositiveAmount("reversal")).toBe(false);
  });

  it("should identify negative amount types correctly", () => {
    expect(isNegativeAmount("withdrawal")).toBe(true);
    expect(isNegativeAmount("contribution")).toBe(false);
    expect(isNegativeAmount("reversal")).toBe(false);
  });

  it("should assert valid positive amounts", () => {
    expect(() => assertValidAmount("contribution", 1000n)).not.toThrow();
    expect(() => assertValidAmount("contribution", 0n)).toThrow();
    expect(() => assertValidAmount("contribution", -100n)).toThrow();
  });

  it("should assert valid negative amounts", () => {
    expect(() => assertValidAmount("withdrawal", -1000n)).not.toThrow();
    expect(() => assertValidAmount("withdrawal", 0n)).toThrow();
    expect(() => assertValidAmount("withdrawal", 100n)).toThrow();
  });
});
