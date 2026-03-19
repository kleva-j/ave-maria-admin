import type { DataModel } from "./_generated/dataModel";

import { TableAggregate } from "@convex-dev/aggregate";

import { components } from "./_generated/api";
import { TABLE_NAMES } from "./shared";
import { UserId } from "./types";

/**
 * Example: Global leaderboard scores
 * Key: score (number) - sorted numerically
 * Use case: Find top scores, rankings, percentiles
 */
export const globalLeaderboard = new TableAggregate<{
  Key: bigint;
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.USER_SAVINGS_PLANS; // Replace with your table
}>(components.aggregate, {
  sortKey: (doc) => doc.current_amount_kobo, // The score/value to sort by
});

/**
 * Example: Scores grouped by user
 * Key: [userId, score] - enables per-user queries
 * Use case: Get user's high score, average, count
 */
export const plansByUser = new TableAggregate<{
  Key: [UserId, bigint];
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.USER_SAVINGS_PLANS;
}>(components.aggregate, {
  sortKey: (doc) => [doc.user_id, doc.current_amount_kobo],
});

/**
 * Namespaced aggregate: Each user gets their own isolated aggregation
 * Better throughput, no cross-talk between users
 * Cannot aggregate across all users (by design)
 */
export const userPlanAggregates = new TableAggregate<{
  Namespace: UserId;
  Key: bigint;
  DataModel: DataModel;
  TableName: typeof TABLE_NAMES.USER_SAVINGS_PLANS;
}>(components.aggregate, {
  namespace: (doc) => doc.user_id, // Each user has isolated data
  sortKey: (doc) => doc.current_amount_kobo,
});
