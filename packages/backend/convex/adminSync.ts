import { internalAction, internalQuery } from "./_generated/server";
import { RESOURCE_TYPE, TABLE_NAMES, UserStatus } from "./shared";
import { internal } from "./_generated/api";
import { auditLog } from "./auditLog";

// ---------------------------------------------------------------------------
// WorkOS types (extended — includes fields needed for drift comparison)
// ---------------------------------------------------------------------------

interface WorkOSMembershipFull {
  id: string;
  user_id: string;  // = admin_users.workosId
  status: string;   // "active" | "inactive"
  role: { slug: string };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORKOS_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Internal query: fetch all admin_users rows (active + suspended)
// ---------------------------------------------------------------------------

/**
 * Returns all admin_users rows. Used by checkAdminRoleDrift to get local truth.
 *
 * Deactivation sets both `status: SUSPENDED` and `deleted_at: <ts>` (soft-delete),
 * so filtering on `deleted_at === undefined` would exclude suspended admins
 * entirely — the drift comparator could then never detect deactivation_orphan
 * or deactivation_drift cases. Return everything; the comparator already
 * branches on status.
 */
export const _fetchAllAdminUsers = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query(TABLE_NAMES.ADMIN_USERS).collect();
  },
});

// ---------------------------------------------------------------------------
// Internal action: drift check
// ---------------------------------------------------------------------------

/**
 * Compares every Convex admin_users row against WorkOS OrganizationMembership.
 *
 * Most divergences are audit-logged at "critical" severity so they surface in
 * the audit log UI and trigger alert watchers on the watchCritical query.
 * The one exception is `admin_user.drift.membership_missing` for an ACTIVE
 * admin (pending-invite case), which is logged at "warning" because it is an
 * expected transient state, not a bug.
 *
 * Detection only — no auto-correct, to avoid masking bugs.
 *
 * Registered as an hourly cron by init:setup.
 * Can also be triggered manually:
 *   npx convex run adminSync:checkAdminRoleDrift
 */
export const checkAdminRoleDrift = internalAction({
  args: {},
  handler: async (ctx) => {
    const apiKey = process.env.WORKOS_API_KEY;
    const organizationId = process.env.WORKOS_ADMIN_ORG_ID;

    if (!apiKey || !organizationId) {
      // Dev environment — skip with an info log so the no-op is visible in logs.
      console.log(
        "[adminSync] WORKOS_API_KEY or WORKOS_ADMIN_ORG_ID not set — skipping drift check.",
      );
      return;
    }

    // 1. Load local admin_users.
    const admins = await ctx.runQuery(internal.adminSync._fetchAllAdminUsers, {});

    // 2. Paginate WorkOS memberships → build Map<workosId, membership>.
    const membershipMap = new Map<string, WorkOSMembershipFull>();
    let after: string | undefined;

    for (;;) {
      const url = new URL(
        "https://api.workos.com/user_management/organization_memberships",
      );
      url.searchParams.set("organization_id", organizationId);
      url.searchParams.set("limit", "100");
      if (after) url.searchParams.set("after", after);

      const resp = await fetch(url.toString(), {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(WORKOS_TIMEOUT_MS),
      }).catch(() => null);

      if (!resp || !resp.ok) {
        console.error(
          `[adminSync] Failed to fetch WorkOS memberships (HTTP ${resp?.status ?? "network error"}) — aborting drift check.`,
        );
        return;
      }

      const body = (await resp.json()) as {
        data?: WorkOSMembershipFull[];
        list_metadata?: { after?: string };
      };

      for (const m of body.data ?? []) {
        membershipMap.set(m.user_id, m);
      }

      after = body.list_metadata?.after;
      if (!after) break;
    }

    // 3. Compare.
    let divergences = 0;

    for (const admin of admins) {
      const membership = membershipMap.get(admin.workosId);
      const adminId = admin._id;
      const workosId = admin.workosId;
      const baseMeta = { admin_id: adminId, workos_id: workosId };

      if (!membership) {
        if (admin.status === UserStatus.ACTIVE) {
          // Expected transient state — invite pending or never invited.
          await auditLog.log(ctx, {
            action: "admin_user.drift.membership_missing",
            resourceType: RESOURCE_TYPE.ADMIN_USER,
            resourceId: adminId,
            severity: "warning",
            metadata: {
              ...baseMeta,
              note: "No WorkOS membership found for active admin. Invite may be pending.",
            },
          });
          divergences++;
        } else if (admin.status === UserStatus.SUSPENDED) {
          // Deactivated locally but WorkOS never had a membership — edge case.
          await auditLog.log(ctx, {
            action: "admin_user.drift.deactivation_orphan",
            resourceType: RESOURCE_TYPE.ADMIN_USER,
            resourceId: adminId,
            severity: "critical",
            metadata: {
              ...baseMeta,
              convex_status: admin.status,
            },
          });
          divergences++;
        }
        continue;
      }

      // Membership exists — check status alignment.
      if (
        admin.status === UserStatus.ACTIVE &&
        membership.status !== "active"
      ) {
        await auditLog.log(ctx, {
          action: "admin_user.drift.status_mismatch",
          resourceType: RESOURCE_TYPE.ADMIN_USER,
          resourceId: adminId,
          severity: "critical",
          metadata: {
            ...baseMeta,
            convex_status: admin.status,
            workos_status: membership.status,
          },
        });
        divergences++;
      } else if (
        admin.status === UserStatus.SUSPENDED &&
        membership.status === "active"
      ) {
        await auditLog.log(ctx, {
          action: "admin_user.drift.deactivation_drift",
          resourceType: RESOURCE_TYPE.ADMIN_USER,
          resourceId: adminId,
          severity: "critical",
          metadata: {
            ...baseMeta,
            convex_status: admin.status,
            workos_status: membership.status,
          },
        });
        divergences++;
      }

      // Check role alignment (only for active admins — suspended memberships
      // may have stale role slugs after deactivation).
      if (
        admin.status === UserStatus.ACTIVE &&
        membership.status === "active" &&
        membership.role.slug !== admin.role
      ) {
        await auditLog.log(ctx, {
          action: "admin_user.drift.role_mismatch",
          resourceType: RESOURCE_TYPE.ADMIN_USER,
          resourceId: adminId,
          severity: "critical",
          metadata: {
            ...baseMeta,
            convex_role: admin.role,
            workos_role_slug: membership.role.slug,
          },
        });
        divergences++;
      }
    }

    console.log(
      `[adminSync] Drift check complete. ${admins.length} admin(s) checked, ${divergences} divergence(s) found.`,
    );
  },
});
