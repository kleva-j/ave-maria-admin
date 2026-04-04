import { ConvexError, v } from "convex/values";

import { RESOURCE_TYPE, TABLE_NAMES } from "./shared";
import { mutation, query } from "./_generated/server";
import { getAdminUser } from "./utils";
import { auditLog } from "./auditLog";

import {
  normalizeOptionalString,
  validateDurationDays,
  validateTemplateName,
  validateInterestRate,
  validateTargetKobo,
} from "./savingsPlanRules";

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

async function ensureTemplateNameAvailable(
  ctx: Parameters<typeof query>[0] extends never ? never : any,
  name: string,
  excludeId?: string,
) {
  const templates = await ctx.db
    .query(TABLE_NAMES.SAVINGS_PLAN_TEMPLATES)
    .withIndex("by_name", (q: any) => q.eq("name", name))
    .collect();

  const duplicate = templates.find(
    (template: any) => String(template._id) !== excludeId,
  );

  if (duplicate) {
    throw new ConvexError(
      "A savings plan template with this name already exists",
    );
  }
}

function normalizeTemplateInput(args: {
  name: string;
  description?: string;
  defaultTargetKobo: bigint;
  durationDays: number;
  interestRate: number;
  automationType?: string;
}) {
  return {
    name: validateTemplateName(args.name),
    description: normalizeOptionalString(args.description),
    default_target_kobo: validateTargetKobo(
      args.defaultTargetKobo,
      "Default target",
    ),
    duration_days: validateDurationDays(args.durationDays),
    interest_rate: validateInterestRate(args.interestRate),
    automation_type: normalizeOptionalString(args.automationType),
  };
}

function templateSnapshot(template: {
  name: string;
  description?: string;
  default_target_kobo: bigint;
  duration_days: number;
  interest_rate: number;
  automation_type?: string;
  is_active: boolean;
  created_at: number;
}) {
  return {
    name: template.name,
    description: template.description ?? null,
    default_target_kobo: template.default_target_kobo.toString(),
    duration_days: template.duration_days,
    interest_rate: template.interest_rate,
    automation_type: template.automation_type ?? null,
    is_active: template.is_active,
    created_at: template.created_at,
  };
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
    const normalized = normalizeTemplateInput(args);
    await ensureTemplateNameAvailable(ctx, normalized.name);

    const id = await ctx.db.insert(TABLE_NAMES.SAVINGS_PLAN_TEMPLATES, {
      ...normalized,
      is_active: true,
      created_at: Date.now(),
    });
    const template = await ctx.db.get(id);

    if (!template) {
      throw new ConvexError("Failed to create savings plan template");
    }

    await auditLog.logChange(ctx, {
      action: "savings_plan_template.created",
      actorId: admin._id,
      resourceType: RESOURCE_TYPE.SAVINGS_PLAN_TEMPLATES,
      resourceId: id,
      before: {},
      after: templateSnapshot(template),
      severity: "info",
    });

    return template;
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
    const existing = await ctx.db.get(args.templateId);

    if (!existing) {
      throw new ConvexError("Savings plan template not found");
    }

    if (
      args.name === undefined &&
      args.description === undefined &&
      args.defaultTargetKobo === undefined &&
      args.durationDays === undefined &&
      args.interestRate === undefined &&
      args.automationType === undefined
    ) {
      throw new ConvexError("No template changes provided");
    }

    const normalized = normalizeTemplateInput({
      name: args.name ?? existing.name,
      description: args.description ?? existing.description,
      defaultTargetKobo: args.defaultTargetKobo ?? existing.default_target_kobo,
      durationDays: args.durationDays ?? existing.duration_days,
      interestRate: args.interestRate ?? existing.interest_rate,
      automationType: args.automationType ?? existing.automation_type,
    });

    if (normalized.name !== existing.name) {
      await ensureTemplateNameAvailable(
        ctx,
        normalized.name,
        String(existing._id),
      );
    }

    await ctx.db.patch(args.templateId, normalized);
    const updated = await ctx.db.get(args.templateId);

    if (!updated) {
      throw new ConvexError("Savings plan template not found after update");
    }

    await auditLog.logChange(ctx, {
      action: "savings_plan_template.updated",
      actorId: admin._id,
      resourceType: RESOURCE_TYPE.SAVINGS_PLAN_TEMPLATES,
      resourceId: args.templateId,
      before: templateSnapshot(existing),
      after: templateSnapshot(updated),
      severity: "info",
    });

    return updated;
  },
});

async function setTemplateActiveState(
  ctx: Parameters<typeof mutation>[0] extends never ? never : any,
  templateId: string,
  shouldBeActive: boolean,
  actorId: string,
) {
  const existing = await ctx.db.get(templateId);
  if (!existing) {
    throw new ConvexError("Savings plan template not found");
  }

  if (existing.is_active === shouldBeActive) {
    return existing;
  }

  await ctx.db.patch(templateId, { is_active: shouldBeActive });
  const updated = await ctx.db.get(templateId);

  if (!updated) {
    throw new ConvexError("Savings plan template not found after update");
  }

  await auditLog.logChange(ctx, {
    action: shouldBeActive
      ? "savings_plan_template.reactivated"
      : "savings_plan_template.archived",
    actorId,
    resourceType: RESOURCE_TYPE.SAVINGS_PLAN_TEMPLATES,
    resourceId: templateId,
    before: templateSnapshot(existing),
    after: templateSnapshot(updated),
    severity: shouldBeActive ? "info" : "warning",
  });

  return updated;
}

export const archive = mutation({
  args: {
    templateId: v.id("savings_plan_templates"),
  },
  returns: savingsPlanTemplateValidator,
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    return await setTemplateActiveState(ctx, args.templateId, false, admin._id);
  },
});

export const reactivate = mutation({
  args: {
    templateId: v.id("savings_plan_templates"),
  },
  returns: savingsPlanTemplateValidator,
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    return await setTemplateActiveState(ctx, args.templateId, true, admin._id);
  },
});
