import { describe, expect, it } from "vitest";

import { TxnType, computeProjectionDelta } from "@avm-daily/domain";

describe("transaction policy helpers", () => {
  it("computes positive projection deltas for plan-linked contributions", () => {
    expect(
      computeProjectionDelta(
        TxnType.CONTRIBUTION,
        100_000n,
        "plan_1" as never,
      ),
    ).toEqual({
      totalBalanceKobo: 100_000n,
      savingsBalanceKobo: 100_000n,
      planAmountKobo: 100_000n,
    });
  });

  it("keeps referral bonuses off savings plans in v1", () => {
    expect(
      computeProjectionDelta(
        TxnType.REFERRAL_BONUS,
        5_000n,
        "plan_1" as never,
      ),
    ).toEqual({
      totalBalanceKobo: 5_000n,
      savingsBalanceKobo: 5_000n,
      planAmountKobo: 0n,
    });
  });

  it("applies negative deltas for withdrawals", () => {
    expect(
      computeProjectionDelta(TxnType.WITHDRAWAL, -40_000n, "plan_1" as never),
    ).toEqual({
      totalBalanceKobo: -40_000n,
      savingsBalanceKobo: -40_000n,
      planAmountKobo: -40_000n,
    });
  });
});
