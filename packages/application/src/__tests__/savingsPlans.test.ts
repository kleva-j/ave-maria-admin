import { describe, expect, it, vi } from "vitest";

import type {
  SavingsPlanTemplateRepository,
  SavingsPlanRepository,
  AuditLogService,
  UserRepository,
} from "../ports/index.js";

import type {
  SavingsPlanTemplate,
  UserSavingsPlan,
  Transaction,
  User,
} from "@avm-daily/domain";

import { DomainError, TransactionSource, TxnType } from "@avm-daily/domain";

import {
  createRecordSavingsPlanContributionUseCase,
  createCreateSavingsPlanTemplateUseCase,
  createUpdateSavingsPlanSettingsUseCase,
  createResumeSavingsPlanUseCase,
  createCreateSavingsPlanUseCase,
  createCloseSavingsPlanUseCase,
  createPauseSavingsPlanUseCase,
} from "../use-cases/index.js";

function createUser(overrides: Partial<User> = {}): User {
  return {
    _id: "user-1",
    email: "user@example.com",
    phone: "+2348000000000",
    total_balance_kobo: 0n,
    savings_balance_kobo: 0n,
    status: "active",
    updated_at: 1,
    ...overrides,
  };
}

function createTemplate(
  overrides: Partial<SavingsPlanTemplate> = {},
): SavingsPlanTemplate {
  return {
    _id: "template-1",
    name: "Japa",
    description: "Relocation goal",
    default_target_kobo: 100_000n,
    duration_days: 30,
    interest_rate: 0,
    automation_type: "weekly",
    is_active: true,
    created_at: 1,
    ...overrides,
  };
}

function createPlan(overrides: Partial<UserSavingsPlan> = {}): UserSavingsPlan {
  return {
    _id: "plan-1",
    user_id: "user-1",
    template_id: "template-1",
    custom_target_kobo: 100_000n,
    current_amount_kobo: 0n,
    start_date: "2026-04-04",
    end_date: "2026-05-04",
    status: "active",
    automation_enabled: false,
    metadata: {},
    created_at: 1,
    updated_at: 1,
    ...overrides,
  };
}

function createUserRepository(users: User[]): UserRepository {
  const store = new Map(users.map((user) => [user._id, { ...user }]));

  return {
    findById: async (id) => {
      const user = store.get(id);
      return user ? { ...user } : null;
    },
    updateBalance: async (
      id,
      totalBalanceKobo,
      savingsBalanceKobo,
      updatedAt,
    ) => {
      const user = store.get(id);
      if (!user) {
        throw new Error(`Unknown user: ${id}`);
      }

      store.set(id, {
        ...user,
        total_balance_kobo: totalBalanceKobo,
        savings_balance_kobo: savingsBalanceKobo,
        updated_at: updatedAt,
      });
    },
  };
}

function createTemplateRepository(
  templates: SavingsPlanTemplate[] = [],
): SavingsPlanTemplateRepository & {
  get: (id: string) => SavingsPlanTemplate | undefined;
} {
  const store = new Map(
    templates.map((template) => [template._id, { ...template }]),
  );
  let counter = templates.length;

  return {
    get: (id) => {
      const template = store.get(id);
      return template ? { ...template } : undefined;
    },
    findById: async (id) => {
      const template = store.get(id);
      return template ? { ...template } : null;
    },
    findByName: async (name) => {
      const template = [...store.values()].find((item) => item.name === name);
      return template ? { ...template } : null;
    },
    create: async (template) => {
      const created = { ...template, _id: `template-${++counter}` };
      store.set(created._id, created);
      return { ...created };
    },
    update: async (id, patch) => {
      const template = store.get(id);
      if (!template) {
        throw new Error(`Unknown template: ${id}`);
      }

      const updated = { ...template, ...patch };
      store.set(id, updated);
      return { ...updated };
    },
  };
}

