import type {
  WithdrawalAction,
  WithdrawalMethod,
  WithdrawalStatus,
  AdminRole,
} from "../enums";

import {
  WithdrawalAction as WA,
  WithdrawalMethod as WM,
  WithdrawalStatus as WS,
  AdminRole as AR,
} from "../enums";

export const cashWithdrawalAllowedRoles = [
  AR.SUPER_ADMIN,
  AR.OPERATIONS,
  AR.FINANCE,
] as const;

const cashWithdrawalAdminRoles = new Set<string>(cashWithdrawalAllowedRoles);

const withdrawalActionPastTense: Record<WithdrawalAction, WithdrawalStatus> = {
  [WA.APPROVE]: WS.APPROVED,
  [WA.REJECT]: WS.REJECTED,
  [WA.PROCESS]: WS.PROCESSED,
};

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
  return method === WM.CASH ? WM.CASH : WM.BANK_TRANSFER;
}

export function getCashWithdrawalRoleBlockedMessage(action: WithdrawalAction) {
  return `Cash withdrawals can only be ${withdrawalActionPastTense[action]} by Finance, Operations, or Super Admin.`;
}

export function getCashWithdrawalForbiddenData(action: WithdrawalAction) {
  return {
    code: "withdrawal_action_forbidden" as const,
    action,
    method: WM.CASH,
    allowed_roles: [...cashWithdrawalAllowedRoles],
    message: getCashWithdrawalRoleBlockedMessage(action),
  };
}

export function getWithdrawalStatusBlockedReason(
  withdrawal: Pick<{ status: WithdrawalStatus }, "status">,
  action: WithdrawalAction,
): string | undefined {
  switch (action) {
    case WA.APPROVE:
      return withdrawal.status === WS.PENDING
        ? undefined
        : "Only pending withdrawals can be approved";
    case WA.REJECT:
      return withdrawal.status === WS.PENDING ||
        withdrawal.status === WS.APPROVED
        ? undefined
        : "Only pending or approved withdrawals can be rejected";
    case WA.PROCESS:
      return withdrawal.status === WS.APPROVED
        ? undefined
        : "Only approved withdrawals can be processed";
  }
}

export function getCashWithdrawalRoleBlockedReason(
  adminRole: AdminRole,
  withdrawal: Pick<{ method: WithdrawalMethod }, "method">,
  action: WithdrawalAction,
): string | undefined {
  if (normalizeWithdrawalMethod(withdrawal.method) !== WM.CASH) {
    return undefined;
  }

  if (cashWithdrawalAdminRoles.has(adminRole)) {
    return undefined;
  }

  return getCashWithdrawalRoleBlockedMessage(action);
}

export function buildWithdrawalActionCapability(
  adminRole: AdminRole,
  withdrawal: Pick<
    { status: WithdrawalStatus; method: WithdrawalMethod },
    "status" | "method"
  >,
  action: WithdrawalAction,
  risk: WithdrawalRiskSummaryForPolicy,
): WithdrawalActionCapability {
  const statusReason = getWithdrawalStatusBlockedReason(withdrawal, action);
  if (statusReason) {
    return { allowed: false, reason: statusReason };
  }

  if (
    risk.has_active_hold &&
    (action === WA.APPROVE || action === WA.PROCESS)
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
    return { allowed: false, reason: roleReason };
  }

  return { allowed: true };
}

export function buildWithdrawalCapabilities(
  adminRole: AdminRole,
  withdrawal: Pick<
    { status: WithdrawalStatus; method: WithdrawalMethod },
    "status" | "method"
  >,
  risk: WithdrawalRiskSummaryForPolicy,
): WithdrawalActionCapabilities {
  return {
    approve: buildWithdrawalActionCapability(
      adminRole,
      withdrawal,
      WA.APPROVE,
      risk,
    ),
    reject: buildWithdrawalActionCapability(
      adminRole,
      withdrawal,
      WA.REJECT,
      risk,
    ),
    process: buildWithdrawalActionCapability(
      adminRole,
      withdrawal,
      WA.PROCESS,
      risk,
    ),
  };
}
