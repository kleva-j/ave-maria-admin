import type { MutationCtx, QueryCtx } from "./_generated/server";

import type {
  AdminUserId,
  TransactionId,
  UserId,
  UserSavingsPlan,
  UserSavingsPlanId,
} from "./types";

import { DomainError, TransactionSource, TxnType } from "@avm-daily/domain";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";

import { createConvexTransactionReadRepository } from "./adapters/transactionAdapters";
import { createConvexAuditLogService } from "./adapters/auditLogAdapter";
import { internalMutation, mutation, query } from "./_generated/server";
import { createConvexUserRepository } from "./adapters/userAdapters";
import { TABLE_NAMES, planStatus, txnType } from "./shared";
import { postTransactionEntry } from "./transactions";
import { getAdminUser, getUser } from "./utils";

import {
  createRecordSavingsPlanContributionUseCase,
  createUpdateSavingsPlanSettingsUseCase,
  createResumeSavingsPlanUseCase,
  createCreateSavingsPlanUseCase,
  createCloseSavingsPlanUseCase,
  createPauseSavingsPlanUseCase,
} from "@avm-daily/application/use-cases";

import {
  createConvexSavingsPlanRepository,
  createConvexSavingsPlanTemplateRepository,
} from "./adapters/savingsPlanAdapters";

import { syncSavingsPlanInsert, syncSavingsPlanUpdate } from "./aggregateHelpers";

import { buildSavingsPlanSummary, normalizeOptionalString, todayIsoDate } from "./savingsPlanRules";

const templateSnapshotValidator = v.object({
  name: v.string(),
  description: v.optional(v.string()),
  duration_days: v.number(),
  interest_rate: v.number(),
  automation_type: v.optional(v.string()),
  default_target_kobo: v.int64(),
});

const savingsPlanSummaryValidator = v.object({
  _id: v.id("user_savings_plans"),
  _creationTime: v.number(),
  user_id: v.id("users"),
  template_id: v.id("savings_plan_templates"),
  custom_target_kobo: v.int64(),
  current_amount_kobo: v.int64(),
  start_date: v.string(),
  end_date: v.string(),
  status: planStatus,
  automation_enabled: v.boolean(),
  metadata: v.optional(v.any()),
  created_at: v.number(),
  updated_at: v.number(),
  template_snapshot: v.optional(templateSnapshotValidator),
  progress_percentage: v.number(),
  remaining_amount_kobo: v.int64(),
  is_overdue: v.boolean(),
  days_to_end: v.optional(v.number()),
  days_overdue: v.optional(v.number()),
});

const paginatedSavingsPlansValidator = v.object({
  page: v.array(savingsPlanSummaryValidator),
  continueCursor: v.union(v.string(), v.null()),
  isDone: v.boolean(),
});

const contributionResultValidator = v.object({
  transaction_id: v.id("transactions"),
  user_id: v.id("users"),
  user_plan_id: v.id("user_savings_plans"),
  type: txnType,
  amount_kobo: v.int64(),
  reference: v.string(),
  created_at: v.number(),
  idempotent: v.boolean(),
});

function toConvexError(error: unknown): never {
  if (error instanceof DomainError) {
    throw new ConvexError(error.message);
  }

  throw error;
}

function asObject(value: unknown, fieldName = "metadata") {
  if (value === undefined) {
    return {};
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ConvexError(`${fieldName} must be an object`);
  }

  return { ...value };
}

function toDomainPlan(plan: UserSavingsPlan) {
  return {
    _id: String(plan._id),
    user_id: String(plan.user_id),
    template_id: String(plan.template_id),
    custom_target_kobo: plan.custom_target_kobo,
    current_amount_kobo: plan.current_amount_kobo,
    start_date: plan.start_date,
    end_date: plan.end_date,
    status: plan.status,
    automation_enabled: plan.automation_enabled,
    metadata: plan.metadata,
    created_at: plan.created_at,
    updated_at: plan.updated_at,
  };
}

function serializePlanSummary(plan: UserSavingsPlan, today = todayIsoDate()) {
  const summary = buildSavingsPlanSummary(toDomainPlan(plan), today);

  return {
    ...plan,
    template_snapshot: summary.template_snapshot
      ? {
          ...summary.template_snapshot,
          default_target_kobo: summary.template_snapshot.default_target_kobo,
        }
      : undefined,
    progress_percentage: summary.progress_percentage,
    remaining_amount_kobo: summary.remaining_amount_kobo,
    is_overdue: summary.is_overdue,
    days_to_end: summary.days_to_end,
    days_overdue: summary.days_overdue,
  };
}

