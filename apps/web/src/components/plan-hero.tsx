import { formatNaira } from "@avm-daily/application/client";
import { ProgressRing } from "@avm-daily/ui/components/progress-ring";
import { Badge } from "@avm-daily/ui/components/badge";

/**
 * Plan detail hero — big gradient card with a large progress ring, current
 * balance, and target. Extrapolated composition (design has no plan-detail
 * screen); reuses design tokens + the balance gradient utility.
 */

type PlanHero = {
  status: string;
  progress_percentage: number;
  current_amount_kobo: bigint;
  custom_target_kobo: bigint;
  remaining_amount_kobo: bigint;
  template_snapshot?: { name: string; description?: string } | undefined;
};

export function PlanHero({ plan }: { plan: PlanHero }) {
  // Clamp to 100 for display — over-funded plans still show 100% in the ring
  // and label instead of confusing values like "142%".
  const pct = Math.min(100, Math.max(0, Math.round(plan.progress_percentage)));
  const name = plan.template_snapshot?.name ?? "Savings goal";

  return (
    <div className="mx-5 my-3 overflow-hidden rounded-[22px]">
      <div
        className="relative flex items-center gap-5 px-6 py-7"
        style={{ background: "var(--gradient-balance)" }}
      >
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-[160px] w-[160px] rounded-full"
          style={{ background: "rgba(255,255,255,0.04)" }}
          aria-hidden
        />
        <ProgressRing percent={pct} size={104} stroke={7} color="#fff" track="rgba(255,255,255,0.2)">
          <span className="font-display text-lg font-bold text-white">
            {pct}%
          </span>
        </ProgressRing>
        <div className="relative flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className="text-xs font-semibold uppercase tracking-[0.08em]"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              {name}
            </span>
            {plan.status === "paused" && <Badge variant="warning">Paused</Badge>}
            {plan.status === "completed" && <Badge variant="success">Completed</Badge>}
          </div>
          <div className="mb-1 font-display-tight text-[28px] font-bold text-white">
            {formatNaira(plan.current_amount_kobo)}
          </div>
          <div className="text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
            of {formatNaira(plan.custom_target_kobo)} target
          </div>
          <div className="mt-2 text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
            {formatNaira(plan.remaining_amount_kobo)} left to reach your goal
          </div>
        </div>
      </div>
    </div>
  );
}
