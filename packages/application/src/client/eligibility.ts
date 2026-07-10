/**
 * Pure eligibility computation. React hooks that call `api.users.viewer` and
 * `api.bankAccounts.listMineMasked` live per-app (`apps/web/src/lib/`,
 * `apps/native/lib/`) and delegate here.
 *
 * A user is:
 *   - `kycApproved`   when their user record's status is `active`. In this
 *                     schema completing KYC transitions status from
 *                     `pending_kyc` → `active`.
 *   - `hasPrimaryBank` when at least one bank account is `verified` AND
 *                     marked primary.
 *
 * Derived quick-action gates:
 *   - `canCreatePlan`: kycApproved && status !== suspended/closed
 *   - `canTopUp`:      canCreatePlan
 *   - `canWithdraw`:   kycApproved && hasPrimaryBank
 *
 * `reason` is a short user-facing string that a Tooltip renders on a disabled
 * button. Empty when everything passes.
 */

export type EligibilityUser = {
  status: string;
};

export type EligibilityBankAccount = {
  is_primary: boolean;
  verification_status: string;
};

export interface EligibilityInput {
  user: EligibilityUser | null | undefined;
  bankAccounts: readonly EligibilityBankAccount[] | null | undefined;
}

export interface Eligibility {
  kycApproved: boolean;
  hasPrimaryBank: boolean;
  isActive: boolean;
  canCreatePlan: boolean;
  canTopUp: boolean;
  canWithdraw: boolean;
  reason: string;
}

const USER_ACTIVE = "active";
const USER_PENDING_KYC = "pending_kyc";
const USER_SUSPENDED = "suspended";
const USER_CLOSED = "closed";
const BANK_VERIFIED = "verified";

const DEFAULT: Eligibility = {
  kycApproved: false,
  hasPrimaryBank: false,
  isActive: false,
  canCreatePlan: false,
  canTopUp: false,
  canWithdraw: false,
  reason: "Complete signup to continue",
};

export function computeEligibility(input: EligibilityInput): Eligibility {
  const { user, bankAccounts } = input;
  if (!user) return DEFAULT;

  const isActive = user.status === USER_ACTIVE;
  const kycApproved = isActive;
  const hasPrimaryBank = (bankAccounts ?? []).some(
    (b) => b.is_primary && b.verification_status === BANK_VERIFIED,
  );

  const canCreatePlan = kycApproved;
  const canTopUp = kycApproved;
  const canWithdraw = kycApproved && hasPrimaryBank;

  const reason = pickReason({
    status: user.status,
    kycApproved,
    hasPrimaryBank,
  });

  return {
    kycApproved,
    hasPrimaryBank,
    isActive,
    canCreatePlan,
    canTopUp,
    canWithdraw,
    reason,
  };
}

function pickReason(state: {
  status: string;
  kycApproved: boolean;
  hasPrimaryBank: boolean;
}): string {
  if (state.status === USER_SUSPENDED) return "Account suspended";
  if (state.status === USER_CLOSED) return "Account closed";
  if (state.status === USER_PENDING_KYC || !state.kycApproved)
    return "Complete identity verification to continue";
  if (!state.hasPrimaryBank)
    return "Add and verify a bank account to continue";
  return "";
}
