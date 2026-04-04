import type { TxnType } from "../enums";

export type ProjectionDelta = {
  totalBalanceKobo: bigint;
  savingsBalanceKobo: bigint;
  planAmountKobo: bigint;
};

export function computeProjectionDelta(
  effectiveType: TxnType,
  amountKobo: bigint,
  userPlanId?: string,
): ProjectionDelta {
  switch (effectiveType) {
    case "contribution":
    case "interest_accrual":
    case "investment_yield":
      return {
        totalBalanceKobo: amountKobo,
        savingsBalanceKobo: amountKobo,
        planAmountKobo: userPlanId ? amountKobo : 0n,
      };
    case "referral_bonus":
      return {
        totalBalanceKobo: amountKobo,
        savingsBalanceKobo: amountKobo,
        planAmountKobo: 0n,
      };
    case "withdrawal":
      return {
        totalBalanceKobo: amountKobo,
        savingsBalanceKobo: amountKobo,
        planAmountKobo: userPlanId ? amountKobo : 0n,
      };
    case "reversal":
      throw new Error("effectiveType cannot be reversal");
  }
}

export function isPositiveAmount(type: TxnType): boolean {
  return (
    type === "contribution" ||
    type === "interest_accrual" ||
    type === "investment_yield" ||
    type === "referral_bonus"
  );
}

export function isNegativeAmount(type: TxnType): boolean {
  return type === "withdrawal";
}

export function assertValidAmount(type: TxnType, amountKobo: bigint): void {
  if (isPositiveAmount(type) && amountKobo <= 0n) {
    throw new Error(`${type} transactions must have a positive amount`);
  }
  if (isNegativeAmount(type) && amountKobo >= 0n) {
    throw new Error(`${type} transactions must have a negative amount`);
  }
}
