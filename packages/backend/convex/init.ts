import { Crons } from "@convex-dev/crons";

import { internalAction } from "./_generated/server";
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
