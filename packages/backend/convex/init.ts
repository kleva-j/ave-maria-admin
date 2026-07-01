import { Crons } from "@convex-dev/crons";
import { v } from "convex/values";

import { RESOURCE_TYPE, TABLE_NAMES, UserStatus, AdminRole } from "./shared";
import { internalAction, internalMutation } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { auditLog } from "./auditLog";

const crons = new Crons(components.crons);

/**
 * Idempotent setup function to register dynamic cron jobs via the crons component.
 * Run this once after deployment or during initial setup:
 * npx convex run init:setup
 */
export const setup = internalAction({
  args: {},
  handler: async (ctx) => {
    await auditLog.log(ctx, {
      action: "system.setup_executed",
      severity: "info",
    });

    const cronJobs = [
      {
        name: "refresh dashboard kpis",
        fn: internal.kpis.refreshDashboardKpis,
        schedule: { kind: "interval" as const, ms: 10 * 60 * 1000 }, // 10 minutes
      },
      {
        name: "run transaction reconciliation",
        fn: internal.transactions.runReconciliation,
        schedule: { kind: "interval" as const, ms: 60 * 60 * 1000 }, // 1 hour
      },
      {
        name: "evaluate admin alert conditions",
        fn: internal.adminAlerts.evaluateQueueConditions,
        schedule: { kind: "interval" as const, ms: 5 * 60 * 1000 }, // 5 minutes
      },
      {
        name: "sweep admin alert outbox",
        fn: internal.adminAlerts.processPendingEvents,
        schedule: { kind: "interval" as const, ms: 60 * 1000 }, // 1 minute
      },
      {
        name: "check admin role drift",
        fn: internal.adminSync.checkAdminRoleDrift,
        schedule: { kind: "interval" as const, ms: 60 * 60 * 1000 }, // 1 hour
      },
      {
        name: "sweep user notifications",
        fn: internal.userNotifications.sweep,
        schedule: { kind: "interval" as const, ms: 60 * 1000 }, // 1 minute
      },
    ];

    for (const job of cronJobs) {
      const existing = await crons.get(ctx, { name: job.name });

      if (existing) {
        console.log(`Cron job '${job.name}' is already registered.`);
        continue;
      }

      await crons.register(ctx, job.schedule, job.fn, {}, job.name);

      console.log(
        `Successfully registered cron job '${job.name}' via the crons component.`,
      );
    }
  },
});

// ============================================================================
// Super-admin bootstrap
// ============================================================================

/**
 * One-time bootstrap: create (or promote) the first super-admin admin_users record.
 *
 * This action is only callable via the Convex CLI — it cannot be invoked from
 * the browser. It is safe to run multiple times (idempotent).
 *
 * Usage (run once after deployment):
 *   npx convex run init:seedSuperAdmin
 *
 * Prerequisites:
 *   - SUPER_ADMIN_EMAIL must be set as a Convex environment variable:
 *       npx convex env set SUPER_ADMIN_EMAIL you@example.com
 *   - WORKOS_API_KEY must be set as a Convex environment variable.
 *   - A WorkOS user with that email must already exist (sign up via the app
 *     or create manually in the WorkOS dashboard).
 */
export const seedSuperAdmin = internalAction({
  args: {},
  handler: async (ctx) => {
    const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
    if (!email) {
      throw new Error(
        "SUPER_ADMIN_EMAIL env var is not set. " +
          "Run: npx convex env set SUPER_ADMIN_EMAIL you@example.com",
      );
    }

    const apiKey = process.env.WORKOS_API_KEY;
    if (!apiKey) {
      throw new Error("WORKOS_API_KEY env var is not set.");
    }

    // Look up the existing WorkOS user by email.
    const resp = await fetch(
      `https://api.workos.com/user_management/users?email=${encodeURIComponent(email)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!resp.ok) {
      throw new Error(`WorkOS user lookup failed (HTTP ${resp.status})`);
    }

    const body = (await resp.json()) as {
      data?: { id: string; first_name?: string; last_name?: string }[];
    };
    const workosUser = body.data?.[0];

    if (!workosUser) {
      throw new Error(
        `No WorkOS user found for "${email}". ` +
          "Create the user in the WorkOS dashboard (or have them sign up) first.",
      );
    }

    await ctx.runMutation(internal.init._upsertSuperAdmin, {
      workosId: workosUser.id,
      email,
      first_name: workosUser.first_name ?? "",
      last_name: workosUser.last_name ?? "",
    });
  },
});

/**
 * Internal mutation used exclusively by seedSuperAdmin.
 * Upserts an admin_users row with the super-admin role:
 *   - If a row already exists with super-admin role → no-op.
 *   - If a row exists with a lesser role → promotes to super-admin.
 *   - Otherwise → inserts a fresh row with an audit log entry.
 */
export const _upsertSuperAdmin = internalMutation({
  args: {
    workosId: v.string(),
    email: v.string(),
    first_name: v.string(),
    last_name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query(TABLE_NAMES.ADMIN_USERS)
      .withIndex("by_workos_id", (q) => q.eq("workosId", args.workosId))
      .unique();

    if (existing) {
      if (existing.role === AdminRole.SUPER_ADMIN && existing.status === UserStatus.ACTIVE && existing.deleted_at === undefined) {
        console.log(
          `Super-admin already active for workosId=${existing.workosId} — nothing to do.`,
        );
      } else {
        // Promote role and reactivate if suspended/soft-deleted.
        await ctx.db.patch(existing._id, {
          role: AdminRole.SUPER_ADMIN,
          status: UserStatus.ACTIVE,
          deleted_at: undefined,
        });
        await auditLog.log(ctx, {
          action: "admin_user.promoted_to_super_admin",
          resourceType: RESOURCE_TYPE.ADMIN_USER,
          resourceId: existing._id,
          severity: "warning",
          metadata: {
            workos_id: existing.workosId,
            previous_role: existing.role,
            previous_status: existing.status,
          },
        });
        console.log(
          `Promoted/reactivated admin workosId=${existing.workosId} to super-admin (was role="${existing.role}", status="${existing.status}").`,
        );
      }
      return null;
    }

    const now = Date.now();
    const id = await ctx.db.insert(TABLE_NAMES.ADMIN_USERS, {
      workosId: args.workosId,
      email: args.email,
      first_name: args.first_name,
      last_name: args.last_name,
      role: AdminRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      created_at: now,
      last_login_at: null,
    });

    await auditLog.log(ctx, {
      action: "admin_user.seeded",
      resourceType: RESOURCE_TYPE.ADMIN_USER,
      resourceId: id,
      severity: "warning",
      metadata: { email: args.email, role: AdminRole.SUPER_ADMIN },
    });

    console.log(`Super-admin seeded: id=${String(id)}, workosId=${args.workosId}.`);
    return null;
  },
});
