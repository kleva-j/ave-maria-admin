import type { MutationCtx, QueryCtx } from "./_generated/server";
import type {
  UserSavingsPlanId,
  UserSavingsPlan,
  AdminUserId,
  UserId,
} from "./types";

import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";
import { getAdminUser, getUser, getUserWithStatus } from "./utils";
import { postTransactionEntry } from "./transactions";
import { auditLog } from "./auditLog";

import {
  syncSavingsPlanInsert,
  syncSavingsPlanUpdate,
} from "./aggregateHelpers";

import {
  TransactionSource,
  RESOURCE_TYPE,
  TABLE_NAMES,
  UserStatus,
  planStatus,
  PlanStatus,
  TxnType,
  txnType,
} from "./shared";

import {
  type SavingsPlanSummary,
  type TemplateSnapshot,
  assertPlanCanAcceptContribution,
  normalizeOptionalString,
  buildSavingsPlanSummary,
  createTemplateSnapshot,
  determineClosedStatus,
  assertPlanIsMutable,
  validateTargetKobo,
  resolvePlanDates,
  todayIsoDate,
} from "./savingsPlanRules";

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
  continueCursor: v.string(),
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

function asObject(value: unknown, fieldName = "metadata") {
  if (value === undefined) {
    return {};
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ConvexError(`${fieldName} must be an object`);
  }

  return { ...value };
}

function serializePlanSummary(plan: SavingsPlanSummary) {
  const templateSnapshot = plan.template_snapshot
    ? ({
        ...plan.template_snapshot,
        default_target_kobo: plan.template_snapshot.default_target_kobo,
      } satisfies TemplateSnapshot)
    : undefined;

  return {
    ...plan,
    template_snapshot: templateSnapshot,
  };
}

