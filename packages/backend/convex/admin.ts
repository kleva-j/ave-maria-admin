import { ConvexError, v } from "convex/values";

import type { MutationCtx } from "./_generated/server";
import type { AdminUserId } from "./types";

import { assertSuperAdmin, getAdminUser } from "./utils";
import { internal } from "./_generated/api";
import { auditLog } from "./auditLog";
import {
  assertDeactivationAllowed,
  assertRoleChangeAllowed,
} from "./adminUserPolicy";
import {
  internalMutation,
  internalQuery,
  mutation,
  action,
  query,
} from "./_generated/server";
import {
  TransactionReconciliationIssueStatus,
  WithdrawalStatus,
  RESOURCE_TYPE,
  TABLE_NAMES,
  UserStatus,
  userStatus,
  KYCStatus,
  AdminRole,
  adminRole,
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
  kyc: v.object({ pending_users: v.number() }),
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

// ============================================================================
// Admin User Management (super_admin only)
// ============================================================================

const adminUserRecordValidator = v.object({
  _id: v.id("admin_users"),
  _creationTime: v.number(),
  workosId: v.string(),
  email: v.string(),
  first_name: v.string(),
  last_name: v.string(),
  profile_picture_url: v.optional(v.string()),
  role: adminRole,
  status: userStatus,
  created_at: v.number(),
  deleted_at: v.optional(v.number()),
  last_login_at: v.nullable(v.number()),
});

const ADMIN_USER_LIST_LIMIT = 200;

/**
 * List admin users with optional role/status/search filters.
 * Bounded to ADMIN_USER_LIST_LIMIT rows to avoid unbounded scans.
 *
 * SECURITY: super_admin only.
 */
export const listAdminUsers = query({
  args: {
    role: v.optional(adminRole),
    status: v.optional(userStatus),
    search: v.optional(v.string()),
  },
  returns: v.array(adminUserRecordValidator),
  handler: async (ctx, args) => {
    await assertSuperAdmin(ctx);

    const baseQuery =
      args.role !== undefined && args.status !== undefined
        ? ctx.db
            .query(TABLE_NAMES.ADMIN_USERS)
            .withIndex("by_role_and_status", (q) =>
              q.eq("role", args.role!).eq("status", args.status!),
            )
        : args.role !== undefined
          ? ctx.db
              .query(TABLE_NAMES.ADMIN_USERS)
              .withIndex("by_role", (q) => q.eq("role", args.role!))
          : args.status !== undefined
            ? ctx.db
                .query(TABLE_NAMES.ADMIN_USERS)
                .withIndex("by_status", (q) => q.eq("status", args.status!))
            : ctx.db.query(TABLE_NAMES.ADMIN_USERS);

    const rows = await baseQuery.take(ADMIN_USER_LIST_LIMIT);

    const search = args.search?.trim().toLowerCase();
    if (!search) {
      return rows;
    }

    return rows.filter((row) => {
      const haystack =
        `${row.email} ${row.first_name} ${row.last_name}`.toLowerCase();
      return haystack.includes(search);
    });
  },
});

/**
 * Fetch a single admin user by id.
 *
 * SECURITY: super_admin only.
 */
export const getAdminUserById = query({
  args: { id: v.id("admin_users") },
  returns: v.union(adminUserRecordValidator, v.null()),
  handler: async (ctx, args) => {
    await assertSuperAdmin(ctx);
    return await ctx.db.get(args.id);
  },
});

async function countActiveSuperAdmins(ctx: MutationCtx): Promise<number> {
  const rows = await ctx.db
    .query(TABLE_NAMES.ADMIN_USERS)
    .withIndex("by_role_and_status", (q) =>
      q.eq("role", AdminRole.SUPER_ADMIN).eq("status", UserStatus.ACTIVE),
    )
    .take(50);
  return rows.length;
}

/**
 * Update an admin user's role.
 *
 * Guards:
 *  - caller must be super_admin
 *  - cannot demote self
 *  - cannot demote the last active super_admin
 *
 * SECURITY: super_admin only.
 */
export const updateAdminUserRole = mutation({
  args: {
    id: v.id("admin_users"),
    role: adminRole,
  },
  returns: adminUserRecordValidator,
  handler: async (ctx, args) => {
    const viewer = await assertSuperAdmin(ctx);

    const target = await ctx.db.get(args.id);
    if (!target) {
      throw new ConvexError("Admin user not found");
    }

    if (target.role === args.role) {
      return target;
    }

    const activeSuperAdminCount = await countActiveSuperAdmins(ctx);
    assertRoleChangeAllowed({
      viewer,
      target,
      newRole: args.role,
      activeSuperAdminCount,
    });

    const previousRole = target.role;
    await ctx.db.patch(args.id, { role: args.role });
    const updated = await ctx.db.get(args.id);
    if (!updated) {
      throw new ConvexError("Admin user not found after update");
    }

    await auditLog.log(ctx, {
      action: "admin_user.role_changed",
      actorId: viewer._id,
      resourceType: RESOURCE_TYPE.ADMIN_USER,
      resourceId: updated._id,
      severity: "warning",
      metadata: {
        target_admin_user_id: updated._id,
        target_email: updated.email,
        previous_role: previousRole,
        new_role: updated.role,
      },
    });

    return updated;
  },
});

/**
 * Deactivate (soft-delete) an admin user.
 *
 * Guards:
 *  - caller must be super_admin
 *  - cannot deactivate self
 *  - cannot deactivate the last active super_admin
 *
 * Sets `deleted_at` and `status = "suspended"`. Does not touch WorkOS.
 *
 * SECURITY: super_admin only.
 */
export const deactivateAdminUser = mutation({
  args: { id: v.id("admin_users") },
  returns: adminUserRecordValidator,
  handler: async (ctx, args) => {
    const viewer = await assertSuperAdmin(ctx);

    const target = await ctx.db.get(args.id);
    if (!target) {
      throw new ConvexError("Admin user not found");
    }

    const activeSuperAdminCount = await countActiveSuperAdmins(ctx);
    assertDeactivationAllowed({
      viewer,
      target,
      activeSuperAdminCount,
    });

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: UserStatus.SUSPENDED,
      deleted_at: now,
    });
    const updated = await ctx.db.get(args.id);
    if (!updated) {
      throw new ConvexError("Admin user not found after update");
    }

    await auditLog.log(ctx, {
      action: "admin_user.deactivated",
      actorId: viewer._id,
      resourceType: RESOURCE_TYPE.ADMIN_USER,
      resourceId: updated._id,
      severity: "warning",
      metadata: {
        target_admin_user_id: updated._id,
        target_email: updated.email,
        previous_status: target.status,
        deleted_at: now,
      },
    });

    return updated;
  },
});

