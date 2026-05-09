import { ConvexError, v, type Infer } from "convex/values";

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
  _creationTime: v.number(),
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
// Admin User Management (super-admin only)
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
 * SECURITY: super-admin only.
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
 * SECURITY: super-admin only.
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
 * Internal mutation: update an admin user's role.
 * Called only from the updateAdminUserRole action.
 *
 * Guards:
 *  - caller must be super-admin
 *  - cannot demote self
 *  - cannot demote the last active super-admin
 */
export const _updateAdminUserRoleLocal = internalMutation({
  args: {
    id: v.id("admin_users"),
    role: adminRole,
    viewerId: v.id("admin_users"),
  },
  returns: v.union(adminUserRecordValidator, v.null()),
  handler: async (ctx, args) => {
    const viewer = await ctx.db.get(args.viewerId);
    if (!viewer) throw new ConvexError("Not authorized");

    const target = await ctx.db.get(args.id);
    if (!target) {
      throw new ConvexError("Admin user not found");
    }

    if (target.role === args.role) {
      return null; // no-op signal — caller skips WorkOS call
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
 * Internal mutation: deactivate (soft-delete) an admin user.
 * Called only from the deactivateAdminUser action.
 *
 * Guards:
 *  - caller must be super-admin
 *  - cannot deactivate self
 *  - cannot deactivate the last active super-admin
 *
 * Sets `deleted_at` and `status = "suspended"`.
 */
export const _deactivateAdminUserLocal = internalMutation({
  args: {
    id: v.id("admin_users"),
    viewerId: v.id("admin_users"),
  },
  returns: adminUserRecordValidator,
  handler: async (ctx, args) => {
    const viewer = await ctx.db.get(args.viewerId);
    if (!viewer || viewer.role !== AdminRole.SUPER_ADMIN || viewer.status !== UserStatus.ACTIVE) {
      throw new ConvexError("Not authorized");
    }

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
 * Internal mutation: reactivate a previously deactivated admin user.
 * Called only from the reactivateAdminUser action.
 *
 * Clears `deleted_at` and sets `status = "active"`.
 */
export const _reactivateAdminUserLocal = internalMutation({
  args: {
    id: v.id("admin_users"),
    viewerId: v.id("admin_users"),
  },
  returns: adminUserRecordValidator,
  handler: async (ctx, args) => {
    const viewer = await ctx.db.get(args.viewerId);
    if (!viewer || viewer.role !== AdminRole.SUPER_ADMIN || viewer.status !== UserStatus.ACTIVE) {
      throw new ConvexError("Not authorized");
    }

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

const WORKOS_TIMEOUT_MS = 10_000;

/** Scrub WorkOS response bodies before surfacing them in ConvexError messages. */
function safeWorkOSError(status: number): string {
  return `WorkOS request failed (HTTP ${status})`;
}

async function callWorkOSInvite(args: {
  email: string;
  first_name: string;
  last_name: string;
  apiKey: string;
  organizationId: string;
  roleSlug: string;
}): Promise<WorkOSInviteResult> {
  const baseHeaders: Record<string, string> = {
    Authorization: `Bearer ${args.apiKey}`,
    "Content-Type": "application/json",
  };

  // 1. Look up existing WorkOS user by email to avoid creating orphan users.
  let workosId: string | undefined;

  const lookupResp = await fetch(
    `https://api.workos.com/user_management/users?email=${encodeURIComponent(args.email)}`,
    {
      method: "GET",
      headers: baseHeaders,
      signal: AbortSignal.timeout(WORKOS_TIMEOUT_MS),
    },
  ).catch(() => null);

  if (lookupResp && lookupResp.ok) {
    const lookupBody = (await lookupResp.json()) as { data?: { id: string }[] };
    workosId = lookupBody.data?.[0]?.id;
  }

  let createdNewUser = false;

  if (!workosId) {
    // 2. Create the WorkOS user (no password — they set it via invite link).
    let createUserResp: Response;
    try {
      createUserResp = await fetch(
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
          signal: AbortSignal.timeout(WORKOS_TIMEOUT_MS),
        },
      );
    } catch (err) {
      if (err instanceof Error && err.name === "TimeoutError") {
        throw new ConvexError("WorkOS createUser timed out");
      }
      throw new ConvexError("WorkOS createUser request failed");
    }

    if (!createUserResp.ok) {
      throw new ConvexError(safeWorkOSError(createUserResp.status));
    }

    const createUserBody = (await createUserResp.json()) as { id?: string };
    workosId = createUserBody.id;
    if (!workosId) {
      throw new ConvexError("WorkOS createUser returned no id");
    }
    createdNewUser = true;
  }

  // 3. Send invitation email — compensate by deleting the new user on failure.
  // Including organization_id + role_slug ensures that on invitation accept,
  // WorkOS auto-creates an OrganizationMembership in the admin org with the
  // correct role mapped from our AdminRole enum.
  const invitePayload: Record<string, unknown> = {
    email: args.email,
    organization_id: args.organizationId,
    role_slug: args.roleSlug,
  };

  let inviteResp: Response;
  try {
    inviteResp = await fetch(
      "https://api.workos.com/user_management/invitations",
      {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify(invitePayload),
        signal: AbortSignal.timeout(WORKOS_TIMEOUT_MS),
      },
    );
  } catch (err) {
    if (createdNewUser) {
      await fetch(`https://api.workos.com/user_management/users/${workosId}`, {
        method: "DELETE",
        headers: baseHeaders,
        signal: AbortSignal.timeout(WORKOS_TIMEOUT_MS),
      }).catch(() => undefined);
    }
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new ConvexError("WorkOS sendInvitation timed out");
    }
    throw new ConvexError("WorkOS sendInvitation request failed");
  }

  if (!inviteResp.ok) {
    if (createdNewUser) {
      await fetch(`https://api.workos.com/user_management/users/${workosId}`, {
        method: "DELETE",
        headers: baseHeaders,
        signal: AbortSignal.timeout(WORKOS_TIMEOUT_MS),
      }).catch(() => undefined);
    }
    throw new ConvexError(safeWorkOSError(inviteResp.status));
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
 * SECURITY: super-admin only.
 *
 * Required Convex env vars:
 *   - WORKOS_API_KEY
 *   - WORKOS_ADMIN_ORG_ID (target organization for all admin staff)
 *
 * Required WorkOS dashboard config:
 *   - Roles configured with slugs that match the AdminRole enum:
 *     super-admin, admin, operations, finance, compliance, support
 *     (Dashboard → Roles. Slugs are case-sensitive.)
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
    if (!organizationId) {
      throw new ConvexError(
        "WORKOS_ADMIN_ORG_ID is not configured on the Convex deployment. " +
          "Admins must be invited into a WorkOS organization.",
      );
    }

    const email = args.email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ConvexError("Invalid email address");
    }

    const result = await callWorkOSInvite({
      email,
      first_name: args.first_name.trim(),
      last_name: args.last_name.trim(),
      apiKey,
      organizationId,
      roleSlug: args.role,
    });

    let adminUserId: AdminUserId;
    try {
      adminUserId = await ctx.runMutation(internal.admin._insertAdminUser, {
        workosId: result.workosId,
        email,
        first_name: args.first_name.trim(),
        last_name: args.last_name.trim(),
        role: args.role,
        invited_by_admin_id: viewer._id,
      });
    } catch (err) {
      // Compensate: clean up the WorkOS user so the invite can be retried.
      await fetch(
        `https://api.workos.com/user_management/users/${result.workosId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(WORKOS_TIMEOUT_MS),
        },
      ).catch(() => undefined);
      throw new ConvexError(
        "Failed to create admin user record; WorkOS user has been cleaned up. Please retry.",
      );
    }

    return {
      adminUserId,
      workosInvitationId: result.invitationId,
    };
  },
});

/**
 * Internal helper for actions that require a super-admin caller.
 * Returns the calling admin's record (super-admin only).
 */
export const _viewerForAction = internalQuery({
  args: {},
  returns: adminUserRecordValidator,
  handler: async (ctx) => {
    return await assertSuperAdmin(ctx);
  },
});

/**
 * Internal query: fetch a target admin user by ID for use inside actions.
 * Returns the full record so actions can read workosId, role, status, deleted_at.
 */
export const _getAdminUserForAction = internalQuery({
  args: { id: v.id("admin_users") },
  returns: v.union(adminUserRecordValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// ---------------------------------------------------------------------------
// WorkOS membership helpers (used by deactivate / reactivate / role-change actions)
// ---------------------------------------------------------------------------

interface WorkOSMembership {
  id: string;
  status: string;
}

/**
 * Look up a WorkOS OrganizationMembership for a given user in a given org.
 * Returns the membership object, or null when the API succeeds with an empty
 * result (no membership yet — invite still pending).
 *
 * Throws ConvexError on network failure, timeout, or non-2xx response so the
 * caller can roll back local writes instead of silently skipping WorkOS sync.
 */
async function findWorkOSMembership(
  workosUserId: string,
  organizationId: string,
  apiKey: string,
): Promise<WorkOSMembership | null> {
  const url = `https://api.workos.com/user_management/organization_memberships?user_id=${encodeURIComponent(workosUserId)}&organization_id=${encodeURIComponent(organizationId)}`;
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(WORKOS_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new ConvexError("WorkOS membership lookup timed out");
    }
    throw new ConvexError("WorkOS membership lookup request failed");
  }
  if (!resp.ok) throw new ConvexError(safeWorkOSError(resp.status));

  const body = (await resp.json()) as { data?: WorkOSMembership[] };
  return body.data?.[0] ?? null;
}

/**
 * Flip the status of a WorkOS OrganizationMembership.
 * action: "deactivate" | "reactivate"
 */
async function setWorkOSMembershipStatus(
  membershipId: string,
  action: "deactivate" | "reactivate",
  apiKey: string,
): Promise<void> {
  const url = `https://api.workos.com/user_management/organization_memberships/${encodeURIComponent(membershipId)}/${action}`;
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(WORKOS_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new ConvexError(`WorkOS membership ${action} timed out`);
    }
    throw new ConvexError(`WorkOS membership ${action} request failed`);
  }
  if (!resp.ok) {
    throw new ConvexError(safeWorkOSError(resp.status));
  }
}

/**
 * Update the role slug on a WorkOS OrganizationMembership.
 */
async function setWorkOSMembershipRole(
  membershipId: string,
  roleSlug: string,
  apiKey: string,
): Promise<void> {
  const url = `https://api.workos.com/user_management/organization_memberships/${encodeURIComponent(membershipId)}`;
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role_slug: roleSlug }),
      signal: AbortSignal.timeout(WORKOS_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new ConvexError("WorkOS membership role update timed out");
    }
    throw new ConvexError("WorkOS membership role update request failed");
  }
  if (!resp.ok) {
    throw new ConvexError(safeWorkOSError(resp.status));
  }
}

// ---------------------------------------------------------------------------
// Public action: updateAdminUserRole (local-first + WorkOS sync + rollback)
// ---------------------------------------------------------------------------

/**
 * Update an admin user's role.
 *
 * Writes locally first (guards run, role patched), then syncs the WorkOS
 * OrganizationMembership role slug. On WorkOS failure the local write is
 * rolled back to the previous role.
 *
 * If the invite was never accepted (no membership found), the WorkOS step is
 * skipped. The membership will carry the role from invite time until the admin
 * accepts and a subsequent role change syncs it.
 *
 * SECURITY: super-admin only.
 */
export const updateAdminUserRole = action({
  args: {
    id: v.id("admin_users"),
    role: adminRole,
  },
  returns: v.union(adminUserRecordValidator, v.null()),
  handler: async (
    ctx,
    args,
  ): Promise<Infer<typeof adminUserRecordValidator> | null> => {
    const viewer: Infer<typeof adminUserRecordValidator> =
      await ctx.runQuery(internal.admin._viewerForAction, {});

    const apiKey = process.env.WORKOS_API_KEY;
    if (!apiKey) throw new ConvexError("WORKOS_API_KEY is not configured");
    const organizationId = process.env.WORKOS_ADMIN_ORG_ID;
    if (!organizationId)
      throw new ConvexError("WORKOS_ADMIN_ORG_ID is not configured");

    const target: Infer<typeof adminUserRecordValidator> | null =
      await ctx.runQuery(internal.admin._getAdminUserForAction, {
        id: args.id,
      });
    if (!target) throw new ConvexError("Admin user not found");

    const previousRole = target.role;

    // 1. Local write first — guards run here.
    const updated: Infer<typeof adminUserRecordValidator> | null =
      await ctx.runMutation(internal.admin._updateAdminUserRoleLocal, {
        id: args.id,
        role: args.role,
        viewerId: viewer._id,
      });

    // null means role was already the requested value — nothing to do.
    if (updated === null) return null;

    // 2. Sync WorkOS membership role.
    const membership = await findWorkOSMembership(
      target.workosId,
      organizationId,
      apiKey,
    );
    if (membership) {
      try {
        await setWorkOSMembershipRole(membership.id, args.role, apiKey);
      } catch (err) {
        // Rollback local write.
        await ctx.runMutation(internal.admin._updateAdminUserRoleLocal, {
          id: args.id,
          role: previousRole as Infer<typeof adminRole>,
          viewerId: viewer._id,
        });
        await auditLog.log(ctx, {
          action: "admin_user.role_change.workos_failed",
          actorId: viewer._id,
          resourceType: RESOURCE_TYPE.ADMIN_USER,
          resourceId: args.id,
          severity: "critical",
          metadata: {
            target_admin_user_id: args.id,
            attempted_role: args.role,
            previous_role: previousRole,
            error: err instanceof Error ? err.message : String(err),
          },
        });
        throw err;
      }
    }

    return updated;
  },
});

// ---------------------------------------------------------------------------
// Public actions: deactivate / reactivate (local-first + WorkOS sync + rollback)
// ---------------------------------------------------------------------------

/**
 * Deactivate an admin user.
 *
 * Writes locally first (guards run, row suspended), then deactivates the
 * WorkOS OrganizationMembership. On WorkOS failure the local write is rolled
 * back so the two systems stay in sync.
 *
 * If the invite was never accepted (no membership found), WorkOS step is
 * skipped — the admin never had WorkOS access anyway.
 *
 * SECURITY: super-admin only.
 */
export const deactivateAdminUser = action({
  args: { id: v.id("admin_users") },
  returns: adminUserRecordValidator,
  handler: async (ctx, args) => {
    const viewer: Infer<typeof adminUserRecordValidator> =
      await ctx.runQuery(internal.admin._viewerForAction, {});

    const apiKey = process.env.WORKOS_API_KEY;
    if (!apiKey) throw new ConvexError("WORKOS_API_KEY is not configured");
    const organizationId = process.env.WORKOS_ADMIN_ORG_ID;
    if (!organizationId)
      throw new ConvexError("WORKOS_ADMIN_ORG_ID is not configured");

    const target: Infer<typeof adminUserRecordValidator> | null =
      await ctx.runQuery(internal.admin._getAdminUserForAction, {
        id: args.id,
      });
    if (!target) throw new ConvexError("Admin user not found");

    // 1. Local write first — guards run here.
    const updated: Infer<typeof adminUserRecordValidator> =
      await ctx.runMutation(internal.admin._deactivateAdminUserLocal, {
        id: args.id,
        viewerId: viewer._id,
      });

    // 2. Sync WorkOS membership. Wraps both lookup and status flip so a lookup
    //    failure (timeout / non-2xx) also triggers rollback instead of silently
    //    skipping the WorkOS sync.
    try {
      const membership = await findWorkOSMembership(
        target.workosId,
        organizationId,
        apiKey,
      );
      if (membership) {
        await setWorkOSMembershipStatus(membership.id, "deactivate", apiKey);
      }
    } catch (err) {
      // Rollback local write so state stays consistent.
      await ctx.runMutation(internal.admin._reactivateAdminUserLocal, {
        id: args.id,
        viewerId: viewer._id,
      });
      await auditLog.log(ctx, {
        action: "admin_user.deactivate.workos_failed",
        actorId: viewer._id,
        resourceType: RESOURCE_TYPE.ADMIN_USER,
        resourceId: args.id,
        severity: "critical",
        metadata: {
          target_admin_user_id: args.id,
          error: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }

    return updated;
  },
});

/**
 * Reactivate a previously deactivated admin user.
 *
 * Writes locally first, then reactivates the WorkOS OrganizationMembership.
 * On WorkOS failure the local write is rolled back.
 *
 * SECURITY: super-admin only.
 */
export const reactivateAdminUser = action({
  args: { id: v.id("admin_users") },
  returns: adminUserRecordValidator,
  handler: async (ctx, args) => {
    const viewer: Infer<typeof adminUserRecordValidator> =
      await ctx.runQuery(internal.admin._viewerForAction, {});

    const apiKey = process.env.WORKOS_API_KEY;
    if (!apiKey) throw new ConvexError("WORKOS_API_KEY is not configured");
    const organizationId = process.env.WORKOS_ADMIN_ORG_ID;
    if (!organizationId)
      throw new ConvexError("WORKOS_ADMIN_ORG_ID is not configured");

    const target: Infer<typeof adminUserRecordValidator> | null =
      await ctx.runQuery(internal.admin._getAdminUserForAction, {
        id: args.id,
      });
    if (!target) throw new ConvexError("Admin user not found");

    // Capture pre-state so rollback is only applied when the local mutation
    // actually changed something. _reactivateAdminUserLocal is a no-op when
    // the target is already ACTIVE — rolling back in that case would wrongly
    // deactivate an already-active admin.
    const wasSuspended =
      target.status !== UserStatus.ACTIVE || target.deleted_at !== undefined;

    // 1. Local write first.
    const updated: Infer<typeof adminUserRecordValidator> =
      await ctx.runMutation(internal.admin._reactivateAdminUserLocal, {
        id: args.id,
        viewerId: viewer._id,
      });

    // 2. Sync WorkOS membership. Wraps both lookup and status flip so a lookup
    //    failure (timeout / non-2xx) also triggers rollback.
    try {
      const membership = await findWorkOSMembership(
        target.workosId,
        organizationId,
        apiKey,
      );
      if (membership) {
        await setWorkOSMembershipStatus(membership.id, "reactivate", apiKey);
      }
    } catch (err) {
      if (wasSuspended) {
        // Only rollback if the local write actually changed state.
        await ctx.runMutation(internal.admin._deactivateAdminUserLocal, {
          id: args.id,
          viewerId: viewer._id,
        });
      }
      await auditLog.log(ctx, {
        action: "admin_user.reactivate.workos_failed",
        actorId: viewer._id,
        resourceType: RESOURCE_TYPE.ADMIN_USER,
        resourceId: args.id,
        severity: "critical",
        metadata: {
          target_admin_user_id: args.id,
          was_suspended: wasSuspended,
          error: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }

    return updated;
  },
});
