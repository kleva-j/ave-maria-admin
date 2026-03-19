/**
 * Withdrawal Policy & Action Capabilities Engine
 * 
 * Determines which administrative actions can be performed on withdrawal requests
 * by evaluating role-based permissions, status constraints, and risk assessments.
 * 
 * @module withdrawalPolicy
 */

import type { Withdrawal } from "./types";

import {
  WithdrawalAction,
  WithdrawalMethod,
  WithdrawalStatus,
  AdminRole,
} from "./shared";

/**
 * Admin roles authorized to process cash withdrawals
 * Finance, Operations, and Super Admin only (stricter controls)
 */
export const cashWithdrawalAllowedRoles = [
  AdminRole.SUPER_ADMIN,
  AdminRole.OPERATIONS,
  AdminRole.FINANCE,
] as const;

// Create Set for O(1) role lookup
const cashWithdrawalAdminRoles = new Set<string>(cashWithdrawalAllowedRoles);

/**
 * Maps withdrawal actions to their past-tense equivalents for status transitions
 */
const withdrawalActionPastTense = {
  [WithdrawalAction.APPROVE]: WithdrawalStatus.APPROVED,
  [WithdrawalAction.REJECT]: WithdrawalStatus.REJECTED,
  [WithdrawalAction.PROCESS]: WithdrawalStatus.PROCESSED,
} as const;

/**
 * Simplified risk summary used by policy engine for decision making
 */
export type WithdrawalRiskSummaryForPolicy = {
  has_active_hold: boolean;
  block_reason?: string;
};

/**
 * Result of evaluating a single withdrawal action
 * - allowed=true: Action can proceed
 * - allowed=false: Action blocked with reason
 */
export type WithdrawalActionCapability = {
  allowed: boolean;
  reason?: string;
};

/**
 * Complete capability matrix for all three withdrawal actions
 * Used by admin dashboards to enable/disable action buttons
 */
export type WithdrawalActionCapabilities = {
  approve: WithdrawalActionCapability;
  reject: WithdrawalActionCapability;
  process: WithdrawalActionCapability;
};

/**
 * Safely normalizes withdrawal method to enum value
 * Handles invalid or undefined method values
 * 
 * @param method - Unknown method value to normalize
 * @returns WithdrawalMethod.CASH or WithdrawalMethod.BANK_TRANSFER
 */
function normalizeWithdrawalMethod(method: unknown) {
  return method === WithdrawalMethod.CASH
    ? WithdrawalMethod.CASH
    : WithdrawalMethod.BANK_TRANSFER;
}

/**
 * Generates standardized block message for cash withdrawal role restrictions
 * 
 * @param action - The withdrawal action being attempted
 * @returns Formatted message indicating required roles
 */
export function getCashWithdrawalRoleBlockedMessage(action: WithdrawalAction) {
  return `Cash withdrawals can only be ${withdrawalActionPastTense[action]} by Finance, Operations, or Super Admin.`;
}

/**
 * Returns structured error data for cash withdrawal forbidden cases
 * 
 * @param action - The blocked withdrawal action
 * @returns Error data object with code, action, method, and allowed roles
 */
export function getCashWithdrawalForbiddenData(action: WithdrawalAction) {
  return {
    code: "withdrawal_action_forbidden" as const,
    action,
    method: WithdrawalMethod.CASH,
    allowed_roles: [...cashWithdrawalAllowedRoles],
    message: getCashWithdrawalRoleBlockedMessage(action),
  };
}

/**
 * Validates that an action is appropriate for the withdrawal's current status
 * 
 * Rules:
 * - APPROVE: Only PENDING withdrawals
 * - REJECT: Only PENDING withdrawals
 * - PROCESS: Only APPROVED withdrawals
 * 
 * @param withdrawal - Withdrawal with status field
 * @param action - Action being evaluated
 * @returns Undefined if allowed, block reason string if blocked
 */
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

/**
 * Checks if admin role permits cash withdrawal action
 * 
 * Bank transfers: All admin roles allowed
 * Cash withdrawals: Only FINANCE, OPERATIONS, SUPER_ADMIN allowed
 * 
 * @param adminRole - Admin's role for permission check
 * @param withdrawal - Withdrawal with method field
 * @param action - Action being evaluated
 * @returns Undefined if allowed, block reason string if blocked
 */
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

/**
 * Evaluates all rules for a single withdrawal action and returns capability
 * 
 * Evaluation order (priority highest to lowest):
 * 1. Status constraints (workflow validation)
 * 2. Risk holds (fraud prevention)
 * 3. Role permissions (access control)
 * 
 * @param adminRole - Admin's role for permission check
 * @param withdrawal - Withdrawal with status and method
 * @param action - Action to evaluate (APPROVE/REJECT/PROCESS)
 * @param risk - Risk summary from risk assessment
 * @returns Capability object with allowed status and optional reason
 */
export function buildWithdrawalActionCapability(
  adminRole: AdminRole,
  withdrawal: Pick<Withdrawal, "status" | "method">,
  action: WithdrawalAction,
  risk: WithdrawalRiskSummaryForPolicy
): WithdrawalActionCapability {
  // Step 1: Check status constraints (highest priority)
  const statusReason = getWithdrawalStatusBlockedReason(withdrawal, action);
  if (statusReason) {
    return {
      allowed: false,
      reason: statusReason,
    };
  }

  // Step 2: Check risk holds (only blocks approve/process, not reject)
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

  // Step 3: Check role permissions (cash withdrawals only)
  const roleReason = getCashWithdrawalRoleBlockedReason(
    adminRole,
    withdrawal,
    action
  );
  if (roleReason) {
    return {
      allowed: false,
      reason: roleReason,
    };
  }

  // All checks passed - action allowed
  return {
    allowed: true,
  };
}

/**
 * Builds complete capability matrix for all three withdrawal actions
 * 
 * Convenience wrapper that calls buildWithdrawalActionCapability
 * for APPROVE, REJECT, and PROCESS actions.
 * 
 * @param adminRole - Admin's role for permission checks
 * @param withdrawal - Withdrawal with status and method
 * @param risk - Risk summary from risk assessment
 * @returns Complete capability matrix with all three actions
 */
export function buildWithdrawalCapabilities(
  adminRole: AdminRole,
  withdrawal: Pick<Withdrawal, "status" | "method">,
  risk: WithdrawalRiskSummaryForPolicy
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
