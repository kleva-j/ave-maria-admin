import {
  createCreateSavingsPlanTemplateUseCase,
  createSetSavingsPlanTemplateActiveStateUseCase,
  createUpdateSavingsPlanTemplateUseCase,
} from "@avm-daily/application/use-cases";
import { DomainError } from "@avm-daily/domain";

import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { createConvexAuditLogService } from "./adapters/auditLogAdapter";
import { createConvexSavingsPlanTemplateRepository } from "./adapters/savingsPlanAdapters";
import type { SavingsPlanTemplateId } from "./types";
import { TABLE_NAMES } from "./shared";
import { getAdminUser } from "./utils";

const savingsPlanTemplateValidator = v.object({
  _id: v.id("savings_plan_templates"),
  _creationTime: v.number(),
  name: v.string(),
  description: v.optional(v.string()),
  default_target_kobo: v.int64(),
  duration_days: v.number(),
  interest_rate: v.number(),
  automation_type: v.optional(v.string()),
  is_active: v.boolean(),
  created_at: v.number(),
});

function toConvexError(error: unknown): never {
  if (error instanceof DomainError) {
    throw new ConvexError(error.message);
  }

  throw error;
}

async function getTemplateDocOrThrow(
  ctx: MutationCtx,
  templateId: SavingsPlanTemplateId,
) {
  const template = await ctx.db.get(templateId);
  if (!template) {
    throw new ConvexError("Savings plan template not found");
  }

  return template;
}

export const listActive = query({
  args: {},
  returns: v.array(savingsPlanTemplateValidator),
  handler: async (ctx) => {
    return await ctx.db
      .query(TABLE_NAMES.SAVINGS_PLAN_TEMPLATES)
      .withIndex("by_is_active_and_created_at", (q) => q.eq("is_active", true))
      .order("desc")
      .collect();
  },
});

export const listForAdmin = query({
  args: {},
  returns: v.array(savingsPlanTemplateValidator),
  handler: async (ctx) => {
    await getAdminUser(ctx);

    const templates = await ctx.db
      .query(TABLE_NAMES.SAVINGS_PLAN_TEMPLATES)
      .collect();

    return templates.sort((a, b) => b.created_at - a.created_at);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    defaultTargetKobo: v.int64(),
    durationDays: v.number(),
    interestRate: v.number(),
    automationType: v.optional(v.string()),
  },
  returns: savingsPlanTemplateValidator,
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);

    try {
      const createSavingsPlanTemplate = createCreateSavingsPlanTemplateUseCase({
        savingsPlanTemplateRepository:
          createConvexSavingsPlanTemplateRepository(ctx),
        auditLogService: createConvexAuditLogService(ctx),
      });

      const created = await createSavingsPlanTemplate({
        ...args,
        actorId: String(admin._id),
      });

      return await getTemplateDocOrThrow(
        ctx,
        created._id as SavingsPlanTemplateId,
      );
    } catch (error) {
      toConvexError(error);
    }
  },
});

export const update = mutation({
  args: {
    templateId: v.id("savings_plan_templates"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    defaultTargetKobo: v.optional(v.int64()),
    durationDays: v.optional(v.number()),
    interestRate: v.optional(v.number()),
    automationType: v.optional(v.string()),
  },
  returns: savingsPlanTemplateValidator,
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);

    try {
      const updateSavingsPlanTemplate = createUpdateSavingsPlanTemplateUseCase({
        savingsPlanTemplateRepository:
          createConvexSavingsPlanTemplateRepository(ctx),
        auditLogService: createConvexAuditLogService(ctx),
      });

      const updated = await updateSavingsPlanTemplate({
        ...args,
        templateId: String(args.templateId),
        actorId: String(admin._id),
      });

      return await getTemplateDocOrThrow(
        ctx,
        updated._id as SavingsPlanTemplateId,
      );
    } catch (error) {
      toConvexError(error);
    }
  },
});

async function setTemplateActiveState(
  ctx: MutationCtx,
  input: {
    templateId: SavingsPlanTemplateId;
    isActive: boolean;
    actorId: string;
  },
) {
  try {
    const setSavingsPlanTemplateActiveState =
      createSetSavingsPlanTemplateActiveStateUseCase({
        savingsPlanTemplateRepository:
          createConvexSavingsPlanTemplateRepository(ctx),
        auditLogService: createConvexAuditLogService(ctx),
      });

    const updated = await setSavingsPlanTemplateActiveState(input);
    return await getTemplateDocOrThrow(
      ctx,
      updated._id as SavingsPlanTemplateId,
    );
  } catch (error) {
    toConvexError(error);
  }
}

export const archive = mutation({
  args: {
    templateId: v.id("savings_plan_templates"),
  },
  returns: savingsPlanTemplateValidator,
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);

    return await setTemplateActiveState(ctx, {
      templateId: args.templateId,
      isActive: false,
      actorId: String(admin._id),
    });
  },
});

export const reactivate = mutation({
  args: {
    templateId: v.id("savings_plan_templates"),
  },
  returns: savingsPlanTemplateValidator,
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);

    return await setTemplateActiveState(ctx, {
      templateId: args.templateId,
      isActive: true,
      actorId: String(admin._id),
    });
  },
});
