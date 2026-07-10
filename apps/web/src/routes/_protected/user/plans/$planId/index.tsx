import { Suspense } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@avm-daily/backend/convex/_generated/api";
import type { Id } from "@avm-daily/backend/convex/_generated/dataModel";
import { Skeleton } from "@avm-daily/ui/components/skeleton";
import { Icon } from "@avm-daily/ui/components/icon";
import {
  formatNaira,
  TXN_KIND_BY_TYPE,
  TXN_TYPE_LABEL,
  TxnKind,
  txnAmountPrefix,
} from "@avm-daily/application/client";
import { cn } from "@avm-daily/ui/lib/utils";

import { PlanHero } from "@/components/plan-hero";
import { PlanActions } from "@/components/plan-actions";

/**
 * /user/plans/$planId — plan detail. Composition:
 *   back-link → hero → actions row → plan transaction history preview.
 * Extrapolated from the design (no plan-detail screen exists).
 */
export const Route = createFileRoute("/_protected/user/plans/$planId/")({
  component: PlanDetailPage,
  parseParams: (raw) => ({ planId: raw.planId as Id<"user_savings_plans"> }),
});

function PlanDetailPage() {
  const { planId } = Route.useParams();

  return (
    <div className="screen-anim pb-10">
      <header className="flex items-center gap-3 px-5 pb-2 pt-5">
        <Link
          to="/user/plans"
          className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-border bg-secondary text-muted-foreground hover:text-foreground"
          aria-label="Back to plans"
        >
          <Icon name="chevron-left" size={18} />
        </Link>
        <div>
          <h2 className="font-display text-[20px] font-bold text-foreground">
            Goal detail
          </h2>
        </div>
      </header>

      <Suspense fallback={<HeroSkeleton />}>
        <PlanBody planId={planId} />
      </Suspense>
    </div>
  );
}

function PlanBody({ planId }: { planId: Id<"user_savings_plans"> }) {
  const planQ = useSuspenseQuery(
    convexQuery(api.savingsPlans.get, { planId }),
  );
  const plan = planQ.data;

  return (
    <>
      <PlanHero plan={plan} />
      <PlanActions planId={planId} status={plan.status} />

      <section className="px-5 pt-6">
        <h4 className="mb-3 text-[15px] font-bold text-foreground">
          Contributions
        </h4>
        <Suspense fallback={<Skeleton className="h-32 w-full rounded-[18px]" />}>
          <PlanTransactions planId={planId} />
        </Suspense>
      </section>
    </>
  );
}

function PlanTransactions({ planId }: { planId: Id<"user_savings_plans"> }) {
  const txQ = useSuspenseQuery(
    convexQuery(api.transactions.listMine, {
      paginationOpts: { cursor: null, numItems: 10 },
      planId,
    }),
  );
  const rows = txQ.data.page;

  if (rows.length === 0) {
    return (
      <p className="rounded-[18px] border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        No contributions yet — top up to see your history here.
      </p>
    );
  }

  return (
    <div>
      {rows.map((tx, i) => {
        const kind = TXN_KIND_BY_TYPE[tx.type] ?? TxnKind.DEBIT;
        const isCredit = kind === TxnKind.CREDIT;
        return (
          <div
            key={tx._id}
            className={cn(
              "flex items-center gap-3.5 py-3.5",
              i < rows.length - 1 && "border-b border-border",
            )}
          >
            <div
              className={cn(
                "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[12px]",
                isCredit ? "bg-success-dim" : "bg-primary-dim",
              )}
            >
              <Icon
                name={isCredit ? "arrow-down-left" : "arrow-up-right"}
                size={18}
                color={isCredit ? "var(--success)" : "var(--primary)"}
                strokeWidth={2}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 truncate text-sm font-medium text-foreground">
                {TXN_TYPE_LABEL[tx.type] ?? tx.type}
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(tx.created_at).toLocaleString("en-NG", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
            </div>
            <div
              className={cn(
                "shrink-0 text-right text-sm font-bold",
                isCredit ? "text-success" : "text-foreground",
              )}
            >
              {txnAmountPrefix(kind)}
              {formatNaira(tx.amount_kobo)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HeroSkeleton() {
  return (
    <div className="mx-5 my-3">
      <Skeleton className="h-[160px] w-full rounded-[22px]" />
    </div>
  );
}
