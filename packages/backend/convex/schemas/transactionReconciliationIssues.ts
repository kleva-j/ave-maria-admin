import { defineTable } from "convex/server";
import { v } from "convex/values";

import {
  transactionReconciliationIssueStatus,
  transactionReconciliationIssueType,
} from "../shared";

export const transaction_reconciliation_issues = defineTable({
  run_id: v.id("transaction_reconciliation_runs"),
  issue_type: transactionReconciliationIssueType,
  issue_status: transactionReconciliationIssueStatus,
  user_id: v.optional(v.id("users")),
  user_plan_id: v.optional(v.id("user_savings_plans")),
  transaction_id: v.optional(v.id("transactions")),
  reference: v.optional(v.string()),
  expected_amount_kobo: v.optional(v.int64()),
  actual_amount_kobo: v.optional(v.int64()),
  details: v.optional(v.any()),
  created_at: v.number(),
  resolved_at: v.optional(v.number()),
})
  .index("by_run_id", ["run_id"])
  .index("by_issue_status", ["issue_status", "created_at"])
  .index("by_issue_type", ["issue_type"])
  .index("by_user_id", ["user_id"])
  .index("by_user_plan_id", ["user_plan_id"])
  .index("by_transaction_id", ["transaction_id"]);
