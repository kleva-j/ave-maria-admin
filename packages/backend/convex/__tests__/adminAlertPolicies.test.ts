import { describe, expect, it } from "vitest";

import { AdminAlertSeverity, AdminAlertType, AdminRole } from "../shared";
import {
  requiresHealthyConditionForManualResolve,
  getReminderIntervalMs,
  ADMIN_ALERT_POLICIES,
} from "../adminAlertPolicies";

describe("admin alert policies", () => {
  it("routes each alert type to the expected admin roles", () => {
    expect(
      ADMIN_ALERT_POLICIES[AdminAlertType.WITHDRAWALS_PENDING_OLDEST]
        .routingRoles,
    ).toEqual([AdminRole.OPERATIONS, AdminRole.FINANCE, AdminRole.SUPER_ADMIN]);

    expect(
      ADMIN_ALERT_POLICIES[
        AdminAlertType.WITHDRAWALS_APPROVED_UNPROCESSED_OLDEST
      ].routingRoles,
    ).toEqual([AdminRole.OPERATIONS, AdminRole.FINANCE, AdminRole.SUPER_ADMIN]);

    expect(
      ADMIN_ALERT_POLICIES[AdminAlertType.KYC_PENDING_OLDEST].routingRoles,
    ).toEqual([AdminRole.COMPLIANCE, AdminRole.SUPPORT, AdminRole.SUPER_ADMIN]);

    expect(
      ADMIN_ALERT_POLICIES[AdminAlertType.BANK_VERIFICATION_PENDING_OLDEST]
        .routingRoles,
    ).toEqual([
      AdminRole.OPERATIONS,
      AdminRole.COMPLIANCE,
      AdminRole.SUPER_ADMIN,
    ]);

    expect(
      ADMIN_ALERT_POLICIES[AdminAlertType.RECONCILIATION_RUN_FAILED]
        .routingRoles,
    ).toEqual([AdminRole.FINANCE, AdminRole.SUPER_ADMIN]);

    expect(
      ADMIN_ALERT_POLICIES[AdminAlertType.RECONCILIATION_RUN_STALE]
        .routingRoles,
    ).toEqual([AdminRole.FINANCE, AdminRole.SUPER_ADMIN]);

    expect(
      ADMIN_ALERT_POLICIES[AdminAlertType.RECONCILIATION_OPEN_ISSUES]
        .routingRoles,
    ).toEqual([AdminRole.FINANCE, AdminRole.SUPER_ADMIN]);
  });

  it("requires healthy conditions before manual resolution for SLA alerts", () => {
    expect(
      requiresHealthyConditionForManualResolve(
        AdminAlertType.WITHDRAWALS_PENDING_OLDEST,
      ),
    ).toBe(true);
    expect(
      requiresHealthyConditionForManualResolve(
        AdminAlertType.WITHDRAWALS_APPROVED_UNPROCESSED_OLDEST,
      ),
    ).toBe(true);
    expect(
      requiresHealthyConditionForManualResolve(
        AdminAlertType.KYC_PENDING_OLDEST,
      ),
    ).toBe(true);
    expect(
      requiresHealthyConditionForManualResolve(
        AdminAlertType.BANK_VERIFICATION_PENDING_OLDEST,
      ),
    ).toBe(true);
    expect(
      requiresHealthyConditionForManualResolve(
        AdminAlertType.RECONCILIATION_RUN_STALE,
      ),
    ).toBe(true);
    expect(
      requiresHealthyConditionForManualResolve(
        AdminAlertType.RECONCILIATION_OPEN_ISSUES,
      ),
    ).toBe(true);
    expect(
      requiresHealthyConditionForManualResolve(
        AdminAlertType.RECONCILIATION_RUN_FAILED,
      ),
    ).toBe(false);
  });

  it("uses the configured reminder cadence per severity", () => {
    expect(getReminderIntervalMs(AdminAlertSeverity.WARNING)).toBe(
      30 * 60 * 1000,
    );
    expect(getReminderIntervalMs(AdminAlertSeverity.CRITICAL)).toBe(
      15 * 60 * 1000,
    );
  });
});