/**
 * Reactivate a previously deactivated admin user.
 * Clears `deleted_at` and sets `status = "active"`.
 *
 * SECURITY: super_admin only.
 */
export const reactivateAdminUser = mutation({
  args: { id: v.id("admin_users") },
  returns: adminUserRecordValidator,
  handler: async (ctx, args) => {
    const viewer = await assertSuperAdmin(ctx);

    const target = await ctx.db.get(args.id);
    if (!target) {
      throw new ConvexError("Admin user not found");
    }

    if (
      target.deleted_at === undefined &&
      target.status === UserStatus.ACTIVE
    ) {
      return target;
    }

    await ctx.db.patch(args.id, {
      status: UserStatus.ACTIVE,
      deleted_at: undefined,
    });
    const updated = await ctx.db.get(args.id);
    if (!updated) {
      throw new ConvexError("Admin user not found after update");
    }

    await auditLog.log(ctx, {
      action: "admin_user.reactivated",
      actorId: viewer._id,
      resourceType: RESOURCE_TYPE.ADMIN_USER,
      resourceId: updated._id,
      severity: "info",
      metadata: {
        target_admin_user_id: updated._id,
        target_email: updated.email,
        previous_status: target.status,
      },
    });

    return updated;
  },
});

/**
 * Internal mutation: insert an admin_users row after a successful WorkOS invite.
 * Called only from the inviteAdminUser action.
 */
export const _insertAdminUser = internalMutation({
  args: {
    workosId: v.string(),
    email: v.string(),
    first_name: v.string(),
    last_name: v.string(),
    role: adminRole,
    invited_by_admin_id: v.id("admin_users"),
  },
  returns: v.id("admin_users"),
  handler: async (ctx, args) => {
    // Defensive: prevent duplicate rows for the same WorkOS user
    const existing = await ctx.db
      .query(TABLE_NAMES.ADMIN_USERS)
      .withIndex("by_workos_id", (q) => q.eq("workosId", args.workosId))
      .unique();

    if (existing) {
      throw new ConvexError(
        "An admin user already exists for this WorkOS identity",
      );
    }

    const now = Date.now();
    const adminUserId = await ctx.db.insert(TABLE_NAMES.ADMIN_USERS, {
      workosId: args.workosId,
      email: args.email,
      first_name: args.first_name,
      last_name: args.last_name,
      role: args.role,
      status: UserStatus.ACTIVE,
      created_at: now,
      last_login_at: null,
    });

    await auditLog.log(ctx, {
      action: "admin_user.invited",
      actorId: args.invited_by_admin_id,
      resourceType: RESOURCE_TYPE.ADMIN_USER,
      resourceId: adminUserId,
      severity: "info",
      metadata: {
        target_admin_user_id: adminUserId,
        target_email: args.email,
        role: args.role,
      },
    });

    return adminUserId;
  },
});

