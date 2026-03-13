import { createFunctionHandle } from "convex/server";

import { internal, components } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { auditLog } from "./auditLog";

/**
 * Idempotent setup function to register dynamic cron jobs via the crons component.
 * Run this once after deployment or during initial setup:
 * npx convex run init:setup
 */
export const setup = internalAction({
  args: {},
  handler: async (ctx) => {
    const jobName = "refresh dashboard kpis";

    await auditLog.log(ctx, {
      action: "system.setup_executed",
      severity: "info",
    });

    // Define the configuration for the cron job
    const config = { identifier: { name: jobName } };

    // Check if the job is already registered in the component
    const existing = await ctx.runQuery(components.crons.public.get, config);

    if (existing) {
      console.log(`Cron job '${jobName}' is already registered.`);
      return;
    }

    // Get a stable handle for the internal action
    const handle = await createFunctionHandle(
      internal.kpis.refreshDashboardKpis,
    );

    // Register the job with a 10-minute interval
    await ctx.runMutation(components.crons.public.register, {
      name: jobName,
      functionHandle: handle,
      schedule: { kind: "interval", ms: 10 * 60 * 1000 }, // 10 minutes
      args: {},
    });

    console.log(
      `Successfully registered cron job '${jobName}' via the crons component.`,
    );
  },
});
