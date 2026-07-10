import type { Id } from "@avm-daily/backend/convex/_generated/dataModel";

import { Link, createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { Suspense } from "react";
import { z } from "zod";

import { api } from "@avm-daily/backend/convex/_generated/api";
import { Skeleton } from "@avm-daily/ui/components/skeleton";
import { formatNaira } from "@avm-daily/application/client";
import { Button } from "@avm-daily/ui/components/button";
import { Icon } from "@avm-daily/ui/components/icon";

import { WithdrawalList } from "@/components/withdrawal-list";
import { useEligibility } from "@/lib/eligibility";

const searchSchema = z.object({ requestId: z.string().optional() });

export const Route = createFileRoute("/_protected/user/withdrawals/")({
  component: WithdrawalsPage,
  validateSearch: (raw) => searchSchema.parse(raw),
});

function WithdrawalsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const focusId = search.requestId as Id<"withdrawals"> | undefined;

  return (
    <div className="screen-anim pb-8">
      <header className="flex items-start justify-between gap-3 px-5 pb-2 pt-5">
        <div>
          <h2 className="font-display text-[22px] font-bold text-foreground">
            Withdrawals
          </h2>
          <p className="text-sm text-muted-foreground">
            Move funds from your wallet to a verified bank account.
          </p>
        </div>
        <Suspense fallback={null}>
          <NewWithdrawalCta />
        </Suspense>
      </header>

      <Suspense fallback={<AvailableSkeleton />}>
        <AvailableHero />
      </Suspense>

      <Suspense fallback={<ListSkeleton />}>
        <WithdrawalList
          focus={focusId}
          onFocusHandled={() => {
            navigate({ search: { requestId: undefined }, replace: true });
          }}
        />
      </Suspense>
    </div>
  );
}

function NewWithdrawalCta() {
  const eligibility = useEligibility();
  return (
    <Button
      variant="primary"
      size="md"
      disabled={!eligibility.canWithdraw}
      render={
        <Link to="/user/withdrawals/new">
          <Icon name="arrow-up" size={16} />
          New withdrawal
        </Link>
      }
    />
  );
}

function AvailableHero() {
  const availableQ = useSuspenseQuery(
    convexQuery(api.users.availableForWithdrawal, {}),
  );
  const { availableKobo, totalKobo, reservedKobo } = availableQ.data;
  return (
    <div className="mx-5 my-3 overflow-hidden rounded-[22px]">
      <div
        className="relative px-6 py-6"
        style={{ background: "var(--gradient-balance)" }}
      >
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-35 w-35 rounded-full"
          style={{ background: "rgba(255,255,255,0.05)" }}
          aria-hidden
        />
        <div className="relative">
          <p
            className="mb-1.5 text-xs font-semibold uppercase tracking-[0.07em]"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            Available to withdraw
          </p>
          <p className="mb-3 font-display-tight text-[30px] font-bold text-white">
            {formatNaira(availableKobo)}
          </p>
          <div
            className="grid grid-cols-2 gap-3 text-xs"
            style={{ color: "rgba(255,255,255,0.65)" }}
          >
            <div>
              <div>Total wallet</div>
              <div className="mt-0.5 text-sm font-semibold text-white">
                {formatNaira(totalKobo)}
              </div>
            </div>
            <div>
              <div>In flight</div>
              <div className="mt-0.5 text-sm font-semibold text-white">
                {formatNaira(reservedKobo)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AvailableSkeleton() {
  return (
    <div className="mx-5 my-3">
      <Skeleton className="h-35 w-full rounded-[22px]" />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="mx-5 mt-4 flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-16 w-full rounded-[12px]" />
      ))}
    </div>
  );
}
