import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@avm-daily/backend/convex/_generated/api";
import type { Doc, Id } from "@avm-daily/backend/convex/_generated/dataModel";
import { cn } from "@avm-daily/ui/lib/utils";

/**
 * Filter controls for /user/transactions. Design's `HistoryScreen` shows
 * chip-style filters — we keep that for `kind` (All / Incoming / Outgoing)
 * and add roadmap-required selects for `type` (backend TxnType) and `plan`.
 *
 * State is externalized so the route can persist it to the URL search params.
 */

export type TransactionKindFilter = "all" | "incoming" | "outgoing";
export type TransactionTypeFilter = Doc<"transactions">["type"];

export type TransactionFilterState = {
  kind: TransactionKindFilter;
  type: TransactionTypeFilter | undefined;
  planId: Id<"user_savings_plans"> | undefined;
};

type Props = {
  value: TransactionFilterState;
  onChange: (next: TransactionFilterState) => void;
};

const KIND_CHIPS: readonly TransactionKindFilter[] = [
  "all",
  "incoming",
  "outgoing",
];

const KIND_LABEL: Record<TransactionKindFilter, string> = {
  all: "All",
  incoming: "Incoming",
  outgoing: "Outgoing",
};

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "contribution", label: "Plan contributions" },
  { value: "interest_accrual", label: "Interest earned" },
  { value: "withdrawal", label: "Withdrawals" },
  { value: "referral_bonus", label: "Referral bonuses" },
  { value: "reversal", label: "Reversals" },
  { value: "investment_yield", label: "Investment yield" },
];

export function TransactionFilters({ value, onChange }: Props) {
  const plansQ = useSuspenseQuery(convexQuery(api.savingsPlans.listMine, {}));
  const plans = plansQ.data;

  return (
    <div className="mx-5 mt-4 flex flex-col gap-3">
      <div className="flex gap-2">
        {KIND_CHIPS.map((kind) => (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={value.kind === kind}
            aria-pressed={value.kind === kind}
            onClick={() => onChange({ ...value, kind })}
            className={cn(
              "rounded-full border px-4 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              value.kind === kind
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {KIND_LABEL[kind]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="flex-1">
          <span className="sr-only">Transaction type</span>
          <select
            value={value.type ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                type:
                  e.target.value === ""
                    ? undefined
                    : (e.target.value as TransactionTypeFilter),
              })
            }
            className="w-full rounded-[12px] border border-border bg-card px-3 py-2 text-sm text-foreground"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1">
          <span className="sr-only">Plan</span>
          <select
            value={value.planId ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                planId:
                  e.target.value === ""
                    ? undefined
                    : (e.target.value as Id<"user_savings_plans">),
              })
            }
            className="w-full rounded-[12px] border border-border bg-card px-3 py-2 text-sm text-foreground"
          >
            <option value="">All goals</option>
            {plans.map((p) => (
              <option key={p._id} value={p._id}>
                {p.template_snapshot?.name ?? "Goal"}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
