import { v } from "convex/values";
import { internalAction } from "../_generated/server";

const logEntryValidator = v.object({
  timestamp: v.string(),
  level: v.union(
    v.literal("debug"),
    v.literal("info"),
    v.literal("warn"),
    v.literal("error"),
  ),
  event: v.string(),
  service: v.literal("convex"),
  userId: v.optional(v.string()),
  data: v.optional(v.any()),
});

export const shipLogs = internalAction({
  args: { entries: v.array(logEntryValidator) },
  handler: async (_ctx, { entries }) => {
    const token = process.env.AXIOM_TOKEN;
    const dataset = process.env.AXIOM_DATASET;
    if (!token || !dataset) return;

    try {
      const res = await fetch(
        `https://api.axiom.co/v1/datasets/${dataset}/ingest`,
        {
          method: "POST",
          signal: AbortSignal.timeout(5000),
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(entries),
        },
      );

      if (!res.ok) {
        console.error("[axiom] ingest failed", res.status, await res.text());
      }
    } catch (err) {
      console.error("[axiom] ingest error", err);
    }
  },
});
