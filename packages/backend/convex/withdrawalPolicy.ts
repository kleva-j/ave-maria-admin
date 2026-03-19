import type { Withdrawal } from "./types";

import {
  WithdrawalAction,
  WithdrawalMethod,
  WithdrawalStatus,
  AdminRole,
} from "./shared";

export const cashWithdrawalAllowedRoles = [
  AdminRole.SUPER_ADMIN,
  AdminRole.OPERATIONS,
  AdminRole.FINANCE,
] as const;

const cashWithdrawalAdminRoles = new Set<string>(cashWithdrawalAllowedRoles);

const withdrawalActionPastTense = {
  [WithdrawalAction.APPROVE]: WithdrawalStatus.APPROVED,
  [WithdrawalAction.REJECT]: WithdrawalStatus.REJECTED,
  [WithdrawalAction.PROCESS]: WithdrawalStatus.PROCESSED,
} as const;

export type WithdrawalRiskSummaryForPolicy = {
  has_active_hold: boolean;
  block_reason?: string;
};

export type WithdrawalActionCapability = {
  allowed: boolean;
  reason?: string;
};

export type WithdrawalActionCapabilities = {
  approve: WithdrawalActionCapability;
  reject: WithdrawalActionCapability;
  process: WithdrawalActionCapability;
};

function normalizeWithdrawalMethod(method: unknown) {
  return method === WithdrawalMethod.CASH
    ? WithdrawalMethod.CASH
    : WithdrawalMethod.BANK_TRANSFER;
}

export function getCashWithdrawalRoleBlockedMessage(action: WithdrawalAction) {
  return `Cash withdrawals can only be ${withdrawalActionPastTense[action]} by Finance, Operations, or Super Admin.`;
}

export function getCashWithdrawalForbiddenData(action: WithdrawalAction) {
  return {
    code: "withdrawal_action_forbidden" as const,
    action,
    method: WithdrawalMethod.CASH,
    allowed_roles: [...cashWithdrawalAllowedRoles],
    message: getCashWithdrawalRoleBlockedMessage(action),
  };
}

export function getWithdrawalStatusBlockedReason(
  withdrawal: Pick<Withdrawal, "status">,
  action: WithdrawalAction,
) {
  switch (action) {
    case WithdrawalAction.APPROVE:
      return withdrawal.status === WithdrawalStatus.PENDING
        ? undefined
        : "Only pending withdrawals can be approved";
    case WithdrawalAction.REJECT:
      return withdrawal.status === WithdrawalStatus.PENDING
        ? undefined
        : "Only pending withdrawals can be rejected";
    case WithdrawalAction.PROCESS:
      return withdrawal.status === WithdrawalStatus.APPROVED
        ? undefined
        : "Only approved withdrawals can be processed";
  }
}

export function getCashWithdrawalRoleBlockedReason(
  adminRole: AdminRole,
  withdrawal: Pick<Withdrawal, "method">,
  action: WithdrawalAction,
) {
  if (normalizeWithdrawalMethod(withdrawal.method) !== WithdrawalMethod.CASH) {
    return undefined;
  }

  if (cashWithdrawalAdminRoles.has(adminRole)) {
    return undefined;
  }

  return getCashWithdrawalRoleBlockedMessage(action);
}

export function buildWithdrawalActionCapability(
  adminRole: AdminRole,
  withdrawal: Pick<Withdrawal, "status" | "method">,
  action: WithdrawalAction,
  risk: WithdrawalRiskSummaryForPolicy,
): WithdrawalActionCapability {
  const statusReason = getWithdrawalStatusBlockedReason(withdrawal, action);
  if (statusReason) {
    return {
      allowed: false,
      reason: statusReason,
    };
  }

  if (
    risk.has_active_hold &&
    (action === WithdrawalAction.APPROVE || action === WithdrawalAction.PROCESS)
  ) {
    return {
      allowed: false,
      reason:
        risk.block_reason ?? "Withdrawals are currently blocked for this user",
    };
  }

  const roleReason = getCashWithdrawalRoleBlockedReason(
    adminRole,
    withdrawal,
    action,
  );
  if (roleReason) {
    return {
      allowed: false,
      reason: roleReason,
    };
  }

  return {
    allowed: true,
  };
}

export function buildWithdrawalCapabilities(
  adminRole: AdminRole,
  withdrawal: Pick<Withdrawal, "status" | "method">,
  risk: WithdrawalRiskSummaryForPolicy,
): WithdrawalActionCapabilities {
  return {
    approve: buildWithdrawalActionCapability(
      adminRole,
      withdrawal,
      WithdrawalAction.APPROVE,
      risk,
    ),
    reject: buildWithdrawalActionCapability(
      adminRole,
      withdrawal,
      WithdrawalAction.REJECT,
      risk,
    ),
    process: buildWithdrawalActionCapability(
      adminRole,
      withdrawal,
      WithdrawalAction.PROCESS,
      risk,
    ),
  };
}