function createPlanRepository(
  plans: UserSavingsPlan[] = [],
): SavingsPlanRepository & {
  get: (id: string) => UserSavingsPlan | undefined;
} {
  const store = new Map(plans.map((plan) => [plan._id, { ...plan }]));
  let counter = plans.length;

  return {
    get: (id) => {
      const plan = store.get(id);
      return plan ? { ...plan } : undefined;
    },
    findById: async (id) => {
      const plan = store.get(id);
      return plan ? { ...plan } : null;
    },
    findByUserId: async (userId) =>
      [...store.values()]
        .filter((plan) => plan.user_id === userId)
        .map((plan) => ({ ...plan })),
    create: async (plan) => {
      const created = { ...plan, _id: `plan-${++counter}` };
      store.set(created._id, created);
      return { ...created };
    },
    update: async (id, patch) => {
      const plan = store.get(id);
      if (!plan) {
        throw new Error(`Unknown plan: ${id}`);
      }

      const updated = { ...plan, ...patch };
      store.set(id, updated);
      return { ...updated };
    },
    updateAmount: async (id, currentAmountKobo, updatedAt) => {
      const plan = store.get(id);
      if (!plan) {
        throw new Error(`Unknown plan: ${id}`);
      }

      store.set(id, {
        ...plan,
        current_amount_kobo: currentAmountKobo,
        updated_at: updatedAt,
      });
    },
  };
}

function createAuditLogService(): AuditLogService {
  return {
    log: vi.fn(async () => undefined),
    logChange: vi.fn(async () => undefined),
  };
}