function buildContributionResult(params: {
  transactionId: TransactionId | string;
  userId: UserId;
  planId: UserSavingsPlanId;
  amountKobo: bigint;
  reference: string;
  createdAt: number;
  idempotent: boolean;
}) {
  return {
    transaction_id: params.transactionId as TransactionId,
    user_id: params.userId,
    user_plan_id: params.planId,
    type: TxnType.CONTRIBUTION,
    amount_kobo: params.amountKobo,
    reference: params.reference,
    created_at: params.createdAt,
    idempotent: params.idempotent,
  };
}

function normalizeContributionMetadata(params: {
  metadata?: unknown;
  source: TransactionSource;
  actorId?: UserId | AdminUserId;
  channel?: string;
  originReference?: string;
  note?: string;
  reference: string;
}) {
  const metadata = asObject(params.metadata);
  const channel = normalizeOptionalString(params.channel);
  const originReference = normalizeOptionalString(params.originReference ?? params.reference);
  const note = normalizeOptionalString(params.note);

  return {
    ...metadata,
    source: params.source,
    ...(params.actorId ? { actor_id: String(params.actorId) } : {}),
    ...(channel ? { channel } : {}),
    ...(originReference ? { origin_reference: originReference } : {}),
    ...(note ? { note } : {}),
  };
}

async function getPlanDoc(ctx: QueryCtx | MutationCtx, planId: UserSavingsPlanId) {
  return await ctx.db.get(planId);
}

async function getPlanDocOrThrow(ctx: QueryCtx | MutationCtx, planId: UserSavingsPlanId) {
  const plan = await getPlanDoc(ctx, planId);
  if (!plan) {
    throw new ConvexError("Savings plan not found");
  }

  return plan;
}

async function syncUpdatedPlanIfNeeded(
  ctx: MutationCtx,
  before: UserSavingsPlan | null,
  planId: UserSavingsPlanId,
) {
  if (!before) {
    return;
  }

  const after = await ctx.db.get(planId);

  if (!after) return;

  const changed =
    before.current_amount_kobo !== after.current_amount_kobo ||
    before.status !== after.status ||
    before.custom_target_kobo !== after.custom_target_kobo ||
    before.end_date !== after.end_date ||
    before.updated_at !== after.updated_at;

  if (changed) {
    await syncSavingsPlanUpdate(ctx, before, after);
  }
}

function paginatePlans(
  plans: UserSavingsPlan[],
  paginationOpts: { cursor: string | null; numItems: number },
  today = todayIsoDate(),
) {
  const cursor = parsePlanCursor(paginationOpts.cursor);
  const orderedPlans = [...plans].sort(comparePlansBySortKey);
  const startIndex =
    cursor === null ? 0 : orderedPlans.findIndex((plan) => comparePlanToCursor(plan, cursor) > 0);

  const normalizedStartIndex = startIndex === -1 ? orderedPlans.length : startIndex;
  const page = orderedPlans.slice(
    normalizedStartIndex,
    normalizedStartIndex + paginationOpts.numItems,
  );
  const isDone = normalizedStartIndex + page.length >= orderedPlans.length;
  const continueCursor =
    isDone || page.length === 0 ? null : formatPlanCursor(page[page.length - 1]!);

  return {
    page: page.map((plan) => serializePlanSummary(plan, today)),
    continueCursor,
    isDone,
  };
}

function comparePlansBySortKey(
  left: Pick<UserSavingsPlan, "_id" | "created_at">,
  right: Pick<UserSavingsPlan, "_id" | "created_at">,
) {
  if (left.created_at !== right.created_at) {
    return right.created_at - left.created_at;
  }

  return String(right._id).localeCompare(String(left._id));
}

function parsePlanCursor(cursor: string | null) {
  if (cursor === null || cursor.trim() === "") {
    return null;
  }

  const separatorIndex = cursor.indexOf("|");
  if (separatorIndex <= 0 || separatorIndex === cursor.length - 1) {
    throw new ConvexError("Invalid pagination cursor");
  }

  const createdAt = Number.parseInt(cursor.slice(0, separatorIndex), 10);
  const id = cursor.slice(separatorIndex + 1);

  if (!Number.isSafeInteger(createdAt) || id.length === 0) {
    throw new ConvexError("Invalid pagination cursor");
  }

  return { createdAt, id };
}

function comparePlanToCursor(
  plan: Pick<UserSavingsPlan, "_id" | "created_at">,
  cursor: { createdAt: number; id: string },
) {
  if (plan.created_at !== cursor.createdAt) {
    return cursor.createdAt - plan.created_at;
  }

  return cursor.id.localeCompare(String(plan._id));
}

