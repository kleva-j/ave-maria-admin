import { ConvexError, v } from "convex/values";

import { query } from "./_generated/server";
import { getAdminUser } from "./utils";
import {
  TransactionReconciliationIssueStatus,
  WithdrawalStatus,
  TABLE_NAMES,
  KYCStatus,
} from "./shared";

const adminViewerValidator = v.object({
  _id: v.id("admin_users"),
  workosId: v.string(),
  email: v.string(),
  first_name: v.string(),
  last_name: v.string(),
  profile_picture_url: v.optional(v.string()),
  role: v.string(),
  status: v.string(),
  created_at: v.number(),
  deleted_at: v.optional(v.number()),
  last_login_at: v.nullable(v.number()),
});

const adminOperationsSummaryValidator = v.object({
  withdrawals: v.object({
    pending: v.number(),
    approved: v.number(),
    rejected: v.number(),
    processed: v.number(),
  }),
  kyc: v.object({
    pending_users: v.number(),
  }),
  bankVerification: v.object({
    pending_accounts: v.number(),
    oldest_submission_at: v.optional(v.number()),
  }),
  reconciliation: v.object({
    latest_run: v.union(
      v.object({
        _id: v.id("transaction_reconciliation_runs"),
        status: v.string(),
        issue_count: v.number(),
        started_at: v.number(),
        completed_at: v.optional(v.number()),
      }),
      v.null(),
    ),
    open_issue_count: v.number(),
  }),
});

/**
 * Returns the authenticated admin record. This is the canonical
 * frontend check that the signed-in WorkOS user is mapped to a Convex admin.
 */
export const viewer = query({
  args: {},
  returns: adminViewerValidator,
  handler: async (ctx) => {
    const admin = await getAdminUser(ctx);
    return admin;
  },
});

/**
 * Lightweight operational dashboard summary for the admin console landing page.
 */
export const getOperationsSummary = query({
  args: {},
  returns: adminOperationsSummaryValidator,
  handler: async (ctx) => {
    await getAdminUser(ctx);

    const [withdrawals, pendingDocs, pendingAccounts, latestRun, openIssues] =
      await Promise.all([
        ctx.db.query(TABLE_NAMES.WITHDRAWALS).collect(),
        ctx.db
          .query(TABLE_NAMES.KYC_DOCUMENTS)
          .withIndex("by_status", (q) => q.eq("status", KYCStatus.PENDING))
          .collect(),
        ctx.db
          .query(TABLE_NAMES.USER_BANK_ACCOUNTS)
          .withIndex("by_verification_status", (q) =>
            q.eq("verification_status", "pending"),
          )
          .collect(),
        ctx.db
          .query(TABLE_NAMES.TRANSACTION_RECONCILIATION_RUNS)
          .withIndex("by_started_at")
          .order("desc")
          .take(1),
        ctx.db
          .query(TABLE_NAMES.TRANSACTION_RECONCILIATION_ISSUES)
          .withIndex("by_issue_status", (q) =>
            q.eq("issue_status", TransactionReconciliationIssueStatus.OPEN),
          )
          .collect(),
      ]);

    const pendingKycUsers = new Set(
      pendingDocs.map((document) => String(document.user_id)),
    ).size;

    const oldestSubmissionAt =
      pendingAccounts.length > 0
        ? pendingAccounts.reduce((oldest, account) => {
            const current =
              account.verification_submitted_at ?? account.created_at;
            return current < oldest ? current : oldest;
          }, pendingAccounts[0].verification_submitted_at ?? pendingAccounts[0].created_at)
        : undefined;

    const summary = {
      withdrawals: {
        pending: withdrawals.filter(
          (withdrawal) => withdrawal.status === WithdrawalStatus.PENDING,
        ).length,
        approved: withdrawals.filter(
          (withdrawal) => withdrawal.status === WithdrawalStatus.APPROVED,
        ).length,
        rejected: withdrawals.filter(
          (withdrawal) => withdrawal.status === WithdrawalStatus.REJECTED,
        ).length,
        processed: withdrawals.filter(
          (withdrawal) => withdrawal.status === WithdrawalStatus.PROCESSED,
        ).length,
      },
      kyc: {
        pending_users: pendingKycUsers,
      },
      bankVerification: {
        pending_accounts: pendingAccounts.length,
        oldest_submission_at: oldestSubmissionAt,
      },
      reconciliation: {
        latest_run:
          latestRun[0] === undefined
            ? null
            : {
                _id: latestRun[0]._id,
                status: latestRun[0].status,
                issue_count: latestRun[0].issue_count,
                started_at: latestRun[0].started_at,
                completed_at: latestRun[0].completed_at,
              },
        open_issue_count: openIssues.length,
      },
    };

    if (
      summary.withdrawals.pending < 0 ||
      summary.withdrawals.approved < 0 ||
      summary.withdrawals.rejected < 0 ||
      summary.withdrawals.processed < 0
    ) {
      throw new ConvexError("Invalid withdrawal summary state");
    }

    return summary;
  },
});

/**
 * List all users (admin only).
 */
export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      workosId: v.string(),
      phone: v.string(),
      email: v.optional(v.string()),
      first_name: v.string(),
      last_name: v.string(),
      profile_picture_url: v.optional(v.string()),
      onboarding_complete: v.boolean(),
      referral_code: v.string(),
      referred_by: v.optional(v.id("users")),
      total_balance_kobo: v.int64(),
      savings_balance_kobo: v.int64(),
      status: v.string(),
      bvn_encrypted: v.optional(v.string()),
      nin_encrypted: v.optional(v.string()),
      created_at: v.number(),
      updated_at: v.number(),
      deleted_at: v.optional(v.number()),
      last_login_at: v.nullable(v.number()),
    }),
  ),
  handler: async (ctx) => {
    await getAdminUser(ctx);
    return await ctx.db.query(TABLE_NAMES.USERS).collect();
  },
});
