import { Suspense } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import type { Id } from "@avm-daily/backend/convex/_generated/dataModel";
import { Skeleton } from "@avm-daily/ui/components/skeleton";
import { Icon } from "@avm-daily/ui/components/icon";

import { PlanTopUpForm } from "@/components/plan-topup-form";

/**
 * /user/plans/$planId/top-up — top-up form on its own route. Chosen over an
 * inline sheet primitive so this PR doesn't drag a Sheet component into
 * `packages/ui` before the withdrawal flow (PR 04) needs the same idiom.
 */
export const Route = createFileRoute("/_protected/user/plans/$planId/top-up")({
  component: TopUpPage,
  parseParams: (raw) => ({ planId: raw.planId as Id<"user_savings_plans"> }),
});

function TopUpPage() {
  const { planId } = Route.useParams();

  return (
    <div className="screen-anim pb-10">
      <header className="flex items-center gap-3 px-5 pb-2 pt-5">
        <Link
          to="/user/plans/$planId"
          params={{ planId }}
          className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-border bg-secondary text-muted-foreground hover:text-foreground"
          aria-label="Back to plan"
        >
          <Icon name="chevron-left" size={18} />
        </Link>
        <div>
          <h2 className="font-display text-[22px] font-bold text-foreground">
            Top up
          </h2>
          <p className="text-sm text-muted-foreground">
            Move funds from your wallet into this goal.
          </p>
        </div>
      </header>

      <Suspense fallback={<FormSkeleton />}>
        <PlanTopUpForm planId={planId} />
      </Suspense>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="mx-5 my-4 flex flex-col gap-6">
      <Skeleton className="h-20 w-full rounded-[18px]" />
      <Skeleton className="h-32 w-full rounded-[22px]" />
      <Skeleton className="h-12 w-full rounded-[14px]" />
    </div>
  );
}
