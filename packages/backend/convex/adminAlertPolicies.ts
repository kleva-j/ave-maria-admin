import {
  AdminAlertSeverity,
  AdminAlertScope,
  AdminAlertType,
  AdminRole,
} from "./shared";

type AdminRoleValue = (typeof AdminRole)[keyof typeof AdminRole];
type AdminAlertTypeValue = (typeof AdminAlertType)[keyof typeof AdminAlertType];
type AdminAlertScopeValue =
  (typeof AdminAlertScope)[keyof typeof AdminAlertScope];
type AdminAlertSeverityValue =
  (typeof AdminAlertSeverity)[keyof typeof AdminAlertSeverity];

export type AdminAlertPolicy = {
  alertType: AdminAlertTypeValue;
  scope: AdminAlertScopeValue;
  routingRoles: readonly AdminRoleValue[];
  requiresHealthyConditionForManualResolve: boolean;
};

export const ADMIN_ALERT_POLICIES: Record<
  AdminAlertTypeValue,
  AdminAlertPolicy
> = {
  [AdminAlertType.WITHDRAWALS_PENDING_OLDEST]: {
    alertType: AdminAlertType.WITHDRAWALS_PENDING_OLDEST,
    scope: AdminAlertScope.WITHDRAWALS,
    routingRoles: [
      AdminRole.OPERATIONS,
      AdminRole.FINANCE,
      AdminRole.SUPER_ADMIN,
    ],
    requiresHealthyConditionForManualResolve: true,
  },
  [AdminAlertType.WITHDRAWALS_APPROVED_UNPROCESSED_OLDEST]: {
    alertType: AdminAlertType.WITHDRAWALS_APPROVED_UNPROCESSED_OLDEST,
    scope: AdminAlertScope.WITHDRAWALS,
    routingRoles: [
      AdminRole.OPERATIONS,
      AdminRole.FINANCE,
      AdminRole.SUPER_ADMIN,
    ],
    requiresHealthyConditionForManualResolve: true,
  },
  [AdminAlertType.KYC_PENDING_OLDEST]: {
    alertType: AdminAlertType.KYC_PENDING_OLDEST,
    scope: AdminAlertScope.KYC,
    routingRoles: [
      AdminRole.COMPLIANCE,
      AdminRole.SUPPORT,
      AdminRole.SUPER_ADMIN,
    ],
    requiresHealthyConditionForManualResolve: true,
  },
  [AdminAlertType.BANK_VERIFICATION_PENDING_OLDEST]: {
    alertType: AdminAlertType.BANK_VERIFICATION_PENDING_OLDEST,
    scope: AdminAlertScope.BANK_VERIFICATION,
    routingRoles: [
      AdminRole.OPERATIONS,
      AdminRole.COMPLIANCE,
      AdminRole.SUPER_ADMIN,
    ],
    requiresHealthyConditionForManualResolve: true,
  },
  [AdminAlertType.RECONCILIATION_RUN_FAILED]: {
    alertType: AdminAlertType.RECONCILIATION_RUN_FAILED,
    scope: AdminAlertScope.RECONCILIATION,
    routingRoles: [AdminRole.FINANCE, AdminRole.SUPER_ADMIN],
    requiresHealthyConditionForManualResolve: false,
  },
  [AdminAlertType.RECONCILIATION_RUN_STALE]: {
    alertType: AdminAlertType.RECONCILIATION_RUN_STALE,
    scope: AdminAlertScope.RECONCILIATION,
    routingRoles: [AdminRole.FINANCE, AdminRole.SUPER_ADMIN],
    requiresHealthyConditionForManualResolve: true,
  },
  [AdminAlertType.RECONCILIATION_OPEN_ISSUES]: {
    alertType: AdminAlertType.RECONCILIATION_OPEN_ISSUES,
    scope: AdminAlertScope.RECONCILIATION,
    routingRoles: [AdminRole.FINANCE, AdminRole.SUPER_ADMIN],
    requiresHealthyConditionForManualResolve: true,
  },
};

export function getAdminAlertPolicy(alertType: AdminAlertTypeValue) {
  return ADMIN_ALERT_POLICIES[alertType];
}

export function requiresHealthyConditionForManualResolve(
  alertType: AdminAlertTypeValue,
) {
  return getAdminAlertPolicy(alertType)
    .requiresHealthyConditionForManualResolve;
}

export function getReminderIntervalMs(
  severity: AdminAlertSeverityValue,
): number {
  return severity === AdminAlertSeverity.CRITICAL
    ? 15 * 60 * 1000
    : 30 * 60 * 1000;
}
