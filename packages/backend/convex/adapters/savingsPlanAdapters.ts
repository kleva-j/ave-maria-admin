import type {
  SavingsPlanTemplateRepository,
  SavingsPlanRepository,
} from "@avm-daily/application/ports";

import type {
  SavingsPlanTemplate as SavingsPlanTemplateDomain,
  UserSavingsPlan as UserSavingsPlanDomain,
} from "@avm-daily/domain";

import { DomainError } from "@avm-daily/domain";

import type { MutationCtx } from "../_generated/server";
import type {
  SavingsPlanTemplate as ConvexSavingsPlanTemplate,
  SavingsPlanTemplateId,
  UserSavingsPlanId,
  UserSavingsPlan,
  Context,
  UserId,
} from "../types";

import { TABLE_NAMES } from "../shared";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getInsertDb(ctx: Context): Pick<MutationCtx["db"], "insert"> {
  const mutationDb = ctx.db as Partial<MutationCtx["db"]>;

  if (typeof mutationDb.insert !== "function") {
    throw new DomainError(
      "Savings plan mutations require a mutation context",
      "savings_plan_mutation_context_required",
    );
  }

  return mutationDb as Pick<MutationCtx["db"], "insert">;
}

function getPatchDb(ctx: Context): Pick<MutationCtx["db"], "patch"> {
  const mutationDb = ctx.db as Partial<MutationCtx["db"]>;

  if (typeof mutationDb.patch !== "function") {
    throw new DomainError(
      "Savings plan mutations require a mutation context",
      "savings_plan_mutation_context_required",
    );
  }

  return mutationDb as Pick<MutationCtx["db"], "patch">;
}

function buildPatch<T extends Record<string, unknown>, K extends keyof T>(
  patch: T,
  allowedKeys: readonly K[],
) {
  const nextPatch: Partial<Pick<T, K>> = {};

  for (const key of allowedKeys) {
    const value = patch[key];
    if (value !== undefined) {
      nextPatch[key] = value;
    }
  }

  return nextPatch;
}

function docToSavingsPlan(doc: UserSavingsPlan): UserSavingsPlanDomain {
  return {
    _id: doc._id,
    user_id: doc.user_id,
    template_id: doc.template_id,
    custom_target_kobo: doc.custom_target_kobo,
    current_amount_kobo: doc.current_amount_kobo,
    start_date: doc.start_date,
    end_date: doc.end_date,
    status: doc.status,
    automation_enabled: doc.automation_enabled,
    metadata: isRecord(doc.metadata)
      ? (doc.metadata as Record<string, unknown>)
      : undefined,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  };
}

function docToSavingsPlanTemplate(
  doc: ConvexSavingsPlanTemplate,
): SavingsPlanTemplateDomain {
  return {
    _id: doc._id,
    name: doc.name,
    description: doc.description,
    default_target_kobo: doc.default_target_kobo,
    duration_days: doc.duration_days,
    interest_rate: doc.interest_rate,
    automation_type: doc.automation_type,
    is_active: doc.is_active,
    created_at: doc.created_at,
  };
}

async function findTemplateByName(
  ctx: Context,
  name: string,
): Promise<ConvexSavingsPlanTemplate | null> {
  const docs = await ctx.db
    .query(TABLE_NAMES.SAVINGS_PLAN_TEMPLATES)
    .withIndex("by_name", (q) => q.eq("name", name))
    .take(2);

  if (docs.length > 1) {
    throw new DomainError(
      `Multiple savings plan templates found with name: ${name}`,
      "savings_plan_template_name_invariant_violation",
    );
  }

  return docs[0] ?? null;
}

