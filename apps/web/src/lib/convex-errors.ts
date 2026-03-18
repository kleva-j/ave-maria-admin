import {
  WithdrawalMethod,
  WithdrawalAction,
  AdminRole,
} from "@avm-daily/backend/convex/shared";

const WITHDRAWAL_ACTION_FORBIDDEN_CODE = "withdrawal_action_forbidden";

export type WithdrawalActionForbiddenErrorData = {
  code: typeof WITHDRAWAL_ACTION_FORBIDDEN_CODE;
  action: WithdrawalAction;
  method: typeof WithdrawalMethod.CASH;
  allowed_roles: AdminRole[];
  message: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getConvexErrorData(error: unknown): unknown {
  if (!isRecord(error) || !("data" in error)) {
    return undefined;
  }

  return error.data;
}

export function isWithdrawalActionForbiddenErrorData(
  value: unknown,
): value is WithdrawalActionForbiddenErrorData {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.code === WITHDRAWAL_ACTION_FORBIDDEN_CODE &&
    (value.action === WithdrawalAction.APPROVE ||
      value.action === WithdrawalAction.REJECT ||
      value.action === WithdrawalAction.PROCESS) &&
    value.method === WithdrawalMethod.CASH &&
    Array.isArray(value.allowed_roles) &&
    value.allowed_roles.every((role) => typeof role === "string") &&
    typeof value.message === "string"
  );
}

/**
 * Normalize Convex mutation/action failures into admin-friendly text.
 *
 * Future withdrawal review screens should:
 * - disable action buttons using server-returned capabilities
 * - render capability reasons inline with FieldError
 * - use this helper for stale-data or direct-call mutation failures
 */
export function normalizeConvexErrorMessage(error: unknown, fallback: string) {
  const data = getConvexErrorData(error);

  if (isWithdrawalActionForbiddenErrorData(data)) {
    return data.message;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}
