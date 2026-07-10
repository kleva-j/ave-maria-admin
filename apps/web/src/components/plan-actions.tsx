import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { toast } from "@avm-daily/ui/components/sonner";
import { api } from "@avm-daily/backend/convex/_generated/api";
import type { Id } from "@avm-daily/backend/convex/_generated/dataModel";
import { Button } from "@avm-daily/ui/components/button";
import { Icon } from "@avm-daily/ui/components/icon";

import { useEligibility } from "@/lib/eligibility";

/**
 * Row of primary + secondary actions on the plan detail:
 *  - Top up:  routes to /user/plans/$planId/top-up (respects eligibility;
 *             disabled unless the plan is `active` — the backend rejects
 *             contributions to paused/closed/expired plans).
 *  - Pause / Resume: toggles plan status.
 *  - Close:    ends the plan (destructive; confirmed via window.confirm()).
 */
export function PlanActions({
  planId,
  status,
}: {
  planId: Id<"user_savings_plans">;
  status: string;
}) {
  const navigate = useNavigate();
  const eligibility = useEligibility();

  const pause = useMutation(api.savingsPlans.pause);
  const resume = useMutation(api.savingsPlans.resume);
  const close = useMutation(api.savingsPlans.close);

  const paused = status === "paused";
  const closed = status === "completed" || status === "expired";
  const canTopUp = status === "active" && eligibility.canTopUp;

  const handlePause = async () => {
    try {
      if (paused) {
        await resume({ planId });
        toast.success("Plan resumed");
      } else {
        await pause({ planId });
        toast.success("Plan paused");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const handleClose = async () => {
    const ok = window.confirm(
      "Close this plan? Contributions will stop. This cannot be undone.",
    );
    if (!ok) return;
    try {
      await close({ planId });
      toast.success("Plan closed");
      void navigate({ to: "/user/plans" as string });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <div className="mx-5 mt-4 flex flex-wrap gap-2.5">
      <Button
        variant="primary"
        size="md"
        disabled={!canTopUp}
        onClick={() =>
          navigate({
            to: "/user/plans/$planId/top-up" as string,
            params: { planId },
          })
        }
      >
        <Icon name="plus" size={16} />
        Top up
      </Button>
      <Button
        variant="secondary"
        size="md"
        disabled={closed}
        onClick={() => void handlePause()}
      >
        <Icon name={paused ? "refresh-cw" : "clock"} size={16} />
        {paused ? "Resume" : "Pause"}
      </Button>
      <Button
        variant="ghost"
        size="md"
        disabled={closed}
        onClick={() => void handleClose()}
      >
        <Icon name="x" size={16} />
        Close plan
      </Button>
    </div>
  );
}
