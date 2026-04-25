import { ConvexError } from "convex/values";

import { AdminRole, UserStatus } from "./shared";

/**
 * Pure policy helpers for admin user management.
 * Kept free of ctx.db so they are unit-testable in node.
 */

type AdminLite = {
  _id: string;
  role: string;
  status: string;
  deleted_at?: number;
};

/**
 * Validate that a role change is allowed.
 *
 * Throws ConvexError on:
 *  - target is the viewer and is being demoted from super_admin
 *  - target is the last active super_admin and is being demoted
 */
export function assertRoleChangeAllowed(args: {
  viewer: AdminLite;
  target: AdminLite;
  newRole: string;
  activeSuperAdminCount: number;
}): void {
  const { viewer, target, newRole, activeSuperAdminCount } = args;

  if (target.role === newRole) {
    return;
  }

  const isDemotingSelf =
    target._id === viewer._id && newRole !== AdminRole.SUPER_ADMIN;
  if (isDemotingSelf) {
    throw new ConvexError("You cannot remove your own super_admin role");
  }

  const isDemotingActiveSuperAdmin =
    target.role === AdminRole.SUPER_ADMIN &&
    target.status === UserStatus.ACTIVE &&
    newRole !== AdminRole.SUPER_ADMIN;
  if (isDemotingActiveSuperAdmin && activeSuperAdminCount <= 1) {
    throw new ConvexError("Cannot demote the last active super_admin");
  }
}

/**
 * Validate that a deactivation is allowed.
 *
 * Throws ConvexError on:
 *  - target is the viewer (cannot deactivate self)
 *  - target is already deactivated
 *  - target is the last active super_admin
 */
export function assertDeactivationAllowed(args: {
  viewer: AdminLite;
  target: AdminLite;
  activeSuperAdminCount: number;
}): void {
  const { viewer, target, activeSuperAdminCount } = args;

  if (target._id === viewer._id) {
    throw new ConvexError("You cannot deactivate yourself");
  }
  if (target.deleted_at !== undefined) {
    throw new ConvexError("Admin user is already deactivated");
  }
  if (
    target.role === AdminRole.SUPER_ADMIN &&
    target.status === UserStatus.ACTIVE &&
    activeSuperAdminCount <= 1
  ) {
    throw new ConvexError("Cannot deactivate the last active super_admin");
  }
}
