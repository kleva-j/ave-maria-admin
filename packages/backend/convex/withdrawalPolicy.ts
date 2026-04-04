/**
 * Withdrawal Policy & Action Capabilities Engine
 * 
 * Determines which administrative actions can be performed on withdrawal requests
 * by evaluating role-based permissions, status constraints, and risk assessments.
 * 
 * All business logic lives in @avm-daily/domain — this module re-exports it
 * so that the Infrastructure Layer has a single import point.
 * 
 * @module withdrawalPolicy
 */

// Re-export all policy functions and types from the Domain Layer (single source of truth)
export {
  buildWithdrawalCapabilities,
  buildWithdrawalActionCapability,
  getCashWithdrawalForbiddenData,
  getCashWithdrawalRoleBlockedMessage,
  getWithdrawalStatusBlockedReason,
  getCashWithdrawalRoleBlockedReason,
  cashWithdrawalAllowedRoles,
} from "@avm-daily/domain";

export type {
  WithdrawalActionCapabilities,
  WithdrawalActionCapability,
  WithdrawalRiskSummaryForPolicy,
} from "@avm-daily/domain";
