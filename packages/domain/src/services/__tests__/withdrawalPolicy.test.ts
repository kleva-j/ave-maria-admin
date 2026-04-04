import * as fc from "fast-check";

import { describe, it, expect } from "vitest";

import { AdminRole, WithdrawalMethod, WithdrawalStatus } from "../../enums";
import {
  getCashWithdrawalRoleBlockedReason,
  getWithdrawalStatusBlockedReason,
  buildWithdrawalActionCapability,
  getCashWithdrawalForbiddenData,
  buildWithdrawalCapabilities,
} from "../withdrawalPolicy";

describe("withdrawalPolicy", () => {
  describe("getWithdrawalStatusBlockedReason", () => {
    it("should allow approve on pending withdrawal", () => {
      const result = getWithdrawalStatusBlockedReason(
        { status: "pending" },
        "approve",
      );
      expect(result).toBeUndefined();
    });

    it("should block approve on approved withdrawal", () => {
      const result = getWithdrawalStatusBlockedReason(
        { status: "approved" },
        "approve",
      );
      expect(result).toBe("Only pending withdrawals can be approved");
    });

    it("should block reject on approved withdrawal", () => {
      const result = getWithdrawalStatusBlockedReason(
        { status: "approved" },
        "reject",
      );
      expect(result).toBe("Only pending withdrawals can be rejected");
    });

    it("should block process on pending withdrawal", () => {
      const result = getWithdrawalStatusBlockedReason(
        { status: "pending" },
        "process",
      );
      expect(result).toBe("Only approved withdrawals can be processed");
    });

    it("should allow process on approved withdrawal", () => {
      const result = getWithdrawalStatusBlockedReason(
        { status: "approved" },
        "process",
      );
      expect(result).toBeUndefined();
    });
  });

  describe("getCashWithdrawalRoleBlockedReason", () => {
    it("should not block bank transfers", () => {
      const result = getCashWithdrawalRoleBlockedReason(
        "support",
        { method: "bank_transfer" },
        "approve",
      );
      expect(result).toBeUndefined();
    });

    it("should block cash withdrawals for support role", () => {
      const result = getCashWithdrawalRoleBlockedReason(
        "support",
        { method: "cash" },
        "approve",
      );
      expect(result).toBe(
        "Cash withdrawals can only be approved by Finance, Operations, or Super Admin.",
      );
    });

    it("should allow cash withdrawals for finance role", () => {
      const result = getCashWithdrawalRoleBlockedReason(
        "finance",
        { method: "cash" },
        "approve",
      );
      expect(result).toBeUndefined();
    });

    it("should allow cash withdrawals for operations role", () => {
      const result = getCashWithdrawalRoleBlockedReason(
        "operations",
        { method: "cash" },
        "process",
      );
      expect(result).toBeUndefined();
    });

    it("should allow cash withdrawals for super_admin role", () => {
      const result = getCashWithdrawalRoleBlockedReason(
        "super_admin",
        { method: "cash" },
        "reject",
      );
      expect(result).toBeUndefined();
    });
  });

  describe("buildWithdrawalActionCapability", () => {
    it("should allow all actions when status allows and no risk holds", () => {
      const capability = buildWithdrawalActionCapability(
        "support",
        { status: "pending", method: "bank_transfer" },
        "approve",
        { has_active_hold: false },
      );
      expect(capability.allowed).toBe(true);
    });

    it("should block when risk hold exists for approve action", () => {
      const capability = buildWithdrawalActionCapability(
        "support",
        { status: "pending", method: "bank_transfer" },
        "approve",
        { has_active_hold: true, block_reason: "Suspicious activity" },
      );
      expect(capability.allowed).toBe(false);
      expect(capability.reason).toBe("Suspicious activity");
    });

    it("should not block reject when risk hold exists (reject is always allowed)", () => {
      const capability = buildWithdrawalActionCapability(
        "support",
        { status: "pending", method: "bank_transfer" },
        "reject",
        { has_active_hold: true, block_reason: "Under review" },
      );
      expect(capability.allowed).toBe(true);
    });

    it("should allow reject action even with risk hold", () => {
      const capability = buildWithdrawalActionCapability(
        "support",
        { status: "pending", method: "bank_transfer" },
        "reject",
        { has_active_hold: true },
      );
      expect(capability.allowed).toBe(true);
    });

    it("should block cash withdrawals for unauthorized roles", () => {
      const capability = buildWithdrawalActionCapability(
        "support",
        { status: "pending", method: "cash" },
        "approve",
        { has_active_hold: false },
      );
      expect(capability.allowed).toBe(false);
      expect(capability.reason).toContain("Cash withdrawals can only be");
    });
  });

  describe("buildWithdrawalCapabilities", () => {
    it("should build all action capabilities", () => {
      const capabilities = buildWithdrawalCapabilities(
        "support",
        { status: "pending", method: "bank_transfer" },
        { has_active_hold: false },
      );
      expect(capabilities.approve.allowed).toBe(true);
      expect(capabilities.reject.allowed).toBe(true);
      expect(capabilities.process.allowed).toBe(false);
    });
  });

  describe("getCashWithdrawalForbiddenData", () => {
    it("should return proper error data", () => {
      const data = getCashWithdrawalForbiddenData("approve");
      expect(data.code).toBe("withdrawal_action_forbidden");
      expect(data.action).toBe("approve");
      expect(data.method).toBe("cash");
      expect(data.allowed_roles).toContain("finance");
      expect(data.allowed_roles).toContain("operations");
      expect(data.allowed_roles).toContain("super_admin");
    });
  });
});

