import { Suspense } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@avm-daily/backend/convex/_generated/api";
import {
  formatNaira,
} from "@avm-daily/application/client";
import { Skeleton } from "@avm-daily/ui/components/skeleton";
import { Button } from "@avm-daily/ui/components/button";
import { Icon } from "@avm-daily/ui/components/icon";
import { ProgressRing } from "@avm-daily/ui/components/progress-ring";

import { PlanCard } from "@/components/plan-card";

/**
 * /user/plans — list of the viewer's savings plans. Matches the design's
 * `GoalsScreen`: gradient summary card up top, plan cards below, dashed
 * "Create new goal" CTA at the bottom.
 */
export const Route = createFileRoute("/_protected/user/plans/")({
  component: PlansPage,
});

function PlansPage() {
  return (
    <div className="screen-anim pb-8">
      <header className="flex items-center justify-between px-5 pb-2 pt-5">
        <div>
          <h2 className="font-display text-[22px] font-bold text-foreground">
            Savings Goals
          </h2>
          <p className="text-sm text-muted-foreground">
            Track your progress toward every goal
          </p>
        </div>
      </header>

      <Suspense fallback={<HeroSkeleton />}>
        <PlansSummary />
      </Suspense>

      <Suspense fallback={<ListSkeleton />}>
        <PlansList />
      </Suspense>
    </div>
  );
}

function PlansSummary() {
  const plansQ = useSuspenseQuery(convexQuery(api.savingsPlans.listMine, {}));
  const plans = plansQ.data;
  const activePlans = plans.filter(
    (p) => p.status === "active" || p.status === "paused",
  );

  const totalSaved = activePlans.reduce(
    (acc, p) => acc + p.current_amount_kobo,
    0n,
  );
  const totalTarget = activePlans.reduce(
    (acc, p) => acc + p.custom_target_kobo,
    0n,
  );
  const pct =
    totalTarget > 0n
      ? Math.min(100, Math.round(Number((totalSaved * 100n) / totalTarget)))
      : 0;

  return (
    <div className="mx-5 my-3 overflow-hidden rounded-[22px]">
      <div
        className="relative flex items-end gap-4 px-6 py-6"
        style={{ background: "var(--gradient-balance)" }}
      >
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-[140px] w-[140px] rounded-full"
          style={{ background: "rgba(255,255,255,0.05)" }}
          aria-hidden
        />
        <div className="relative flex-1">
          <p
            className="mb-1.5 text-xs font-semibold uppercase tracking-[0.07em]"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            Total Saved
          </p>
          <p className="mb-1 font-display-tight text-[28px] font-bold text-white">
            {formatNaira(totalSaved)}
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
            across {activePlans.length} active goal
            {activePlans.length === 1 ? "" : "s"}
          </p>
        </div>
        <ProgressRing percent={pct} size={64} stroke={5} color="#fff" track="rgba(255,255,255,0.2)">
          <span className="font-display text-[13px] font-bold text-white">
            {pct}%
          </span>
        </ProgressRing>
      </div>
    </div>
  );
}

function PlansList() {
  const plansQ = useSuspenseQuery(convexQuery(api.savingsPlans.listMine, {}));
  const plans = plansQ.data;

  return (
    <div className="mx-5 mt-4 flex flex-col gap-3.5">
      {plans.map((plan) => (
        <PlanCard key={plan._id} plan={plan} />
      ))}
      <Link
        to="/user/plans/new"
        className="flex items-center justify-center gap-2.5 rounded-[18px] border-[1.5px] border-dashed border-border p-5 transition-colors hover:border-[color-mix(in_oklab,var(--primary)_60%,transparent)]"
      >
        <Icon name="plus" size={20} color="var(--primary)" />
        <span className="text-sm font-semibold text-primary">
          Create new goal
        </span>
      </Link>
      {plans.length === 0 && (
        <div className="rounded-[18px] border border-border bg-card p-6 text-center">
          <div className="mb-4">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary-dim">
              <Icon name="target" size={24} color="var(--primary)" />
            </span>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            No goals yet. Start with a plan template and set your target.
          </p>
          <Button
            variant="primary"
            size="md"
            render={<Link to="/user/plans/new">Start your first goal</Link>}
          />

        </div>
      )}
    </div>
  );
}

function HeroSkeleton() {
  return (
    <div className="mx-5 my-3">
      <Skeleton className="h-[130px] w-full rounded-[22px]" />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="mx-5 mt-4 flex flex-col gap-3.5">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[126px] w-full rounded-[18px]" />
      ))}
    </div>
  );
}