function formatPlanCursor(plan: Pick<UserSavingsPlan, "_id" | "created_at">) {
  return `${plan.created_at}|${String(plan._id)}`;
}

function matchesAdminPlanFilters(
  plan: UserSavingsPlan,
  args: {
    userId?: UserId;
    status?: UserSavingsPlan["status"];
    templateId?: UserSavingsPlan["template_id"];
    overdueOnly?: boolean;
  },
  today: string,
) {
  if (args.userId && plan.user_id !== args.userId) {
    return false;
  }

  if (args.templateId && plan.template_id !== args.templateId) {
    return false;
  }

  if (args.status && plan.status !== args.status) {
    return false;
  }

  if (args.overdueOnly && !serializePlanSummary(plan, today).is_overdue) {
    return false;
  }

  return true;
}

function buildAdminPlansQuery(
  ctx: QueryCtx,
  args: {
    userId?: UserId;
    status?: UserSavingsPlan["status"];
    templateId?: UserSavingsPlan["template_id"];
  },
  cursor: { createdAt: number; id: string } | null,
) {
  const userId = args.userId;
  if (userId !== undefined) {
    return ctx.db
      .query(TABLE_NAMES.USER_SAVINGS_PLANS)
      .withIndex("by_user_id_and_created_at", (q) => {
        const range = q.eq("user_id", userId);
        return cursor ? range.lte("created_at", cursor.createdAt) : range;
      })
      .order("desc");
  }

  const templateId = args.templateId;
  if (templateId !== undefined) {
    return ctx.db
      .query(TABLE_NAMES.USER_SAVINGS_PLANS)
      .withIndex("by_template_id_and_created_at", (q) => {
        const range = q.eq("template_id", templateId);
        return cursor ? range.lte("created_at", cursor.createdAt) : range;
      })
      .order("desc");
  }

  const status = args.status;
  if (status !== undefined) {
    return ctx.db
      .query(TABLE_NAMES.USER_SAVINGS_PLANS)
      .withIndex("by_status_and_created_at", (q) => {
        const range = q.eq("status", status);
        return cursor ? range.lte("created_at", cursor.createdAt) : range;
      })
      .order("desc");
  }

  return ctx.db
    .query(TABLE_NAMES.USER_SAVINGS_PLANS)
    .withIndex("by_created_at", (q) => (cursor ? q.lte("created_at", cursor.createdAt) : q))
    .order("desc");
}

async function recordContributionWorkflow(
  ctx: MutationCtx,
  input: {
    planId: UserSavingsPlanId;
    userId: UserId;
    amountKobo: bigint;
    reference: string;
    metadata?: Record<string, unknown>;
    source: TransactionSource;
    actorId?: UserId | AdminUserId;
  },
) {
  const before = await getPlanDoc(ctx, input.planId);

  try {
    const recordSavingsPlanContribution = createRecordSavingsPlanContributionUseCase({
      savingsPlanRepository: createConvexSavingsPlanRepository(ctx),
      transactionReadRepository: createConvexTransactionReadRepository(ctx),
      postTransaction: async (args) => {
        const result = await postTransactionEntry(ctx, {
          userId: args.userId as UserId,
          userPlanId: args.userPlanId as UserSavingsPlanId | undefined,
          type: args.type,
          amountKobo: args.amountKobo,
          reference: args.reference,
          metadata: args.metadata,
          source: args.source as TransactionSource,
          actorId: args.actorId as UserId | AdminUserId | undefined,
          createdAt: args.createdAt,
          reversalOfTransactionId: args.reversalOfTransactionId as TransactionId | undefined,
        });

        return {
          idempotent: result.idempotent,
          transaction: {
            _id: String(result.transaction._id),
            user_id: String(result.transaction.user_id),
            user_plan_id: result.transaction.user_plan_id
              ? String(result.transaction.user_plan_id)
              : undefined,
            type: result.transaction.type,
            amount_kobo: result.transaction.amount_kobo,
            reference: result.transaction.reference,
            reversal_of_transaction_id: result.transaction.reversal_of_transaction_id
              ? String(result.transaction.reversal_of_transaction_id)
              : undefined,
            reversal_of_reference: result.transaction.reversal_of_reference,
            reversal_of_type: result.transaction.reversal_of_type,
            metadata: asObject(result.transaction.metadata),
            created_at: result.transaction.created_at,
          },
        };
      },
    });

    const result = await recordSavingsPlanContribution({
      ...input,
      planId: String(input.planId),
      userId: String(input.userId),
      source: input.source,
      actorId: input.actorId ? String(input.actorId) : undefined,
    });

    await syncUpdatedPlanIfNeeded(ctx, before, input.planId);

    return buildContributionResult({
      transactionId: result.transaction._id,
      userId: input.userId,
      planId: input.planId,
      amountKobo: result.transaction.amount_kobo,
      reference: result.transaction.reference,
      createdAt: result.transaction.created_at,
      idempotent: result.idempotent,
    });
  } catch (error) {
    toConvexError(error);
  }
}

