import { describe, expect, it } from "vitest";

import { TxnType } from "../shared";

import {
  areComparableTransactionPayloadsEqual,
  buildComparableTransactionPayload,
  computeProjectionDelta,
} from "../transactions";

describe("transaction policy helpers", () => {
  it("treats equivalent payloads as idempotent even when metadata key order differs", () => {
    const left = buildComparableTransactionPayload({
      userId: "user_1" as never,
      userPlanId: "plan_1" as never,
      type: TxnType.CONTRIBUTION,
      amountKobo: 25_000n,
      reference: "contrib_ref_1",
      metadata: {
        source: "user",
        note: "first deposit",
        channel: "card",
      },
    });

    const right = buildComparableTransactionPayload({
      userId: "user_1" as never,
      userPlanId: "plan_1" as never,
      type: TxnType.CONTRIBUTION,
      amountKobo: 25_000n,
      reference: "contrib_ref_1",
      metadata: {
        channel: "card",
        note: "first deposit",
        source: "user",
      },
    });

    expect(areComparableTransactionPayloadsEqual(left, right)).toBe(true);
  });

  it("detects payload drift for duplicate references", () => {
    const left = buildComparableTransactionPayload({
      userId: "user_1" as never,
      type: TxnType.WITHDRAWAL,
      amountKobo: -10_000n,
      reference: "wdr_ref_1",
      metadata: { method: "cash" },
    });

    const right = buildComparableTransactionPayload({
      userId: "user_1" as never,
      type: TxnType.WITHDRAWAL,
      amountKobo: -12_000n,
      reference: "wdr_ref_1",
      metadata: { method: "cash" },
    });

    expect(areComparableTransactionPayloadsEqual(left, right)).toBe(false);
  });

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
