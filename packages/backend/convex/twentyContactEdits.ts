import { ConvexError, v } from "convex/values";

import { internalMutation, internalQuery, action, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { auditLog } from "./auditLog";
import { RESOURCE_TYPE } from "./shared";
import { enqueueTwentyCrmRecord } from "./twentyCrmOutbox";
import { getAdminUser } from "./utils";

const proposedFields = v.object({
  first_name: v.optional(v.string()),
  last_name: v.optional(v.string()),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
});

export const ingestFromTwenty = internalMutation({
  args: {
    sourceEventId: v.string(),
    twentyPersonId: v.string(),
    workosId: v.string(),
    fields: proposedFields,
  },
  returns: v.object({ accepted: v.boolean() }),
  handler: async (ctx, args) => {
    const existingEvent = await ctx.db
      .query("twenty_crm_contact_edit_requests")
      .withIndex("by_source_event_id", (q) =>
        q.eq("source_event_id", args.sourceEventId),
      )
      .unique();
    if (existingEvent) return { accepted: true };

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", args.workosId))
      .unique();
    if (!user || user.deleted_at !== undefined) return { accepted: false };

    const pending = await ctx.db
      .query("twenty_crm_contact_edit_requests")
      .withIndex("by_workos_id_and_status", (q) =>
        q.eq("workos_id", args.workosId).eq("status", "pending"),
      )
      .first();

    const proposed = { ...(pending?.proposed_fields ?? {}) };

    const currentValues = {
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone,
    };
    
    for (const field of ["first_name", "last_name", "email", "phone"] as const) {
      const value = args.fields[field];
      if (value === undefined) continue;
      if (value.trim() === (currentValues[field] ?? "")) {
        delete proposed[field];
      } else {
        proposed[field] = value.trim();
      }
    }

    if (!Object.keys(proposed).length) {
      if (pending) {
        await ctx.db.patch(pending._id, {
          source_event_id: args.sourceEventId,
          twenty_person_id: args.twentyPersonId,
          status: "stale",
          received_at: Date.now(),
        });
      }
      return { accepted: true };
    }

    if (pending) {
      await ctx.db.patch(pending._id, {
        source_event_id: args.sourceEventId,
        twenty_person_id: args.twentyPersonId,
        proposed_fields: proposed,
        received_at: Date.now(),
      });
    } else {
      await ctx.db.insert("twenty_crm_contact_edit_requests", {
        source_event_id: args.sourceEventId,
        twenty_person_id: args.twentyPersonId,
        workos_id: args.workosId,
        proposed_fields: proposed,
        status: "pending",
        received_at: Date.now(),
      });
    }
    return { accepted: true };
  },
});

export const listPending = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("twenty_crm_contact_edit_requests"),
    workos_id: v.string(),
    proposed_fields: proposedFields,
    received_at: v.number(),
    current_fields: v.object({
      first_name: v.string(),
      last_name: v.string(),
      email: v.optional(v.string()),
      phone: v.string(),
    }),
  })),
  handler: async (ctx) => {
    await getAdminUser(ctx);
    const requests = await ctx.db
      .query("twenty_crm_contact_edit_requests")
      .withIndex("by_status_and_received_at", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(100);
    const rows = await Promise.all(requests.map(async (request) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_workos_id", (q) => q.eq("workosId", request.workos_id))
        .unique();
      return user && user.deleted_at === undefined
        ? {
            _id: request._id,
            workos_id: request.workos_id,
            proposed_fields: request.proposed_fields,
            received_at: request.received_at,
            current_fields: {
              first_name: user.first_name,
              last_name: user.last_name,
              email: user.email,
              phone: user.phone,
            },
          }
        : null;
    }));
    return rows.filter((row) => row !== null);
  },
});

export const _viewer = internalQuery({
  args: {},
  returns: v.object({ _id: v.id("admin_users") }),
  handler: async (ctx) => ({ _id: (await getAdminUser(ctx))._id }),
});

