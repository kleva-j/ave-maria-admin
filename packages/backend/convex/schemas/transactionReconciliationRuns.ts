import { defineTable } from "convex/server";
import { v } from "convex/values";

import { transactionReconciliationRunStatus } from "../shared";

export const transaction_reconciliation_runs = defineTable({
  status: transactionReconciliationRunStatus,
  started_at: v.number(),
  completed_at: v.optional(v.number()),
  issue_count: v.number(),
  user_count: v.number(),
  plan_count: v.number(),
  transaction_count: v.number(),
  created_at: v.number(),
})
  .index("by_started_at", ["started_at"])
  .index("by_status", ["status"]);
