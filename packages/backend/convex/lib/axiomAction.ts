import { v } from "convex/values";
import { internalAction } from "../_generated/server";

export const shipLogs = internalAction({
  args: { entries: v.array(v.any()) },
  handler: async (_ctx, { entries }) => {
    const token = process.env.AXIOM_TOKEN;
    const dataset = process.env.AXIOM_DATASET;
    if (!token || !dataset) return;

    const res = await fetch(
      `https://api.axiom.co/v1/datasets/${dataset}/ingest`,
      {
        method: "POST",
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
  },
});
