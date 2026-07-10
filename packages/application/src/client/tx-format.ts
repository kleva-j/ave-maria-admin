/**
 * Transaction type + status label maps for user-facing surfaces.
 * Copy follows the design (`avm-screens-1.jsx` / `avm-screens-2.jsx`) — a
 * transaction row's `title` and left-icon direction come from these maps.
 *
 * Kept as a pure module so both React DOM and RN clients import the same
 * strings. Icon names are `IconName` values from the design registry.
 */

export const TxnKind = {
  CREDIT: "credit",
  DEBIT: "debit",
} as const;

export type TxnKind = (typeof TxnKind)[keyof typeof TxnKind];

/**
 * Backend `TxnType` (packages/backend/convex/shared.ts) mapped to a design
 * kind (`credit` / `debit`) that decides the row's color + arrow.
 */
export const TXN_KIND_BY_TYPE: Record<string, TxnKind> = {
  contribution: TxnKind.DEBIT, // debit from wallet → plan
  interest_accrual: TxnKind.CREDIT,
  withdrawal: TxnKind.DEBIT,
  referral_bonus: TxnKind.CREDIT,
  reversal: TxnKind.CREDIT, // negative of the original — display as inflow
  investment_yield: TxnKind.CREDIT,
};

/** Human-readable label for each backend TxnType. */
export const TXN_TYPE_LABEL: Record<string, string> = {
  contribution: "Plan contribution",
  interest_accrual: "Interest earned",
  withdrawal: "Withdrawal",
  referral_bonus: "Referral bonus",
  reversal: "Reversal",
  investment_yield: "Investment yield",
};

/** Design icon name per backend TxnType. */
export const TXN_TYPE_ICON: Record<string, string> = {
  contribution: "arrow-up-right",
  interest_accrual: "arrow-down-left",
  withdrawal: "arrow-up-right",
  referral_bonus: "gift",
  reversal: "refresh-cw",
  investment_yield: "trending-up",
};

/** Amount-prefix helper — matches design (`+` for credit, `−` for debit). */
export function txnAmountPrefix(kind: TxnKind): "+" | "−" {
  return kind === TxnKind.CREDIT ? "+" : "−";
}

/** Withdrawal status → user-facing label (design uses lowercase). */
export const WITHDRAWAL_STATUS_LABEL: Record<string, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  processed: "Processed",
};

/** Withdrawal status → badge variant (matches `Badge` in packages/ui). */
export const WITHDRAWAL_STATUS_VARIANT: Record<
  string,
  "warning" | "success" | "destructive" | "default"
> = {
  pending: "warning",
  approved: "default",
  rejected: "destructive",
  processed: "success",
};

/** Bank verification status → label. */
export const BANK_VERIFY_STATUS_LABEL: Record<string, string> = {
  pending: "Pending verification",
  verified: "Verified",
  rejected: "Verification rejected",
};

export const BANK_VERIFY_STATUS_VARIANT: Record<
  string,
  "warning" | "success" | "destructive"
> = {
  pending: "warning",
  verified: "success",
  rejected: "destructive",
};
