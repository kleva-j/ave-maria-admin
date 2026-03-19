import { AdminRole } from "@avm-daily/backend/convex/shared";

const ADMIN_ROLE_VALUES = new Set<string>([
  AdminRole.SUPER_ADMIN,
  AdminRole.OPERATIONS,
  AdminRole.COMPLIANCE,
  AdminRole.FINANCE,
  AdminRole.SUPPORT,
]);

export function isAdminRole(
  role?: string | null,
  roles?: string[] | null,
  permissions?: string[] | null,
) {
  const allRoles = [role, ...(roles ?? [])].filter(
    (value): value is string => Boolean(value),
  );

  if (allRoles.some((value) => ADMIN_ROLE_VALUES.has(value))) {
    return true;
  }

  return (permissions ?? []).includes("admin");
}