function buildContributionResult(params: {
  transactionId: UserSavingsPlanId | string;
  userId: UserId;
  planId: UserSavingsPlanId;
  amountKobo: bigint;
  reference: string;
  createdAt: number;
  idempotent: boolean;
}) {
  return {
    transaction_id: params.transactionId as any,
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

  return {
    ...metadata,
    source: params.source,
    ...(params.actorId ? { actor_id: String(params.actorId) } : {}),
    ...(normalizeOptionalString(params.channel)
      ? { channel: normalizeOptionalString(params.channel) }
      : {}),
    ...(normalizeOptionalString(params.originReference ?? params.reference)
      ? {
          origin_reference: normalizeOptionalString(
            params.originReference ?? params.reference,
          ),
        }
      : {}),
    ...(normalizeOptionalString(params.note)
      ? { note: normalizeOptionalString(params.note) }
      : {}),
  };
}

async function getPlanOrThrow(
  ctx: QueryCtx | MutationCtx,
  planId: UserSavingsPlanId,
) {
  const plan = await ctx.db.get(planId);
  if (!plan) {
    throw new ConvexError("Savings plan not found");
  }

  return plan;
}

async function getOwnedPlanOrThrow(
  ctx: QueryCtx | MutationCtx,
  planId: UserSavingsPlanId,
  userId: UserId,
) {
  const plan = await getPlanOrThrow(ctx, planId);
  if (plan.user_id !== userId) {
    throw new ConvexError("Savings plan does not belong to the user");
  }

  return plan;
}

async function patchPlanAndSync(
  ctx: MutationCtx,
  existing: UserSavingsPlan,
  patch: Partial<UserSavingsPlan>,
) {
  await ctx.db.patch(existing._id, patch);
  const updated = await ctx.db.get(existing._id);

  if (!updated) {
    throw new ConvexError("Savings plan not found after update");
  }

  await syncSavingsPlanUpdate(ctx, existing, updated);
  return updated;
}

function paginatePlans(
  plans: SavingsPlanSummary[],
  paginationOpts: { cursor: string | null; numItems: number },
) {
  const offset =
    paginationOpts.cursor === null
      ? 0
      : Number.parseInt(paginationOpts.cursor, 10);

  if (Number.isNaN(offset) || offset < 0) {
    throw new ConvexError("Invalid pagination cursor");
  }

  const page = plans.slice(offset, offset + paginationOpts.numItems);
  const nextOffset = offset + page.length;

  return {
    page: page.map(serializePlanSummary),
    continueCursor: String(nextOffset),
    isDone: nextOffset >= plans.length,
  };
}

async function recordContributionEntry(
  ctx: MutationCtx,
  params: {
    userId: UserId;
    planId: UserSavingsPlanId;
    amountKobo: bigint;
    reference: string;
    metadata?: unknown;
    source: TransactionSource;
    actorId?: UserId | AdminUserId;
  },
) {
  validateTargetKobo(params.amountKobo, "Contribution amount");
  const plan = await getPlanOrThrow(ctx, params.planId);

  if (plan.user_id !== params.userId) {
    throw new ConvexError("Savings plan does not belong to the user");
  }

  assertPlanCanAcceptContribution(plan);

  const result = await postTransactionEntry(ctx, {
    userId: params.userId,
    userPlanId: params.planId,
    type: TxnType.CONTRIBUTION,
    amountKobo: params.amountKobo,
    reference: params.reference,
    metadata: params.metadata,
    source: params.source,
    actorId: params.actorId,
  });

  const updatedPlan = await ctx.db.get(plan._id);
  if (!updatedPlan) {
    throw new ConvexError("Savings plan not found after contribution");
  }

  if (updatedPlan.current_amount_kobo !== plan.current_amount_kobo) {
    await syncSavingsPlanUpdate(ctx, plan, updatedPlan);
  }

  return buildContributionResult({
    transactionId: result.transaction._id,
    userId: params.userId,
    planId: params.planId,
    amountKobo: result.transaction.amount_kobo,
    reference: result.transaction.reference,
    createdAt: result.transaction.created_at,
    idempotent: result.idempotent,
  });
}

export const listMine = query({
  args: {},
  returns: v.array(savingsPlanSummaryValidator),
  handler: async (ctx) => {
    const user = await getUser(ctx);
    const today = todayIsoDate();
    const plans = await ctx.db
      .query(TABLE_NAMES.USER_SAVINGS_PLANS)
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .collect();

    return plans
      .sort((a, b) => b.created_at - a.created_at)
      .map((plan) =>
        serializePlanSummary(buildSavingsPlanSummary(plan, today)),
      );
  },
});

export const get = query({
  args: { planId: v.id("user_savings_plans") },
  returns: savingsPlanSummaryValidator,
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const plan = await getOwnedPlanOrThrow(ctx, args.planId, user._id);
    return serializePlanSummary(buildSavingsPlanSummary(plan));
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
    const user = await getUserWithStatus(ctx, UserStatus.ACTIVE);
    const template = await ctx.db.get(args.templateId);

    if (!template) {
      throw new ConvexError("Savings plan template not found");
    }

    if (!template.is_active) {
      throw new ConvexError("Savings plan template is not active");
    }

    const targetKobo = validateTargetKobo(
      args.customTargetKobo ?? template.default_target_kobo,
      "Savings plan target",
    );
    const { startDate, endDate } = resolvePlanDates({
      durationDays: template.duration_days,
      startDate: args.startDate,
      endDate: args.endDate,
    });
    const now = Date.now();

    const id = await ctx.db.insert(TABLE_NAMES.USER_SAVINGS_PLANS, {
      user_id: user._id,
      template_id: template._id,
      custom_target_kobo: targetKobo,
      current_amount_kobo: 0n,
      start_date: startDate,
      end_date: endDate,
      status: PlanStatus.ACTIVE,
      automation_enabled: false,
      metadata: {
        template_snapshot: createTemplateSnapshot(template),
      },
      created_at: now,
      updated_at: now,
    });
    const plan = await ctx.db.get(id);

    if (!plan) {
      throw new ConvexError("Failed to create savings plan");
    }

    await syncSavingsPlanInsert(ctx, plan);
    await auditLog.logChange(ctx, {
      action: "savings_plan.created",
      actorId: user._id,
      resourceType: RESOURCE_TYPE.SAVINGS_PLANS,
      resourceId: id,
      before: {},
      after: {
        template_id: String(plan.template_id),
        custom_target_kobo: plan.custom_target_kobo.toString(),
        start_date: plan.start_date,
        end_date: plan.end_date,
        status: plan.status,
      },
      severity: "info",
    });

    return serializePlanSummary(buildSavingsPlanSummary(plan));
  },
});

export const pause = mutation({
  args: { planId: v.id("user_savings_plans") },
  returns: savingsPlanSummaryValidator,
  handler: async (ctx, args) => {
    const user = await getUserWithStatus(ctx, UserStatus.ACTIVE);
    const plan = await getOwnedPlanOrThrow(ctx, args.planId, user._id);

    if (plan.status !== PlanStatus.ACTIVE) {
      throw new ConvexError("Only active savings plans can be paused");
    }

    const updated = await patchPlanAndSync(ctx, plan, {
      status: PlanStatus.PAUSED,
      updated_at: Date.now(),
    });

    await auditLog.logChange(ctx, {
      action: "savings_plan.paused",
      actorId: user._id,
      resourceType: RESOURCE_TYPE.SAVINGS_PLANS,
      resourceId: plan._id,
      before: { status: plan.status },
      after: { status: updated.status },
      severity: "info",
    });

    return serializePlanSummary(buildSavingsPlanSummary(updated));
  },
});

