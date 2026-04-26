import { describe, expect, it } from "vitest";

import {
  getConvexErrorData,
  isWithdrawalActionForbiddenErrorData,
  isWithdrawalRiskBlockedErrorData,
  normalizeConvexErrorMessage,
} from "@/lib/convex-errors";

describe("convex error helpers", () => {
  it("prefers structured cash withdrawal error messages", () => {
    const error = Object.assign(new Error("Convex action failed"), {
      data: {
        code: "withdrawal_action_forbidden",
        action: "reject",
        method: "cash",
        allowed_roles: ["super-admin", "operations", "finance"],
        message:
          "Cash withdrawals can only be rejected by Finance, Operations, or Super Admin.",
      },
    });

    expect(
      normalizeConvexErrorMessage(error, "Unable to update withdrawal"),
    ).toBe(
      "Cash withdrawals can only be rejected by Finance, Operations, or Super Admin.",
    );
  });

  it("falls back to the standard error message when no structured payload exists", () => {
    const error = new Error("Only approved withdrawals can be processed");

    expect(
      normalizeConvexErrorMessage(error, "Unable to update withdrawal"),
    ).toBe("Only approved withdrawals can be processed");
  });

  it("uses the fallback when the value is not an error", () => {
    expect(
      normalizeConvexErrorMessage(null, "Unable to update withdrawal"),
    ).toBe("Unable to update withdrawal");
  });

  it("recognizes valid structured withdrawal role errors", () => {
    const data = getConvexErrorData({
      data: {
        code: "withdrawal_action_forbidden",
        action: "approve",
        method: "cash",
        allowed_roles: ["super-admin", "operations", "finance"],
        message:
          "Cash withdrawals can only be approved by Finance, Operations, or Super Admin.",
      },
    });

    expect(isWithdrawalActionForbiddenErrorData(data)).toBe(true);
  });

  it("recognizes and normalizes structured withdrawal risk errors", () => {
    const error = Object.assign(new Error("Blocked by risk controls"), {
      data: {
        code: "withdrawal_risk_blocked",
        scope: "withdrawals",
        rule: "manual_hold",
        message:
          "Withdrawals are currently blocked for this user: Compliance review",
        details: {
          hold_id: "hold_1",
        },
      },
    });

    const data = getConvexErrorData(error);

    expect(isWithdrawalRiskBlockedErrorData(data)).toBe(true);
    expect(
      normalizeConvexErrorMessage(error, "Unable to request withdrawal"),
    ).toBe(
      "Withdrawals are currently blocked for this user: Compliance review",
    );
  });
});