describe("savings plan application use cases", () => {
  it("creates templates and rejects duplicate names", async () => {
    const templates = createTemplateRepository([createTemplate()]);
    const auditLogService = createAuditLogService();
    const createTemplateUseCase = createCreateSavingsPlanTemplateUseCase({
      savingsPlanTemplateRepository: templates,
      auditLogService,
    });

    await expect(
      createTemplateUseCase({
        actorId: "admin-1",
        name: "Japa",
        defaultTargetKobo: 200_000n,
        durationDays: 60,
        interestRate: 10,
      }),
    ).rejects.toMatchObject({ code: "savings_plan_template_name_taken" });

    const created = await createTemplateUseCase({
      actorId: "admin-1",
      name: "School Fees",
      description: "New term",
      defaultTargetKobo: 150_000n,
      durationDays: 45,
      interestRate: 5,
      automationType: "weekly",
    });

    expect(created.name).toBe("School Fees");
    expect(created.is_active).toBe(true);
    expect(auditLogService.logChange).toHaveBeenCalledTimes(1);
  });

  it("creates savings plans with template defaults and a template snapshot", async () => {
    const user = createUser();
    const template = createTemplate();
    const userRepository = createUserRepository([user]);
    const planRepository = createPlanRepository();
    const templateRepository = createTemplateRepository([template]);
    const auditLogService = createAuditLogService();

    const createPlanUseCase = createCreateSavingsPlanUseCase({
      userRepository,
      savingsPlanRepository: planRepository,
      savingsPlanTemplateRepository: templateRepository,
      auditLogService,
    });

    const created = await createPlanUseCase({
      userId: user._id,
      templateId: template._id,
      today: "2026-04-04",
    });

    expect(created.custom_target_kobo).toBe(template.default_target_kobo);
    expect(created.start_date).toBe("2026-04-04");
    expect(created.end_date).toBe("2026-05-04");
    expect(created.metadata?.template_snapshot).toMatchObject({
      name: template.name,
      duration_days: template.duration_days,
    });
    expect(auditLogService.logChange).toHaveBeenCalledTimes(1);
  });

  it("rejects plan creation for inactive templates and inactive users", async () => {
    const inactiveUser = createUser({ _id: "user-2", status: "pending_kyc" });
    const inactiveTemplate = createTemplate({ is_active: false });
    const auditLogService = createAuditLogService();

    const createPlanUseCase = createCreateSavingsPlanUseCase({
      userRepository: createUserRepository([inactiveUser]),
      savingsPlanRepository: createPlanRepository(),
      savingsPlanTemplateRepository: createTemplateRepository([
        inactiveTemplate,
      ]),
      auditLogService,
    });

    await expect(
      createPlanUseCase({
        userId: inactiveUser._id,
        templateId: inactiveTemplate._id,
      }),
    ).rejects.toMatchObject({ code: "user_not_active_for_savings_plan" });

    const activeUser = createUser({ _id: "user-3" });
    const createPlanForInactiveTemplate = createCreateSavingsPlanUseCase({
      userRepository: createUserRepository([activeUser]),
      savingsPlanRepository: createPlanRepository(),
      savingsPlanTemplateRepository: createTemplateRepository([
        inactiveTemplate,
      ]),
      auditLogService,
    });

    await expect(
      createPlanForInactiveTemplate({
        userId: activeUser._id,
        templateId: inactiveTemplate._id,
      }),
    ).rejects.toMatchObject({ code: "savings_plan_template_inactive" });
  });

  it("pauses, resumes, and closes plans through explicit lifecycle transitions", async () => {
    const user = createUser();
    const activePlan = createPlan();
    const completedPlan = createPlan({
      _id: "plan-2",
      current_amount_kobo: 100_000n,
    });
    const expiredPlan = createPlan({
      _id: "plan-3",
      current_amount_kobo: 40_000n,
    });
    const userRepository = createUserRepository([user]);
    const planRepository = createPlanRepository([
      activePlan,
      completedPlan,
      expiredPlan,
    ]);
    const auditLogService = createAuditLogService();

    const pause = createPauseSavingsPlanUseCase({
      userRepository,
      savingsPlanRepository: planRepository,
      auditLogService,
    });
    const resume = createResumeSavingsPlanUseCase({
      userRepository,
      savingsPlanRepository: planRepository,
      auditLogService,
    });
    const close = createCloseSavingsPlanUseCase({
      userRepository,
      savingsPlanRepository: planRepository,
      auditLogService,
    });

    const paused = await pause({ planId: activePlan._id, userId: user._id });
    expect(paused.status).toBe("paused");

    const resumed = await resume({ planId: activePlan._id, userId: user._id });
    expect(resumed.status).toBe("active");

    const completed = await close({
      planId: completedPlan._id,
      userId: user._id,
    });
    expect(completed.status).toBe("completed");

    const expired = await close({
      planId: expiredPlan._id,
      userId: user._id,
    });
    expect(expired.status).toBe("expired");
  });

  it("rejects targets below the current amount when updating plan settings", async () => {
    const user = createUser();
    const plan = createPlan({ current_amount_kobo: 80_000n });
    const updateSettings = createUpdateSavingsPlanSettingsUseCase({
      userRepository: createUserRepository([user]),
      savingsPlanRepository: createPlanRepository([plan]),
      auditLogService: createAuditLogService(),
    });

    await expect(
      updateSettings({
        planId: plan._id,
        userId: user._id,
        customTargetKobo: 70_000n,
      }),
    ).rejects.toMatchObject({
      code: "savings_plan_target_below_current_amount",
    });
  });

  it("records contributions only for active plans and delegates to the transaction engine", async () => {
    const activePlan = createPlan();
    const pausedPlan = createPlan({ _id: "plan-2", status: "paused" });
    const postTransaction = vi.fn(
      async (): Promise<{ transaction: Transaction; idempotent: boolean }> => ({
        transaction: {
          _id: "tx-1",
          user_id: activePlan.user_id,
          user_plan_id: activePlan._id,
          type: TxnType.CONTRIBUTION,
          amount_kobo: 25_000n,
          reference: "ref-1",
          metadata: { channel: "admin_console" },
          created_at: 10,
        },
        idempotent: false,
      }),
    );

    const planRepository = createPlanRepository([activePlan, pausedPlan]);
    const recordContribution = createRecordSavingsPlanContributionUseCase({
      savingsPlanRepository: planRepository,
      postTransaction,
    });

    await expect(
      recordContribution({
        userId: pausedPlan.user_id,
        planId: pausedPlan._id,
        amountKobo: 10_000n,
        reference: "ref-paused",
        source: TransactionSource.ADMIN,
      }),
    ).rejects.toBeInstanceOf(DomainError);

    const result = await recordContribution({
      userId: activePlan.user_id,
      planId: activePlan._id,
      amountKobo: 25_000n,
      reference: "ref-1",
      metadata: { channel: "admin_console" },
      source: TransactionSource.ADMIN,
      actorId: "admin-1",
    });

    expect(postTransaction).toHaveBeenCalledWith({
      userId: activePlan.user_id,
      userPlanId: activePlan._id,
      type: TxnType.CONTRIBUTION,
      amountKobo: 25_000n,
      reference: "ref-1",
      metadata: { channel: "admin_console" },
      source: TransactionSource.ADMIN,
      actorId: "admin-1",
    });
    expect(result.transaction.reference).toBe("ref-1");
  });
});