export const listMine = query({
  args: {},
  returns: v.array(savingsPlanSummaryValidator),
  handler: async (ctx) => {
    const user = await getUser(ctx);
    const today = todayIsoDate();
    const plans = await ctx.db
      .query(TABLE_NAMES.USER_SAVINGS_PLANS)
      .withIndex("by_user_id_and_created_at", (q) => q.eq("user_id", user._id))
      .order("desc")
      .collect();

    return plans.map((plan) => serializePlanSummary(plan, today));
  },
});

export const get = query({
  args: { planId: v.id("user_savings_plans") },
  returns: savingsPlanSummaryValidator,
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const plan = await getPlanDocOrThrow(ctx, args.planId);

    if (plan.user_id !== user._id) {
      throw new ConvexError("Savings plan does not belong to the user");
    }

    return serializePlanSummary(plan);
  },
});

export const create = mutation({
  args: {
    templateId: v.id("savings_plan_templates"),
    customTargetKobo: v.optional(v.int64()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  returns: savingsPlanSummaryValidator,
  handler: async (ctx, args) => {
    const user = await getUser(ctx);

    try {
      const createSavingsPlan = createCreateSavingsPlanUseCase({
        userRepository: createConvexUserRepository(ctx),
        savingsPlanRepository: createConvexSavingsPlanRepository(ctx),
        savingsPlanTemplateRepository: createConvexSavingsPlanTemplateRepository(ctx),
        auditLogService: createConvexAuditLogService(ctx),
      });

      const created = await createSavingsPlan({
        userId: String(user._id),
        templateId: String(args.templateId),
        customTargetKobo: args.customTargetKobo,
        startDate: args.startDate,
        endDate: args.endDate,
      });

      const doc = await getPlanDocOrThrow(ctx, created._id as UserSavingsPlanId);
      await syncSavingsPlanInsert(ctx, doc);
      return serializePlanSummary(doc);
    } catch (error) {
      toConvexError(error);
    }
  },
});

export const pause = mutation({
  args: { planId: v.id("user_savings_plans") },
  returns: savingsPlanSummaryValidator,
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const before = await getPlanDoc(ctx, args.planId);

    try {
      const pauseSavingsPlan = createPauseSavingsPlanUseCase({
        userRepository: createConvexUserRepository(ctx),
        savingsPlanRepository: createConvexSavingsPlanRepository(ctx),
        auditLogService: createConvexAuditLogService(ctx),
      });

      const updated = await pauseSavingsPlan({
        planId: String(args.planId),
        userId: String(user._id),
      });

      await syncUpdatedPlanIfNeeded(ctx, before, args.planId);
      const doc = await getPlanDocOrThrow(ctx, updated._id as UserSavingsPlanId);
      return serializePlanSummary(doc);
    } catch (error) {
      toConvexError(error);
    }
  },
});

export const resume = mutation({
  args: { planId: v.id("user_savings_plans") },
  returns: savingsPlanSummaryValidator,
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const before = await getPlanDoc(ctx, args.planId);

    try {
      const resumeSavingsPlan = createResumeSavingsPlanUseCase({
        userRepository: createConvexUserRepository(ctx),
        savingsPlanRepository: createConvexSavingsPlanRepository(ctx),
        auditLogService: createConvexAuditLogService(ctx),
      });

      const updated = await resumeSavingsPlan({
        planId: String(args.planId),
        userId: String(user._id),
      });

      await syncUpdatedPlanIfNeeded(ctx, before, args.planId);
      const doc = await getPlanDocOrThrow(ctx, updated._id as UserSavingsPlanId);
      return serializePlanSummary(doc);
    } catch (error) {
      toConvexError(error);
    }
  },
});