export function createConvexSavingsPlanRepository(
  ctx: Context,
): SavingsPlanRepository {
  return {
    async findById(
      id: UserSavingsPlanId,
    ): Promise<UserSavingsPlanDomain | null> {
      const doc = await ctx.db.get(id);
      return doc ? docToSavingsPlan(doc) : null;
    },

    async findByUserId(userId: UserId): Promise<UserSavingsPlanDomain[]> {
      const docs = await ctx.db
        .query(TABLE_NAMES.USER_SAVINGS_PLANS)
        .withIndex("by_user_id", (q) => q.eq("user_id", userId as UserId))
        .collect();
      return docs.map(docToSavingsPlan);
    },

    async findByUserIdAndTemplateId(
      userId: UserId,
      templateId: SavingsPlanTemplateId,
    ): Promise<UserSavingsPlanDomain | null> {
      const doc = await ctx.db
        .query(TABLE_NAMES.USER_SAVINGS_PLANS)
        .withIndex("by_user_id_and_template_id", (q) =>
          q
            .eq("user_id", userId as UserId)
            .eq("template_id", templateId as SavingsPlanTemplateId),
        )
        .first();

      return doc ? docToSavingsPlan(doc) : null;
    },

    async create(
      plan: Omit<UserSavingsPlanDomain, "_id">,
    ): Promise<UserSavingsPlanDomain> {
      const mutationDb = getInsertDb(ctx);
      const id = await mutationDb.insert(TABLE_NAMES.USER_SAVINGS_PLANS, {
        user_id: plan.user_id as UserId,
        template_id: plan.template_id as SavingsPlanTemplateId,
        custom_target_kobo: plan.custom_target_kobo,
        current_amount_kobo: plan.current_amount_kobo,
        start_date: plan.start_date,
        end_date: plan.end_date,
        status: plan.status,
        automation_enabled: plan.automation_enabled,
        metadata: plan.metadata,
        created_at: plan.created_at,
        updated_at: plan.updated_at,
      });

      const doc = await ctx.db.get(id);
      if (!doc) {
        throw new DomainError(
          "Failed to create savings plan",
          "savings_plan_create_failed",
        );
      }

      return docToSavingsPlan(doc);
    },

    async update(
      id: UserSavingsPlanId,
      patch: Partial<
        Omit<UserSavingsPlanDomain, "_id" | "user_id" | "created_at">
      >,
    ): Promise<UserSavingsPlanDomain> {
      const existing = await ctx.db.get(id);
      if (!existing) {
        throw new DomainError(
          `UserSavingsPlan not found: ${id}`,
          "user_savings_plan_not_found",
        );
      }

      const mutationDb = getPatchDb(ctx);
      await mutationDb.patch(
        existing._id,
        buildPatch(
          {
            template_id: patch.template_id as SavingsPlanTemplateId | undefined,
            custom_target_kobo: patch.custom_target_kobo,
            current_amount_kobo: patch.current_amount_kobo,
            start_date: patch.start_date,
            end_date: patch.end_date,
            status: patch.status,
            automation_enabled: patch.automation_enabled,
            metadata: patch.metadata,
            updated_at: patch.updated_at,
          },
          [
            "template_id",
            "custom_target_kobo",
            "current_amount_kobo",
            "start_date",
            "end_date",
            "status",
            "automation_enabled",
            "metadata",
            "updated_at",
          ] as const,
        ),
      );

      const updated = await ctx.db.get(existing._id);
      if (!updated) {
        throw new DomainError(
          `UserSavingsPlan not found after update: ${id}`,
          "user_savings_plan_not_found",
        );
      }

      return docToSavingsPlan(updated);
    },

    async updateAmount(
      id: UserSavingsPlanId,
      currentAmountKobo: bigint,
      updatedAt: number,
    ): Promise<void> {
      const existingPlan = await ctx.db.get(id);
      if (!existingPlan) {
        throw new DomainError(
          `UserSavingsPlan not found: ${id}`,
          "user_savings_plan_not_found",
        );
      }

      const mutationDb = getPatchDb(ctx);
      await mutationDb.patch(existingPlan._id, {
        current_amount_kobo: currentAmountKobo,
        updated_at: updatedAt,
      });
    },
  };
}

export function createConvexSavingsPlanTemplateRepository(
  ctx: Context,
): SavingsPlanTemplateRepository {
  return {
    async findById(
      id: SavingsPlanTemplateId,
    ): Promise<SavingsPlanTemplateDomain | null> {
      const doc = await ctx.db.get(id);
      return doc ? docToSavingsPlanTemplate(doc) : null;
    },

    async findByName(name: string): Promise<SavingsPlanTemplateDomain | null> {
      const doc = await findTemplateByName(ctx, name);
      return doc ? docToSavingsPlanTemplate(doc) : null;
    },

    async create(
      template: Omit<SavingsPlanTemplateDomain, "_id">,
    ): Promise<SavingsPlanTemplateDomain> {
      const mutationDb = getInsertDb(ctx);
      const id = await mutationDb.insert(TABLE_NAMES.SAVINGS_PLAN_TEMPLATES, {
        name: template.name,
        description: template.description,
        default_target_kobo: template.default_target_kobo,
        duration_days: template.duration_days,
        interest_rate: template.interest_rate,
        automation_type: template.automation_type,
        is_active: template.is_active,
        created_at: template.created_at,
      });

      const doc = await ctx.db.get(id);
      if (!doc) {
        throw new DomainError(
          "Failed to create savings plan template",
          "savings_plan_template_create_failed",
        );
      }

      return docToSavingsPlanTemplate(doc);
    },

    async update(
      id: SavingsPlanTemplateId,
      patch: Partial<Omit<SavingsPlanTemplateDomain, "_id" | "created_at">>,
    ): Promise<SavingsPlanTemplateDomain> {
      const existing = await ctx.db.get(id);
      if (!existing) {
        throw new DomainError(
          `SavingsPlanTemplate not found: ${id}`,
          "savings_plan_template_not_found",
        );
      }

      const mutationDb = getPatchDb(ctx);
      await mutationDb.patch(
        existing._id,
        buildPatch(
          {
            name: patch.name,
            description: patch.description,
            default_target_kobo: patch.default_target_kobo,
            duration_days: patch.duration_days,
            interest_rate: patch.interest_rate,
            automation_type: patch.automation_type,
            is_active: patch.is_active,
          },
          [
            "name",
            "description",
            "default_target_kobo",
            "duration_days",
            "interest_rate",
            "automation_type",
            "is_active",
          ] as const,
        ),
      );

      const updated = await ctx.db.get(existing._id);
      if (!updated) {
        throw new DomainError(
          `SavingsPlanTemplate not found after update: ${id}`,
          "savings_plan_template_not_found",
        );
      }

      return docToSavingsPlanTemplate(updated);
    },
  };
}
