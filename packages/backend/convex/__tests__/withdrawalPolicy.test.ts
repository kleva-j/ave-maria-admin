import { describe, expect, it } from "vitest";

import {
  getCashWithdrawalForbiddenData,
  buildWithdrawalCapabilities,
} from "../withdrawalPolicy";

import {
  WithdrawalAction,
  WithdrawalMethod,
  WithdrawalStatus,
  AdminRole,
} from "../shared";

describe("withdrawal policy helpers", () => {
  it("allows finance to approve and reject cash withdrawals", () => {
    const capabilities = buildWithdrawalCapabilities(
      AdminRole.FINANCE,
      {
        status: WithdrawalStatus.PENDING,
        method: WithdrawalMethod.CASH,
      } as never,
      { has_active_hold: false },
    );

    expect(capabilities.approve).toEqual({ allowed: true });
    expect(capabilities.reject).toEqual({ allowed: true });
    expect(capabilities.process).toEqual({
      allowed: false,
      reason: "Only approved withdrawals can be processed",
    });
  });

  it("blocks support from handling cash withdrawals", () => {
    const capabilities = buildWithdrawalCapabilities(
      AdminRole.SUPPORT,
      {
        status: WithdrawalStatus.PENDING,
        method: WithdrawalMethod.CASH,
      } as never,
      { has_active_hold: false },
    );

    expect(capabilities.approve.allowed).toBe(false);
    expect(capabilities.reject.allowed).toBe(false);
    expect(capabilities.approve.reason).toContain(
      "Finance, Operations, or Super Admin",
    );
    expect(capabilities.reject.reason).toContain(
      "Finance, Operations, or Super Admin",
    );
  });

  it("blocks approval when a hold is active but still allows rejection", () => {
    const capabilities = buildWithdrawalCapabilities(
      AdminRole.OPERATIONS,
      {
        status: WithdrawalStatus.PENDING,
        method: WithdrawalMethod.BANK_TRANSFER,
      } as never,
      {
        has_active_hold: true,
        block_reason: "Withdrawals are frozen pending review",
      },
    );

    expect(capabilities.approve).toEqual({
      allowed: false,
      reason: "Withdrawals are frozen pending review",
    });
    expect(capabilities.reject).toEqual({ allowed: true });
    expect(capabilities.process).toEqual({
      allowed: false,
      reason: "Only approved withdrawals can be processed",
    });
  });

  it("returns structured forbidden payloads for stale-state errors", () => {
    expect(getCashWithdrawalForbiddenData(WithdrawalAction.REJECT)).toEqual({
      code: "withdrawal_action_forbidden",
      action: WithdrawalAction.REJECT,
      method: WithdrawalMethod.CASH,
      allowed_roles: [
        AdminRole.SUPER_ADMIN,
        AdminRole.OPERATIONS,
        AdminRole.FINANCE,
      ],
      message:
        "Cash withdrawals can only be rejected by Finance, Operations, or Super Admin.",
    });
  });
});