export const updateSettings = mutation({
  args: {
    planId: v.id("user_savings_plans"),
    customTargetKobo: v.optional(v.int64()),
    endDate: v.optional(v.string()),
  },
  returns: savingsPlanSummaryValidator,
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const before = await getPlanDoc(ctx, args.planId);

    try {
      const updateSavingsPlanSettings = createUpdateSavingsPlanSettingsUseCase({
        userRepository: createConvexUserRepository(ctx),
        savingsPlanRepository: createConvexSavingsPlanRepository(ctx),
        auditLogService: createConvexAuditLogService(ctx),
      });

      const updated = await updateSavingsPlanSettings({
        planId: String(args.planId),
        userId: String(user._id),
        customTargetKobo: args.customTargetKobo,
        endDate: args.endDate,
      });

      await syncUpdatedPlanIfNeeded(ctx, before, args.planId);
      const doc = await getPlanDocOrThrow(ctx, updated._id as UserSavingsPlanId);
      return serializePlanSummary(doc);
    } catch (error) {
      toConvexError(error);
    }
  },
});

export const close = mutation({
  args: { planId: v.id("user_savings_plans") },
  returns: savingsPlanSummaryValidator,
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const before = await getPlanDoc(ctx, args.planId);

    try {
      const closeSavingsPlan = createCloseSavingsPlanUseCase({
        userRepository: createConvexUserRepository(ctx),
        savingsPlanRepository: createConvexSavingsPlanRepository(ctx),
        auditLogService: createConvexAuditLogService(ctx),
      });

      const updated = await closeSavingsPlan({
        planId: String(args.planId),
        userId: String(user._id),
      });

      await syncUpdatedPlanIfNeeded(ctx, before, args.planId);
      const doc = await getPlanDocOrThrow(ctx, updated._id as UserSavingsPlanId);
      return serializePlanSummary(doc);
    } catch (error) {
      toConvexError(error);
    }
  },
});

export const listForAdmin = query({
  args: {
    paginationOpts: paginationOptsValidator,
    userId: v.optional(v.id("users")),
    status: v.optional(planStatus),
    templateId: v.optional(v.id("savings_plan_templates")),
    overdueOnly: v.optional(v.boolean()),
  },
  returns: paginatedSavingsPlansValidator,
  handler: async (ctx, args) => {
    await getAdminUser(ctx);
    const today = todayIsoDate();
    const cursor = parsePlanCursor(args.paginationOpts.cursor);
    let limit = Math.max(args.paginationOpts.numItems * 2, 20);

    while (true) {
      const plans = await buildAdminPlansQuery(
        ctx,
        {
          userId: args.userId,
          templateId: args.templateId,
          status: args.status,
        },
        cursor,
      ).take(limit);

      const filtered = plans.filter((plan) =>
        matchesAdminPlanFilters(
          plan,
          {
            userId: args.userId,
            templateId: args.templateId,
            status: args.status,
            overdueOnly: args.overdueOnly,
          },
          today,
        ),
      );
      const paginated = paginatePlans(filtered, args.paginationOpts, today);

      if (paginated.page.length === args.paginationOpts.numItems || plans.length < limit) {
        return paginated;
      }

      limit *= 2;
    }
  },
});

export const adminRecordContribution = mutation({
  args: {
    planId: v.id("user_savings_plans"),
    amountKobo: v.int64(),
    reference: v.string(),
    note: v.optional(v.string()),
    originReference: v.optional(v.string()),
    channel: v.optional(v.string()),
  },
  returns: contributionResultValidator,
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    const plan = await getPlanDocOrThrow(ctx, args.planId);

    return await recordContributionWorkflow(ctx, {
      userId: plan.user_id,
      planId: plan._id,
      amountKobo: args.amountKobo,
      reference: args.reference,
      metadata: normalizeContributionMetadata({
        source: TransactionSource.ADMIN,
        actorId: admin._id,
        channel: args.channel ?? "admin_console",
        originReference: args.originReference,
        note: args.note,
        reference: args.reference,
      }),
      source: TransactionSource.ADMIN,
      actorId: admin._id,
    });
  },
});

export const recordContribution = internalMutation({
  args: {
    userId: v.id("users"),
    planId: v.id("user_savings_plans"),
    amountKobo: v.int64(),
    reference: v.string(),
    metadata: v.optional(v.any()),
  },
  returns: contributionResultValidator,
  handler: async (ctx, args) => {
    return await recordContributionWorkflow(ctx, {
      userId: args.userId,
      planId: args.planId,
      amountKobo: args.amountKobo,
      reference: args.reference,
      metadata: normalizeContributionMetadata({
        source: TransactionSource.SYSTEM,
        metadata: args.metadata,
        reference: args.reference,
      }),
      source: TransactionSource.SYSTEM,
    });
  },
});