export const resume = mutation({
  args: { planId: v.id("user_savings_plans") },
  returns: savingsPlanSummaryValidator,
  handler: async (ctx, args) => {
    const user = await getUserWithStatus(ctx, UserStatus.ACTIVE);
    const plan = await getOwnedPlanOrThrow(ctx, args.planId, user._id);

    if (plan.status !== PlanStatus.PAUSED) {
      throw new ConvexError("Only paused savings plans can be resumed");
    }

    const updated = await patchPlanAndSync(ctx, plan, {
      status: PlanStatus.ACTIVE,
      updated_at: Date.now(),
    });

    await auditLog.logChange(ctx, {
      action: "savings_plan.resumed",
      actorId: user._id,
      resourceType: RESOURCE_TYPE.SAVINGS_PLANS,
      resourceId: plan._id,
      before: { status: plan.status },
      after: { status: updated.status },
      severity: "info",
    });

    return serializePlanSummary(buildSavingsPlanSummary(updated));
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
    const user = await getUserWithStatus(ctx, UserStatus.ACTIVE);
    const plan = await getOwnedPlanOrThrow(ctx, args.planId, user._id);
    assertPlanIsMutable(plan);

    if (args.customTargetKobo === undefined && args.endDate === undefined) {
      throw new ConvexError("No savings plan changes provided");
    }

    const nextTargetKobo =
      args.customTargetKobo === undefined
        ? plan.custom_target_kobo
        : validateTargetKobo(args.customTargetKobo, "Savings plan target");

    if (nextTargetKobo < plan.current_amount_kobo) {
      throw new ConvexError(
        "Savings plan target cannot be below the current saved amount",
      );
    }

    const nextEndDate = args.endDate ?? plan.end_date;
    resolvePlanDates({
      durationDays: 1,
      startDate: plan.start_date,
      endDate: nextEndDate,
      today: plan.start_date,
    });

    const updated = await patchPlanAndSync(ctx, plan, {
      custom_target_kobo: nextTargetKobo,
      end_date: nextEndDate,
      updated_at: Date.now(),
    });

    await auditLog.logChange(ctx, {
      action: "savings_plan.updated",
      actorId: user._id,
      resourceType: RESOURCE_TYPE.SAVINGS_PLANS,
      resourceId: plan._id,
      before: {
        custom_target_kobo: plan.custom_target_kobo.toString(),
        end_date: plan.end_date,
      },
      after: {
        custom_target_kobo: updated.custom_target_kobo.toString(),
        end_date: updated.end_date,
      },
      severity: "info",
    });

    return serializePlanSummary(buildSavingsPlanSummary(updated));
  },
});

export const close = mutation({
  args: { planId: v.id("user_savings_plans") },
  returns: savingsPlanSummaryValidator,
  handler: async (ctx, args) => {
    const user = await getUserWithStatus(ctx, UserStatus.ACTIVE);
    const plan = await getOwnedPlanOrThrow(ctx, args.planId, user._id);
    assertPlanIsMutable(plan);

    const nextStatus = determineClosedStatus(plan);
    const updated = await patchPlanAndSync(ctx, plan, {
      status: nextStatus,
      updated_at: Date.now(),
    });

    await auditLog.logChange(ctx, {
      action: "savings_plan.closed",
      actorId: user._id,
      resourceType: RESOURCE_TYPE.SAVINGS_PLANS,
      resourceId: plan._id,
      before: { status: plan.status },
      after: { status: updated.status },
      severity: nextStatus === PlanStatus.COMPLETED ? "info" : "warning",
    });

    return serializePlanSummary(buildSavingsPlanSummary(updated));
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
    const plans = await ctx.db.query(TABLE_NAMES.USER_SAVINGS_PLANS).collect();

    const filtered = plans
      .filter((plan) => (args.userId ? plan.user_id === args.userId : true))
      .filter((plan) =>
        args.templateId ? plan.template_id === args.templateId : true,
      )
      .filter((plan) => (args.status ? plan.status === args.status : true))
      .map((plan) => buildSavingsPlanSummary(plan, today))
      .filter((plan) => (args.overdueOnly ? plan.is_overdue : true))
      .sort((a, b) => b.created_at - a.created_at);

    return paginatePlans(filtered, args.paginationOpts);
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
    const plan = await getPlanOrThrow(ctx, args.planId);

    return await recordContributionEntry(ctx, {
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
    return await recordContributionEntry(ctx, {
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
