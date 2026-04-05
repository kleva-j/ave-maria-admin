import { describe, expect, it, vi } from "vitest";

import { DomainError, TxnType } from "@avm-daily/domain";

import { createConvexTransactionWriteRepository } from "../adapters/transactionAdapters";
import { createConvexWithdrawalRepository } from "../adapters/withdrawalAdapter";

import {
  createConvexSavingsPlanTemplateRepository,
  createConvexSavingsPlanRepository,
} from "../adapters/savingsPlanAdapters";

import {
  createConvexRiskEventRepository,
  createConvexRiskHoldRepository,
  createConvexRiskEventService,
} from "../adapters/riskAdapters";

import {
  WithdrawalMethod,
  RiskHoldStatus,
  RiskHoldScope,
  RiskEventType,
  RiskSeverity,
  PlanStatus,
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

    const updateAmountPromise = repo.updateAmount(
      "plan-1" as never,
      10_000n,
      123456,
    );

    await expect(updateAmountPromise).rejects.toBeInstanceOf(DomainError);
    await expect(updateAmountPromise).rejects.toMatchObject({
      code: "user_savings_plan_not_found",
    });
    expect(get).toHaveBeenCalledWith("plan-1");
    expect(get).toHaveBeenCalledTimes(1);
    expect(patch).not.toHaveBeenCalled();
  });

  it("omits optional linked ids when creating a transaction without them", async () => {
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
    expect(insertPayload).not.toHaveProperty("reversal_of_transaction_id");
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

  it("creates and updates savings plans through the adapter", async () => {
    const createdPlan = {
      _id: "plan-1",
      user_id: "user-1",
      template_id: "template-1",
      custom_target_kobo: 100_000n,
      current_amount_kobo: 0n,
      start_date: "2026-04-04",
      end_date: "2026-05-04",
      status: PlanStatus.ACTIVE,
      automation_enabled: false,
      metadata: { template_snapshot: { name: "Japa" } },
      created_at: 1,
      updated_at: 1,
    };
    const insert = vi.fn().mockResolvedValue("plan-1");
    const get = vi
      .fn()
      .mockResolvedValueOnce(createdPlan)
      .mockResolvedValueOnce(createdPlan)
      .mockResolvedValueOnce({
        ...createdPlan,
        status: PlanStatus.PAUSED,
        updated_at: 2,
      });
    const patch = vi.fn().mockResolvedValue(undefined);
    const ctx = {
      db: {
        insert,
        get,
        patch,
      },
    } as any;

    const repo = createConvexSavingsPlanRepository(ctx);

    const created = await repo.create({
      user_id: "user-1",
      template_id: "template-1",
      custom_target_kobo: 100_000n,
      current_amount_kobo: 0n,
      start_date: "2026-04-04",
      end_date: "2026-05-04",
      status: "active",
      automation_enabled: false,
      metadata: { template_snapshot: { name: "Japa" } },
      created_at: 1,
      updated_at: 1,
    });
    const updated = await repo.update("plan-1", {
      status: "paused",
      updated_at: 2,
    });

    expect(created.template_id).toBe("template-1");
    expect(insert).toHaveBeenCalledWith(TABLE_NAMES.USER_SAVINGS_PLANS, {
      user_id: "user-1",
      template_id: "template-1",
      custom_target_kobo: 100_000n,
      current_amount_kobo: 0n,
      start_date: "2026-04-04",
      end_date: "2026-05-04",
      status: "active",
      automation_enabled: false,
      metadata: { template_snapshot: { name: "Japa" } },
      created_at: 1,
      updated_at: 1,
    });
    expect(patch).toHaveBeenCalledWith("plan-1", {
      status: "paused",
      updated_at: 2,
    });
    expect(updated.status).toBe("paused");
  });

  it("finds a savings plan by the user and template index", async () => {
    const plan = {
      _id: "plan-1",
      user_id: "user-1",
      template_id: "template-1",
      custom_target_kobo: 100_000n,
      current_amount_kobo: 0n,
      start_date: "2026-04-04",
      end_date: "2026-05-04",
      status: PlanStatus.ACTIVE,
      automation_enabled: false,
      metadata: {},
      created_at: 1,
      updated_at: 1,
    };
    const first = vi.fn().mockResolvedValue(plan);
    const withIndex = vi.fn(() => ({ first }));
    const query = vi.fn(() => ({ withIndex }));
    const ctx = {
      db: {
        query,
      },
    } as any;

    const repo = createConvexSavingsPlanRepository(ctx);
    const found = await repo.findByUserIdAndTemplateId(
      "user-1" as never,
      "template-1" as never,
    );

    expect(query).toHaveBeenCalledWith(TABLE_NAMES.USER_SAVINGS_PLANS);
    expect(withIndex).toHaveBeenCalledWith(
      "by_user_id_and_template_id",
      expect.any(Function),
    );
    expect(found?._id).toBe("plan-1");
  });

  it("finds, creates, and updates savings plan templates through the adapter", async () => {
    const template = {
      _id: "template-1",
      name: "Japa",
      description: "Relocation goal",
      default_target_kobo: 100_000n,
      duration_days: 30,
      interest_rate: 0,
      automation_type: "weekly",
      is_active: true,
      created_at: 1,
    };
    const withIndex = vi.fn(() => ({
      take: vi.fn().mockResolvedValue([template]),
    }));
    const query = vi.fn(() => ({ withIndex }));
    const insert = vi.fn().mockResolvedValue("template-2");
    const get = vi
      .fn()
      .mockResolvedValueOnce({
        ...template,
        _id: "template-2",
        name: "School Fees",
      })
      .mockResolvedValueOnce(template)
      .mockResolvedValueOnce({
        ...template,
        is_active: false,
      });
    const patch = vi.fn().mockResolvedValue(undefined);
    const ctx = {
      db: {
        query,
        insert,
        get,
        patch,
      },
    } as any;

    const repo = createConvexSavingsPlanTemplateRepository(ctx);

    const found = await repo.findByName("Japa");
    const created = await repo.create({
      name: "School Fees",
      description: "Term savings",
      default_target_kobo: 150_000n,
      duration_days: 45,
      interest_rate: 5,
      automation_type: "weekly",
      is_active: true,
      created_at: 2,
    });
    const updated = await repo.update("template-1", { is_active: false });

    expect(found?.name).toBe("Japa");
    expect(query).toHaveBeenCalledWith(TABLE_NAMES.SAVINGS_PLAN_TEMPLATES);
    expect(insert).toHaveBeenCalledWith(TABLE_NAMES.SAVINGS_PLAN_TEMPLATES, {
      name: "School Fees",
      description: "Term savings",
      default_target_kobo: 150_000n,
      duration_days: 45,
      interest_rate: 5,
      automation_type: "weekly",
      is_active: true,
      created_at: 2,
    });
    expect(created.name).toBe("School Fees");
    expect(patch).toHaveBeenCalledWith("template-1", { is_active: false });
    expect(updated.is_active).toBe(false);
  });

  it("preserves explicit undefined fields when clearing template values", async () => {
    const template = {
      _id: "template-1",
      name: "Japa",
      description: "Relocation goal",
      default_target_kobo: 100_000n,
      duration_days: 30,
      interest_rate: 0,
      automation_type: "weekly",
      is_active: true,
      created_at: 1,
    };
    const get = vi
      .fn()
      .mockResolvedValueOnce(template)
      .mockResolvedValueOnce({
        ...template,
        description: undefined,
        automation_type: undefined,
      });
    const patch = vi.fn().mockResolvedValue(undefined);
    const ctx = {
      db: {
        get,
        patch,
      },
    } as any;

    const repo = createConvexSavingsPlanTemplateRepository(ctx);
    const updated = await repo.update("template-1", {
      description: undefined,
      automation_type: undefined,
    });

    expect(patch).toHaveBeenCalledWith("template-1", {
      description: undefined,
      automation_type: undefined,
    });
    expect(updated.description).toBeUndefined();
    expect(updated.automation_type).toBeUndefined();
  });

  it("throws when updateMetadata is called for a missing transaction", async () => {
    const get = vi.fn().mockResolvedValue(null);
    const patch = vi.fn();
    const ctx = {
      db: {
        get,
        patch,
      },
    } as any;

    const repo = createConvexTransactionWriteRepository(ctx);
    const updateMetadataPromise = repo.updateMetadata("tx-404" as never, {
      source: "test",
    });

    await expect(updateMetadataPromise).rejects.toBeInstanceOf(DomainError);
    await expect(updateMetadataPromise).rejects.toMatchObject({
      code: "transaction_not_found",
    });
    expect(get).toHaveBeenCalledWith("tx-404");
    expect(patch).not.toHaveBeenCalled();
  });

  it("treats withdrawals with missing legacy method as bank transfer", async () => {
    const get = vi.fn().mockResolvedValue({
      _id: "withdrawal-1",
      status: "pending",
      method: undefined,
    });
    const ctx = {
      db: {
        get,
      },
    } as any;

    const repo = createConvexWithdrawalRepository(ctx);
    const result = await repo.findById("withdrawal-1" as never);

    expect(result).toMatchObject({
      _id: "withdrawal-1",
      status: "pending",
      method: WithdrawalMethod.BANK_TRANSFER,
      reference: "legacy_withdrawal-1",
    });
  });

  it("uses an explicit createdAt when recording risk events", async () => {
    const insert = vi.fn().mockResolvedValue("event-1");
    const ctx = {
      db: {
        insert,
      },
    } as any;

    const service = createConvexRiskEventService(ctx);

    await service.record({
      userId: "user-1" as never,
      scope: RiskHoldScope.WITHDRAWALS,
      eventType: RiskEventType.HOLD_PLACED,
      severity: RiskSeverity.WARNING,
      message: "hold placed",
      actorAdminId: "admin-1" as never,
      createdAt: 1234567890,
    });

    expect(insert).toHaveBeenCalledWith(TABLE_NAMES.RISK_EVENTS, {
      user_id: "user-1",
      scope: RiskHoldScope.WITHDRAWALS,
      event_type: RiskEventType.HOLD_PLACED,
      severity: RiskSeverity.WARNING,
      message: "hold placed",
      details: undefined,
      actor_admin_id: "admin-1",
      created_at: 1234567890,
    });
  });

  it("queries latest risk events by the user+created_at index", async () => {
    const take = vi.fn().mockResolvedValue([
      {
        event_type: RiskEventType.HOLD_PLACED,
        severity: RiskSeverity.WARNING,
        message: "latest event",
        created_at: 999,
      },
    ]);
    const order = vi.fn(() => ({ take }));
    const withIndex = vi.fn((_indexName: string, _predicate: unknown) => ({
      order,
    }));
    const query = vi.fn((_tableName: string) => ({ withIndex }));
    const ctx = {
      db: {
        query,
      },
    } as any;

    const repo = createConvexRiskEventRepository(ctx);
    const result = await repo.findLatestByUserId("user-1" as never);

    expect(query).toHaveBeenCalledWith(TABLE_NAMES.RISK_EVENTS);
    expect(withIndex).toHaveBeenCalledTimes(1);
    expect(withIndex.mock.calls[0]?.[0]).toBe("by_user_id_and_created_at");
    const eq = vi.fn().mockReturnValue("predicate");
    const predicate = withIndex.mock.calls[0]?.[1] as
      | ((q: { eq: (field: string, value: string) => string }) => string)
      | undefined;
    expect(predicate?.({ eq } as never)).toBe("predicate");
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(order).toHaveBeenCalledWith("desc");
    expect(result).toEqual({
      event_type: RiskEventType.HOLD_PLACED,
      severity: RiskSeverity.WARNING,
      message: "latest event",
      created_at: 999,
    });
  });

  it("rejects risk hold create and release without a mutation-capable context", async () => {
    const ctx = {
      db: {
        query: vi.fn(),
      },
    } as any;

    const repo = createConvexRiskHoldRepository(ctx);

    await expect(
      repo.create({
        user_id: "user-1" as never,
        scope: RiskHoldScope.WITHDRAWALS,
        status: RiskHoldStatus.ACTIVE,
        reason: "manual review",
        placed_by_admin_id: "admin-1" as never,
        placed_at: 1,
      }),
    ).rejects.toMatchObject({
      code: "risk_hold_mutation_context_required",
    });

    await expect(
      repo.release("hold-1" as never, "admin-1" as never, 2),
    ).rejects.toMatchObject({
      code: "risk_hold_mutation_context_required",
    });
  });
});