interface WorkOSInviteResult {
  workosId: string;
  invitationId: string;
}

async function callWorkOSInvite(args: {
  email: string;
  first_name: string;
  last_name: string;
  apiKey: string;
  organizationId?: string;
}): Promise<WorkOSInviteResult> {
  const baseHeaders: Record<string, string> = {
    Authorization: `Bearer ${args.apiKey}`,
    "Content-Type": "application/json",
  };

  // 1. Create the WorkOS user (no password — they set it via invite link).
  const createUserResp = await fetch(
    "https://api.workos.com/user_management/users",
    {
      method: "POST",
      headers: baseHeaders,
      body: JSON.stringify({
        email: args.email,
        first_name: args.first_name,
        last_name: args.last_name,
        email_verified: false,
      }),
    },
  );

  if (!createUserResp.ok) {
    const text = await createUserResp.text();
    throw new ConvexError(`WorkOS createUser failed: ${text}`);
  }

  const createUserBody = (await createUserResp.json()) as { id?: string };
  const workosId = createUserBody.id;
  if (!workosId) {
    throw new ConvexError("WorkOS createUser returned no id");
  }

  // 2. Send invitation email.
  const invitePayload: Record<string, unknown> = { email: args.email };
  if (args.organizationId) {
    invitePayload.organization_id = args.organizationId;
  }

  const inviteResp = await fetch(
    "https://api.workos.com/user_management/invitations",
    {
      method: "POST",
      headers: baseHeaders,
      body: JSON.stringify(invitePayload),
    },
  );

  if (!inviteResp.ok) {
    const text = await inviteResp.text();
    throw new ConvexError(`WorkOS sendInvitation failed: ${text}`);
  }

  const inviteBody = (await inviteResp.json()) as { id?: string };
  const invitationId = inviteBody.id ?? "";

  return { workosId, invitationId };
}

/**
 * Invite a new admin user.
 * Calls WorkOS to provision the identity + send invite email,
 * then inserts the local admin_users row via internal mutation.
 *
 * SECURITY: super_admin only.
 *
 * Required Convex env vars:
 *   - WORKOS_API_KEY
 *   - WORKOS_ADMIN_ORG_ID (optional — set if admins live in a dedicated org)
 */
export const inviteAdminUser = action({
  args: {
    email: v.string(),
    first_name: v.string(),
    last_name: v.string(),
    role: adminRole,
  },
  returns: v.object({
    adminUserId: v.id("admin_users"),
    workosInvitationId: v.string(),
  }),
  handler: async (ctx, args) => {
    // Auth: re-check via internal query because actions cannot use ctx.db.
    const viewer = await ctx.runQuery(internal.admin._viewerForAction, {});
    if (viewer.role !== AdminRole.SUPER_ADMIN) {
      throw new ConvexError("Not authorized");
    }

    const apiKey = process.env.WORKOS_API_KEY;
    if (!apiKey) {
      throw new ConvexError(
        "WORKOS_API_KEY is not configured on the Convex deployment",
      );
    }
    const organizationId = process.env.WORKOS_ADMIN_ORG_ID;

    const email = args.email.trim().toLowerCase();
    if (!email.includes("@")) {
      throw new ConvexError("Invalid email address");
    }

    const result = await callWorkOSInvite({
      email,
      first_name: args.first_name.trim(),
      last_name: args.last_name.trim(),
      apiKey,
      organizationId,
    });

    const adminUserId: AdminUserId = await ctx.runMutation(
      internal.admin._insertAdminUser,
      {
        workosId: result.workosId,
        email,
        first_name: args.first_name.trim(),
        last_name: args.last_name.trim(),
        role: args.role,
        invited_by_admin_id: viewer._id,
      },
    );

    return {
      adminUserId,
      workosInvitationId: result.invitationId,
    };
  },
});

/**
 * Internal helper for the inviteAdminUser action.
 * Returns the calling admin's record (super_admin only).
 */
export const _viewerForAction = internalQuery({
  args: {},
  returns: adminUserRecordValidator,
  handler: async (ctx) => {
    return await assertSuperAdmin(ctx);
  },
});
