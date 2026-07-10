import { Suspense } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Skeleton } from "@avm-daily/ui/components/skeleton";
import { Icon } from "@avm-daily/ui/components/icon";

import { PlanCreateForm } from "@/components/plan-create-form";

/**
 * /user/plans/new — plan-create route. Renders the composed
 * `PlanCreateForm` (template picker → target + confirm). Extrapolated from
 * design (no dedicated create screen present).
 */
export const Route = createFileRoute("/_protected/user/plans/new")({
  component: NewPlanPage,
});

function NewPlanPage() {
  return (
    <div className="screen-anim pb-8">
      <header className="flex items-center gap-3 px-5 pb-2 pt-5">
        <Link
          to="/user/plans"
          className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-border bg-secondary text-muted-foreground hover:text-foreground"
          aria-label="Back to plans"
        >
          <Icon name="chevron-left" size={18} />
        </Link>
        <div>
          <h2 className="font-display text-[22px] font-bold text-foreground">
            Create a goal
          </h2>
          <p className="text-sm text-muted-foreground">
            Pick a template, set your target, and start saving.
          </p>
        </div>
      </header>

      <Suspense fallback={<FormSkeleton />}>
        <PlanCreateForm />
      </Suspense>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="mx-5 my-4 flex flex-col gap-4">
      <Skeleton className="h-32 w-full rounded-[18px]" />
      <Skeleton className="h-32 w-full rounded-[18px]" />
    </div>
  );
}
