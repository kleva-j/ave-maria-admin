import { describe, expect, it, vi } from "vitest";

import { DomainError, TxnType } from "@avm-daily/domain";

import { createConvexRiskHoldRepository } from "../adapters/riskAdapters";
import { createConvexSavingsPlanRepository } from "../adapters/savingsPlanAdapters";
import { createConvexTransactionWriteRepository } from "../adapters/transactionAdapters";
import {
  PlanStatus,
  RiskHoldScope,
  RiskHoldStatus,
  TABLE_NAMES,
} from "../shared";

describe("Convex adapter repositories", () => {
  it("throws when multiple active withdrawal holds exist for a user", async () => {
    const firstHold = {
      _id: "hold-1",
      user_id: "user-1",
      scope: RiskHoldScope.WITHDRAWALS,
      status: RiskHoldStatus.ACTIVE,
      reason: "Review",
      placed_by_admin_id: "admin-1",
      placed_at: 1,
    };
    const secondHold = { ...firstHold, _id: "hold-2", placed_at: 2 };
    const filter = vi.fn(() => ({
      first: vi.fn().mockResolvedValue(firstHold),
      take: vi.fn().mockResolvedValue([firstHold, secondHold]),
    }));
    const withIndex = vi.fn(() => ({ filter }));
    const query = vi.fn(() => ({ withIndex }));
    const ctx = {
      db: {
        query,
      },
    } as any;

    const repo = createConvexRiskHoldRepository(ctx);

    await expect(
      repo.findActiveWithdrawalHold("user-1" as never),
    ).rejects.toMatchObject({
      code: "risk_hold_invariant_violation",
    });
    expect(query).toHaveBeenCalledWith(TABLE_NAMES.USER_RISK_HOLDS);
  });

  it("rejects creating a second active withdrawal hold for the same user", async () => {
    const existingHold = {
      _id: "hold-1",
      user_id: "user-1",
      scope: RiskHoldScope.WITHDRAWALS,
      status: RiskHoldStatus.ACTIVE,
      reason: "Existing review",
      placed_by_admin_id: "admin-1",
      placed_at: 1,
    };
    const insert = vi.fn();
    const filter = vi.fn(() => ({
      take: vi.fn().mockResolvedValue([existingHold]),
    }));
    const withIndex = vi.fn(() => ({ filter }));
    const query = vi.fn(() => ({ withIndex }));
    const ctx = {
      db: {
        query,
        insert,
      },
    } as any;

    const repo = createConvexRiskHoldRepository(ctx);

    await expect(
      repo.create({
        user_id: "user-1" as never,
        scope: RiskHoldScope.WITHDRAWALS,
        status: RiskHoldStatus.ACTIVE,
        reason: "New review",
        placed_by_admin_id: "admin-2" as never,
        placed_at: 2,
      }),
    ).rejects.toMatchObject({
      code: "hold_already_active",
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("throws when updateAmount is called for a missing savings plan", async () => {
    const get = vi.fn().mockResolvedValue(null);
    const patch = vi.fn();
    const ctx = {
      db: {
        get,
        patch,
      },
    } as any;

    const repo = createConvexSavingsPlanRepository(ctx);

    await expect(
      repo.updateAmount("plan-1" as never, 10_000n, 123456),
    ).rejects.toBeInstanceOf(DomainError);
    await expect(
      repo.updateAmount("plan-1" as never, 10_000n, 123456),
    ).rejects.toMatchObject({
      code: "user_savings_plan_not_found",
    });
    expect(get).toHaveBeenCalledWith("plan-1");
    expect(patch).not.toHaveBeenCalled();
  });

  it("omits user_plan_id when creating a transaction without a linked plan", async () => {
    const insertedId = "tx-1";
    const insert = vi.fn().mockResolvedValue(insertedId);
    const get = vi.fn().mockResolvedValue({
      _id: insertedId,
      user_id: "user-1",
      type: TxnType.CONTRIBUTION,
      amount_kobo: 25_000n,
      reference: "ref-1",
      metadata: {},
      created_at: 123456,
    });
    const ctx = {
      db: {
        insert,
        get,
      },
    } as any;

    const repo = createConvexTransactionWriteRepository(ctx);

    await repo.create({
      user_id: "user-1",
      type: TxnType.CONTRIBUTION,
      amount_kobo: 25_000n,
      reference: "ref-1",
      metadata: {},
      created_at: 123456,
    });

    const insertPayload = insert.mock.calls[0]?.[1];
    expect(insert.mock.calls[0]?.[0]).toBe(TABLE_NAMES.TRANSACTIONS);
    expect(insertPayload).not.toHaveProperty("user_plan_id");
  });

  it("patches savings plans only after confirming the document exists", async () => {
    const get = vi.fn().mockResolvedValue({
      _id: "plan-1",
      user_id: "user-1",
      current_amount_kobo: 5_000n,
      status: PlanStatus.ACTIVE,
      updated_at: 1,
    });
    const patch = vi.fn().mockResolvedValue(undefined);
    const ctx = {
      db: {
        get,
        patch,
      },
    } as any;

    const repo = createConvexSavingsPlanRepository(ctx);

    await repo.updateAmount("plan-1" as never, 7_500n, 999);

    expect(get).toHaveBeenCalledWith("plan-1");
    expect(patch).toHaveBeenCalledWith("plan-1", {
      current_amount_kobo: 7_500n,
      updated_at: 999,
    });
  });
});
