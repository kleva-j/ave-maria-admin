import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@avm-daily/backend/convex/_generated/api";
import { Icon, type IconName } from "@avm-daily/ui/components/icon";
import { cn } from "@avm-daily/ui/lib/utils";

import { useEligibility } from "@/lib/eligibility";

/**
 * Post-signup checklist — three steps to full access. Auto-hides once all
 * three are done. Mirrors the design's tri-state style (done/pending/locked)
 * but uses expandable cards inline instead of an accordion, matching
 * `KYCScreen`'s idiom.
 */

type Step = {
  id: string;
  label: string;
  desc: string;
  icon: IconName;
  done: boolean;
  href: string;
};

export function OnboardingChecklist() {
  const eligibility = useEligibility();
  const viewerQ = useSuspenseQuery(convexQuery(api.users.viewer, {}));
  const viewer = viewerQ.data;

  const madeFirstDeposit = (viewer?.total_balance_kobo ?? 0n) > 0n;

  const steps: readonly Step[] = [
    {
      id: "kyc",
      label: "Verify your identity",
      desc: "Complete KYC to unlock savings, transfers, and withdrawals.",
      icon: "shield",
      done: eligibility.kycApproved,
      href: "/user/banks",
    },
    {
      id: "bank",
      label: "Add a verified bank account",
      desc: "Verify the account you'll use to fund savings and receive payouts.",
      icon: "building",
      done: eligibility.hasPrimaryBank,
      href: "/user/banks",
    },
    {
      id: "deposit",
      label: "Make your first deposit",
      desc: "Fund your wallet to start saving toward your first goal.",
      icon: "arrow-down",
      done: madeFirstDeposit,
      href: "/user/withdrawals",
    },
  ];

  const allDone = steps.every((s) => s.done);
  if (allDone) return null;

  return (
    <section className="mx-5 mt-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h4 className="text-base font-bold text-foreground">Get set up</h4>
        <span className="text-xs text-muted-foreground">
          {steps.filter((s) => s.done).length} of {steps.length} complete
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {steps.map((s) => (
          <Link
            key={s.id}
            to={s.href as string}
            className={cn(
              "flex items-center gap-3.5 rounded-[18px] border-[1.5px] bg-card p-4 transition-colors",
              s.done
                ? "border-[color-mix(in_oklab,var(--success)_40%,transparent)]"
                : "border-border hover:border-[color-mix(in_oklab,var(--primary)_60%,transparent)]",
            )}
          >
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px]",
                s.done ? "bg-success-dim" : "bg-primary-dim",
              )}
            >
              <Icon
                name={s.done ? "check-circle" : s.icon}
                size={22}
                color={s.done ? "var(--success)" : "var(--primary)"}
              />
            </div>
            <div className="flex-1">
              <div className="mb-1 text-[15px] font-bold text-foreground">
                {s.label}
              </div>
              <div className="text-xs leading-[1.4] text-muted-foreground">
                {s.desc}
              </div>
            </div>
            <Icon name="chevron-right" size={16} color="var(--subtle)" />
          </Link>
        ))}
      </div>
    </section>
  );
}
