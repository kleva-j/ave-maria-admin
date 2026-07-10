import { Link } from "@tanstack/react-router";
import { formatNairaCompact } from "@avm-daily/application/client";
import type { Id } from "@avm-daily/backend/convex/_generated/dataModel";
import { Badge } from "@avm-daily/ui/components/badge";
import { Icon } from "@avm-daily/ui/components/icon";
import { ProgressRing } from "@avm-daily/ui/components/progress-ring";
import { cn } from "@avm-daily/ui/lib/utils";

/**
 * Plan card row — used on the /user/plans list. Mirrors the design's
 * `GoalsScreen` list card: progress ring on the left, name + amounts in the
 * middle, status badge on the right, thin progress bar underneath.
 *
 * A "click anywhere on the card" affordance opens the plan detail.
 */

type PlanCardData = {
  _id: Id<"user_savings_plans">;
  status: string;
  progress_percentage: number;
  current_amount_kobo: bigint;
  custom_target_kobo: bigint;
  template_snapshot?: { name: string } | undefined;
};

const STATUS_VARIANT: Record<string, "success" | "warning" | "muted" | "default"> = {
  active: "default",
  paused: "warning",
  completed: "success",
  expired: "muted",
};

const STATUS_LABEL: Record<string, string> = {
  active: "On track",
  paused: "Paused",
  completed: "Completed",
  expired: "Ended",
};

export function PlanCard({ plan }: { plan: PlanCardData }) {
  // Clamp display + bar width to 0..100 — over-funded plans stay at 100%.
  const pct = Math.min(100, Math.max(0, Math.round(plan.progress_percentage)));
  const name = plan.template_snapshot?.name ?? "Savings goal";
  const status = plan.status;

  return (
    <Link
      to={"/user/plans/$planId" as string}
      params={{ planId: plan._id }}
      className="block rounded-[18px] border border-border bg-card p-5 transition-colors hover:border-[color-mix(in_oklab,var(--primary)_50%,transparent)]"
    >
      <div className="mb-4 flex items-center gap-3.5">
        <ProgressRing percent={pct} size={56} stroke={5}>
          <Icon name="target" size={16} color="var(--primary)" />
        </ProgressRing>
        <div className="flex-1">
          <div className="mb-1 text-[15px] font-bold text-foreground">{name}</div>
          <div className="text-xs text-muted-foreground">
            {formatNairaCompact(plan.current_amount_kobo)}{" "}
            <span className="text-[color:var(--subtle)]">
              of {formatNairaCompact(plan.custom_target_kobo)}
            </span>
          </div>
        </div>
        <Badge variant={STATUS_VARIANT[status] ?? "default"}>
          {STATUS_LABEL[status] ?? status}
        </Badge>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[color-mix(in_oklab,currentColor_8%,transparent)]">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            status === "paused" ? "bg-warning" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </Link>
  );
}
