import { Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@avm-daily/backend/convex/_generated/api";
import { Skeleton } from "@avm-daily/ui/components/skeleton";
import { Icon } from "@avm-daily/ui/components/icon";
import { ProgressRing } from "@avm-daily/ui/components/progress-ring";
import { cn } from "@avm-daily/ui/lib/utils";
import {
  formatNaira,
  formatNairaCompact,
  TXN_KIND_BY_TYPE,
  TXN_TYPE_LABEL,
  TxnKind,
  txnAmountPrefix,
} from "@avm-daily/application/client";

import { BalanceHero } from "@/components/balance-hero";
import { QuickActions } from "@/components/quick-actions";
import { OnboardingChecklist } from "@/components/onboarding-checklist";

/**
 * `/user` — the Dashboard home. Composition follows the design's
 * `DashboardScreen`:
 *   greeting → balance hero (with quick actions inside) → onboarding
 *   checklist → goals strip → recent transactions.
 *
 * Goals strip + Recent transactions are shipped in a read-only "preview"
 * shape here. Full plan cards land in PR 02; the full paginated transactions
 * list lands in PR 03. Both preview sections wrap in their own Suspense so
 * the balance hero paints first.
 */
export const Route = createFileRoute("/_protected/user/")({
  component: DashboardHome,
});

function DashboardHome() {
  return (
    <div className="screen-anim pb-8">
      <Greeting />
      <BalanceHero>
        <QuickActions />
      </BalanceHero>
      <OnboardingChecklist />

      <Suspense fallback={<SectionSkeleton title="My Goals" />}>
        <GoalsStrip />
      </Suspense>

      <Suspense fallback={<SectionSkeleton title="Recent" />}>
        <RecentTransactions />
      </Suspense>
    </div>
  );
}

// ─── Greeting ────────────────────────────────────────────────────────────────

function Greeting() {
  const viewerQ = useSuspenseQuery(convexQuery(api.users.viewer, {}));
  const firstName = viewerQ.data?.first_name?.trim() || "there";
  return (
    <header className="flex items-center justify-between px-5 pb-2 pt-5">
      <div>
        <p className="mb-1 text-[13px] text-muted-foreground">Good morning</p>
        <h3 className="font-display text-xl font-bold tracking-[-0.015em] text-foreground">
          {firstName}
        </h3>
      </div>
      <div className="flex gap-2.5">
        <button
          type="button"
          aria-label="Verification status"
          className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-border bg-secondary"
        >
          <Icon name="shield" size={18} color="var(--success)" />
        </button>
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-10 w-10 items-center justify-center rounded-[11px] border border-border bg-secondary"
        >
          <Icon name="bell" size={18} />
          <span className="absolute right-2.5 top-2.5 h-[7px] w-[7px] rounded-full border-2 border-background bg-destructive" />
        </button>
      </div>
    </header>
  );
}

// ─── Goals strip ─────────────────────────────────────────────────────────────

function GoalsStrip() {
  const plansQ = useSuspenseQuery(
    convexQuery(api.savingsPlans.listMine, {}),
  );
  const plans = plansQ.data;

  return (
    <section className="px-5 pt-6">
      <div className="mb-3.5 flex items-center justify-between">
        <h4 className="text-base font-bold text-foreground">My Goals</h4>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {plans.length === 0 && (
          <div className="flex h-[128px] w-full items-center justify-center rounded-[18px] border-[1.5px] border-dashed border-[color-mix(in_oklab,var(--primary)_50%,transparent)] bg-primary-dim px-4 text-center">
            <div>
              <div className="mb-2 flex justify-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-dim">
                  <Icon name="plus" size={20} color="var(--primary)" strokeWidth={2.5} />
                </span>
              </div>
              <div className="text-xs font-semibold text-primary">
                Start your first goal
              </div>
            </div>
          </div>
        )}
        {plans.map((plan) => {
          const pct = Math.round(plan.progress_percentage);
          const name = plan.template_snapshot?.name ?? "Savings goal";
          return (
            <div
              key={plan._id}
              className="flex w-[112px] shrink-0 flex-col items-center gap-2.5 rounded-[18px] border border-border bg-card px-3 py-4"
            >
              <ProgressRing percent={pct} size={60} stroke={5} color="var(--primary)">
                <span className="text-xs font-bold text-primary">{pct}%</span>
              </ProgressRing>
              <div className="text-center">
                <div className="mb-0.5 text-[11px] font-semibold leading-[1.3] text-foreground">
                  {name}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {formatNairaCompact(plan.current_amount_kobo)}
                </div>
              </div>
            </div>
          );
        })}
        {plans.length > 0 && (
          <button
            type="button"
            className="flex w-[112px] shrink-0 flex-col items-center justify-center gap-2 rounded-[18px] border-[1.5px] border-dashed border-[color-mix(in_oklab,var(--primary)_50%,transparent)] bg-primary-dim px-3 py-4"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-dim">
              <Icon name="plus" size={20} color="var(--primary)" strokeWidth={2.5} />
            </span>
            <span className="text-center text-[11px] font-semibold text-primary">
              New goal
            </span>
          </button>
        )}
      </div>
    </section>
  );
}

// ─── Recent transactions ─────────────────────────────────────────────────────

function RecentTransactions() {
  const txQ = useSuspenseQuery(
    convexQuery(api.transactions.listMine, {
      paginationOpts: { cursor: null, numItems: 4 },
    }),
  );
  const rows = txQ.data.page;

  if (rows.length === 0) {
    return (
      <section className="px-5 pt-6">
        <div className="mb-3.5 flex items-center justify-between">
          <h4 className="text-base font-bold text-foreground">Recent</h4>
        </div>
        <p className="rounded-[18px] border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No transactions yet — your first deposit will show up here.
        </p>
      </section>
    );
  }

  return (
    <section className="px-5 pt-6">
      <div className="mb-1 flex items-center justify-between">
        <h4 className="text-base font-bold text-foreground">Recent</h4>
      </div>
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
                  isCredit ? "bg-success-dim" : "bg-destructive-dim",
                )}
              >
                <Icon
                  name={isCredit ? "arrow-down-left" : "arrow-up-right"}
                  size={18}
                  color={isCredit ? "var(--success)" : "var(--destructive)"}
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
              <div className="shrink-0 text-right">
                <div
                  className={cn(
                    "text-sm font-bold",
                    isCredit ? "text-success" : "text-foreground",
                  )}
                >
                  {txnAmountPrefix(kind)}
                  {formatNaira(tx.amount_kobo)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Section skeleton ───────────────────────────────────────────────────────

function SectionSkeleton({ title }: { title: string }) {
  return (
    <section className="px-5 pt-6">
      <div className="mb-3.5 flex items-center justify-between">
        <h4 className="text-base font-bold text-foreground">{title}</h4>
      </div>
      <Skeleton className="h-24 w-full rounded-[18px]" />
    </section>
  );
}
