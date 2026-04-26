import { AdminRole } from "@avm-daily/domain";

const ADMIN_ROLE_VALUES = new Set<AdminRole>(Object.values(AdminRole));

export function isAdminRole(
  role?: AdminRole | string | null,
  roles?: (AdminRole | string)[] | null,
  permissions?: string[] | null,
) {
  const allRoles = [role, ...(roles ?? [])].filter(
    (value): value is AdminRole => ADMIN_ROLE_VALUES.has(value as AdminRole),
  );

  if (allRoles.some((value) => ADMIN_ROLE_VALUES.has(value))) {
    return true;
  }

  return (permissions ?? []).includes("admin");
}
