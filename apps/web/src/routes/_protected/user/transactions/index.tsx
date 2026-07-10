import { Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@avm-daily/backend/convex/_generated/api";
import type { Id } from "@avm-daily/backend/convex/_generated/dataModel";
import { z } from "zod";
import { Skeleton } from "@avm-daily/ui/components/skeleton";
import { Icon } from "@avm-daily/ui/components/icon";
import {
  formatNairaCompact,
  TXN_KIND_BY_TYPE,
  TxnKind,
} from "@avm-daily/application/client";

import {
  TransactionFilters,
  type TransactionFilterState,
  type TransactionKindFilter,
  type TransactionTypeFilter,
} from "@/components/transaction-filters";
import { TransactionList } from "@/components/transaction-list";

/**
 * /user/transactions — paginated history for the viewer. Filter state is
 * URL-persisted via TSR `useSearch` so a filtered view is shareable.
 *
 * Backend-native filters (`type`, `planId`) fold into the underlying
 * `transactions.listMine` query; `kind` (all/incoming/outgoing) is applied
 * client-side after the page lands.
 */

// Backend TxnType values — keep in sync with packages/backend/convex/shared.ts.
// Bounces stale/hostile URLs so an unknown `type` never reaches the Convex
// validator (which would throw a ConvexError back to the client).
const TXN_TYPE_ENUM = [
  "contribution",
  "interest_accrual",
  "withdrawal",
  "referral_bonus",
  "reversal",
  "investment_yield",
] as const satisfies readonly TransactionTypeFilter[];

const searchSchema = z.object({
  kind: z.enum(["all", "incoming", "outgoing"]).default("all"),
  type: z.enum(TXN_TYPE_ENUM).optional(),
  planId: z.string().optional(),
});

export const Route = createFileRoute("/_protected/user/transactions/")({
  component: TransactionsPage,
  validateSearch: (raw) => searchSchema.parse(raw),
});

function TransactionsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const filters: TransactionFilterState = {
    kind: search.kind as TransactionKindFilter,
    type: search.type,
    planId: search.planId as Id<"user_savings_plans"> | undefined,
  };

  const updateFilters = (next: TransactionFilterState) => {
    void navigate({
      search: {
        kind: next.kind,
        type: next.type,
        planId: next.planId,
      },
      replace: true,
    });
  };

  return (
    <div className="screen-anim pb-8">
      <header className="flex items-center justify-between px-5 pb-2 pt-5">
        <div>
          <h2 className="font-display text-[22px] font-bold text-foreground">
            Transactions
          </h2>
          <p className="text-sm text-muted-foreground">
            Every move in and out of your wallet and goals.
          </p>
        </div>
      </header>

      <Suspense fallback={<SummarySkeleton />}>
        <TransactionSummary />
      </Suspense>

      <Suspense fallback={<FiltersSkeleton />}>
        <TransactionFilters value={filters} onChange={updateFilters} />
      </Suspense>

      <TransactionList
        kind={filters.kind}
        type={filters.type}
        planId={filters.planId}
      />
    </div>
  );
}

/**
 * Summary pills over the first page of results — matches the design's
 * `HistoryScreen` top row. Sums are approximate: they only cover the first
 * 100 transactions to keep the query cheap. A precise all-time aggregate
 * belongs on the backend and is left as a follow-up ticket.
 */
function TransactionSummary() {
  const txQ = useSuspenseQuery(
    convexQuery(api.transactions.listMine, {
      paginationOpts: { cursor: null, numItems: 100 },
    }),
  );
  const rows = txQ.data.page;

  let totalIn = 0n;
  let totalOut = 0n;
  for (const tx of rows) {
    const kind = TXN_KIND_BY_TYPE[tx.type] ?? TxnKind.DEBIT;
    if (kind === TxnKind.CREDIT) totalIn += tx.amount_kobo;
    else totalOut += tx.amount_kobo;
  }

  const pills = [
    {
      key: "in",
      label: "Total in",
      value: totalIn,
      icon: "arrow-down-left" as const,
      color: "var(--success)",
      bg: "bg-success-dim",
    },
    {
      key: "out",
      label: "Total out",
      value: totalOut,
      icon: "arrow-up-right" as const,
      color: "var(--destructive)",
      bg: "bg-destructive-dim",
    },
  ];

  return (
    <div className="mx-5 mt-4 grid grid-cols-2 gap-3">
      {pills.map((p) => (
        <div
          key={p.key}
          className="rounded-[14px] border border-border bg-card p-4"
        >
          <div className="mb-2 flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-lg ${p.bg}`}
            >
              <Icon name={p.icon} size={14} color={p.color} strokeWidth={2.5} />
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              {p.label}
            </span>
          </div>
          <div className="text-base font-bold text-foreground">
            {formatNairaCompact(p.value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="mx-5 mt-4 grid grid-cols-2 gap-3">
      {[0, 1].map((i) => (
        <Skeleton key={i} className="h-[74px] w-full rounded-[14px]" />
      ))}
    </div>
  );
}

function FiltersSkeleton() {
  return (
    <div className="mx-5 mt-4 flex flex-col gap-3">
      <Skeleton className="h-9 w-52 rounded-full" />
      <Skeleton className="h-10 w-full rounded-[12px]" />
    </div>
  );
}
