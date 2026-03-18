import { createFunctionHandle } from "convex/server";

import { internalAction } from "./_generated/server";
import { runReconciliation } from "./transactions";
import { refreshDashboardKpis } from "./kpis";
import { components } from "./_generated/api";
import { auditLog } from "./auditLog";

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
        handle: await createFunctionHandle(refreshDashboardKpis as any),
        schedule: { kind: "interval" as const, ms: 10 * 60 * 1000 },
      },
      {
        name: "run transaction reconciliation",
        handle: await createFunctionHandle(runReconciliation as any),
        schedule: { kind: "interval" as const, ms: 60 * 60 * 1000 },
      },
    ];

    for (const job of cronJobs) {
      const existing = await ctx.runQuery(components.crons.public.get, {
        identifier: { name: job.name },
      });

      if (existing) {
        console.log(`Cron job '${job.name}' is already registered.`);
        continue;
      }

      await ctx.runMutation(components.crons.public.register, {
        name: job.name,
        functionHandle: job.handle,
        schedule: job.schedule,
        args: {},
      });

      console.log(
        `Successfully registered cron job '${job.name}' via the crons component.`,
      );
    }
  },
});