export const _getForReview = internalQuery({
  args: { requestId: v.id("twenty_crm_contact_edit_requests") },
  returns: v.union(
    v.object({
      requestId: v.id("twenty_crm_contact_edit_requests"),
      status: v.string(),
      workosId: v.string(),
      fields: proposedFields,
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) return null;
    return {
      requestId: request._id,
      status: request.status,
      workosId: request.workos_id,
      fields: request.proposed_fields,
    };
  },
});

export const _finishReview = internalMutation({
  args: {
    requestId: v.id("twenty_crm_contact_edit_requests"),
    reviewerId: v.id("admin_users"),
    decision: v.union(v.literal("apply"), v.literal("reject")),
    fields: proposedFields,
    workosId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request || request.status !== "pending") {
      throw new ConvexError("Contact edit request is no longer pending");
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", args.workosId))
      .unique();
    if (!user || user.deleted_at !== undefined) {
      await ctx.db.patch(request._id, {
        status: "stale",
        reviewed_at: Date.now(),
        reviewed_by: args.reviewerId,
      });
      return null;
    }

    const now = Date.now();
    if (args.decision === "apply") {
      const patch: {
        first_name?: string;
        last_name?: string;
        email?: string;
        phone?: string;
        updated_at: number;
      } = { updated_at: now };
      for (const field of ["first_name", "last_name", "email", "phone"] as const) {
        const value = args.fields[field];
        if (value !== undefined) patch[field] = value.trim();
      }
      await auditLog.logChange(ctx, {
        action: "user.contact_details_corrected_from_crm",
        actorId: args.reviewerId,
        resourceType: RESOURCE_TYPE.USERS,
        resourceId: user._id,
        before: {
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          phone: user.phone,
        },
        after: {
          first_name: patch.first_name ?? user.first_name,
          last_name: patch.last_name ?? user.last_name,
          email: patch.email ?? user.email,
          phone: patch.phone ?? user.phone,
        },
        severity: "info",
      });
      await ctx.db.patch(user._id, patch);
    }

    // Restore the authoritative app values in Twenty after either decision.
    // A rejected edit otherwise remains visible until an unrelated source
    // update happens to enqueue this Person again.
    await enqueueTwentyCrmRecord(ctx, "person", String(user._id));

    await ctx.db.patch(request._id, {
      status: args.decision === "apply" ? "applied" : "rejected",
      reviewed_at: now,
      reviewed_by: args.reviewerId,
    });
    return null;
  },
});

export const review = action({
  args: {
    requestId: v.id("twenty_crm_contact_edit_requests"),
    decision: v.union(v.literal("apply"), v.literal("reject")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const reviewer = await ctx.runQuery(internal.twentyContactEdits._viewer, {});
    const request = await ctx.runQuery(internal.twentyContactEdits._getForReview, {
      requestId: args.requestId,
    });
    if (!request || request.status !== "pending") {
      throw new ConvexError("Contact edit request is no longer pending");
    }
    if (args.decision === "apply") {
      const email = request.fields.email?.trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new ConvexError("The proposed email address is invalid");
      }
      const apiKey = process.env.WORKOS_API_KEY;
      if (!apiKey) throw new ConvexError("WORKOS_API_KEY is not configured");
      const workosFields: Record<string, string> = {};
      if (email) workosFields.email = email;
      if (request.fields.first_name !== undefined) workosFields.first_name = request.fields.first_name.trim();
      if (request.fields.last_name !== undefined) workosFields.last_name = request.fields.last_name.trim();
      const response = await fetch(`https://api.workos.com/user_management/users/${request.workosId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(workosFields),
        signal: AbortSignal.timeout(10_000),
      }).catch(() => null);
      if (!response?.ok) {
        throw new ConvexError(`WorkOS profile update failed${response ? ` (HTTP ${response.status})` : " (network error)"}`);
      }
    }
    await ctx.runMutation(internal.twentyContactEdits._finishReview, {
      requestId: args.requestId,
      reviewerId: reviewer._id,
      decision: args.decision,
      fields: request.fields,
      workosId: request.workosId,
    });
    return null;
  },
});
