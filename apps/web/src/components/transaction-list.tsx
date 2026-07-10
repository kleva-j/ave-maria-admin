import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@avm-daily/backend/convex/_generated/api";
import type { Doc, Id } from "@avm-daily/backend/convex/_generated/dataModel";
import { Button } from "@avm-daily/ui/components/button";
import { Skeleton } from "@avm-daily/ui/components/skeleton";
import { TxnKind, TXN_KIND_BY_TYPE } from "@avm-daily/application/client";

import { TransactionRow } from "@/components/transaction-row";
import {
  TransactionDetailSheet,
  type TransactionDetail,
} from "@/components/transaction-detail-sheet";
import type { TransactionKindFilter } from "@/components/transaction-filters";

type TxnType = Doc<"transactions">["type"];

/**
 * Paginated list feeder. Uses `usePaginatedQuery` from convex/react so
 * new pages append reactively. Filters other than the backend-native
 * `type` / `planId` (i.e. `kind`) are applied client-side after the page
 * lands.
 *
 * `type` is a validated `TxnType` — the route's search schema (see
 * `routes/_protected/user/transactions/index.tsx`) rejects unknown strings
 * before they reach us, so the Convex validator never sees a stale value.
 */
export function TransactionList({
  kind,
  type,
  planId,
}: {
  kind: TransactionKindFilter;
  type: TxnType | undefined;
  planId: Id<"user_savings_plans"> | undefined;
}) {
  const query = usePaginatedQuery(
    api.transactions.listMine,
    {
      ...(type != null ? { type } : {}),
      ...(planId != null ? { planId } : {}),
    },
    { initialNumItems: 20 },
  );

  const [selectedId, setSelectedId] = useState<Id<"transactions"> | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const kindFilter =
    kind === "all"
      ? (_kind: TxnKind) => true
      : kind === "incoming"
        ? (k: TxnKind) => k === TxnKind.CREDIT
        : (k: TxnKind) => k === TxnKind.DEBIT;

  const rows = (query.results ?? []).filter((tx) =>
    kindFilter(TXN_KIND_BY_TYPE[tx.type] ?? TxnKind.DEBIT),
  );

  const selectedTx: TransactionDetail | null =
    rows.find((r) => r._id === selectedId) ?? null;

  return (
    <div className="mx-5 mt-4 rounded-[18px] border border-border bg-card">
      {query.isLoading && rows.length === 0 ? (
        <div className="p-5 flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-[12px]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          No transactions match your filters.
        </p>
      ) : (
        <div className="px-4">
          {rows.map((tx, i) => (
            <TransactionRow
              key={tx._id}
              tx={tx}
              divider={i < rows.length - 1}
              onClick={() => {
                setSelectedId(tx._id);
                setDetailOpen(true);
              }}
            />
          ))}
        </div>
      )}
      {query.status === "CanLoadMore" && (
        <div className="border-t border-border p-3.5">
          <Button
            variant="ghost"
            size="md"
            className="w-full"
            onClick={() => query.loadMore(20)}
          >
            Load more
          </Button>
        </div>
      )}
      {query.status === "LoadingMore" && (
        <div className="border-t border-border p-3.5">
          <Skeleton className="h-10 w-full rounded-[10px]" />
        </div>
      )}
      <TransactionDetailSheet
        tx={selectedTx}
        open={detailOpen}
        onOpenChange={(next) => {
          setDetailOpen(next);
          if (!next) setSelectedId(null);
        }}
      />
    </div>
  );
}
