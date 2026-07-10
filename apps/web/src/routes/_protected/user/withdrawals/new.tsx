import { Link, createFileRoute } from "@tanstack/react-router";
import { Skeleton } from "@avm-daily/ui/components/skeleton";
import { Icon } from "@avm-daily/ui/components/icon";
import { Suspense } from "react";

import { WithdrawalForm } from "@/components/withdrawal-form";

/**
 * /user/withdrawals/new — hosts the WithdrawalForm on its own route.
 */
export const Route = createFileRoute("/_protected/user/withdrawals/new")({
  component: NewWithdrawalPage,
});

function NewWithdrawalPage() {
  return (
    <div className="screen-anim pb-8">
      <header className="flex items-center gap-3 px-5 pb-2 pt-5">
        <Link
          to="/user/withdrawals"
          className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-border bg-secondary text-muted-foreground hover:text-foreground"
          aria-label="Back to withdrawals"
        >
          <Icon name="chevron-left" size={18} />
        </Link>
        <div>
          <h2 className="font-display text-[22px] font-bold text-foreground">
            New withdrawal
          </h2>
          <p className="text-sm text-muted-foreground">
            Choose an amount and the bank we should send it to.
          </p>
        </div>
      </header>

      <Suspense fallback={<FormSkeleton />}>
        <WithdrawalForm />
      </Suspense>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="mx-5 my-4 flex flex-col gap-4">
      <Skeleton className="h-24 w-full rounded-[18px]" />
      <Skeleton className="h-40 w-full rounded-[18px]" />
      <Skeleton className="h-12 w-full rounded-[14px]" />
    </div>
  );
}