const allAdminRoles = Object.values(AdminRole);
const allWithdrawalStatuses = Object.values(WithdrawalStatus);
const allWithdrawalMethods = Object.values(WithdrawalMethod);

const cashAllowedRoles: AdminRole[] = [
  AdminRole.SUPER_ADMIN,
  AdminRole.OPERATIONS,
  AdminRole.FINANCE,
];
const cashBlockedRoles = allAdminRoles.filter(
  (r) => !cashAllowedRoles.includes(r),
);

describe("Property 13: buildWithdrawalCapabilities invariants", () => {
  // Validates: Requirements 13.2

  it("approve.allowed and reject.allowed are false when status is not PENDING", () => {
    const nonPendingStatuses = allWithdrawalStatuses.filter(
      (s) => s !== WithdrawalStatus.PENDING,
    );
    fc.assert(
      fc.property(
        fc.constantFrom(...allAdminRoles),
        fc.constantFrom(...nonPendingStatuses),
        fc.constantFrom(...allWithdrawalMethods),
        fc.boolean(),
        (role, status, method, hasHold) => {
          const caps = buildWithdrawalCapabilities(
            role,
            { status, method },
            { has_active_hold: hasHold },
          );
          return (
            caps.approve.allowed === false && caps.reject.allowed === false
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("process.allowed is false when status is not APPROVED", () => {
    const nonApprovedStatuses = allWithdrawalStatuses.filter(
      (s) => s !== WithdrawalStatus.APPROVED,
    );
    fc.assert(
      fc.property(
        fc.constantFrom(...allAdminRoles),
        fc.constantFrom(...nonApprovedStatuses),
        fc.constantFrom(...allWithdrawalMethods),
        fc.boolean(),
        (role, status, method, hasHold) => {
          const caps = buildWithdrawalCapabilities(
            role,
            { status, method },
            { has_active_hold: hasHold },
          );
          return caps.process.allowed === false;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("approve.allowed and process.allowed are false when has_active_hold is true", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allAdminRoles),
        fc.constantFrom(...allWithdrawalStatuses),
        fc.constantFrom(...allWithdrawalMethods),
        fc.string({ minLength: 0, maxLength: 64 }),
        (role, status, method, blockReason) => {
          const caps = buildWithdrawalCapabilities(
            role,
            { status, method },
            { has_active_hold: true, block_reason: blockReason || undefined },
          );
          return (
            caps.approve.allowed === false && caps.process.allowed === false
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("approve, reject, and process are all false for CASH method with non-privileged roles", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...cashBlockedRoles),
        fc.constantFrom(...allWithdrawalStatuses),
        fc.boolean(),
        (role, status, hasHold) => {
          const caps = buildWithdrawalCapabilities(
            role,
            { status, method: WithdrawalMethod.CASH },
            { has_active_hold: hasHold },
          );
          return (
            caps.approve.allowed === false &&
            caps.reject.allowed === false &&
            caps.process.allowed === false
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("privileged roles can approve/reject PENDING CASH withdrawals without a hold", () => {
    fc.assert(
      fc.property(fc.constantFrom(...cashAllowedRoles), (role) => {
        const caps = buildWithdrawalCapabilities(
          role,
          { status: WithdrawalStatus.PENDING, method: WithdrawalMethod.CASH },
          { has_active_hold: false },
        );
        return caps.approve.allowed === true && caps.reject.allowed === true;
      }),
      { numRuns: 100 },
    );
  });

  it("result always has exactly the three keys: approve, reject, process", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allAdminRoles),
        fc.constantFrom(...allWithdrawalStatuses),
        fc.constantFrom(...allWithdrawalMethods),
        fc.boolean(),
        (role, status, method, hasHold) => {
          const caps = buildWithdrawalCapabilities(
            role,
            { status, method },
            { has_active_hold: hasHold },
          );
          const keys = Object.keys(caps).sort();
          return (
            keys.length === 3 &&
            keys[0] === "approve" &&
            keys[1] === "process" &&
            keys[2] === "reject"
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
