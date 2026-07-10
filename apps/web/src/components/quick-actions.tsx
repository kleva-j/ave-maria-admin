import { useNavigate } from "@tanstack/react-router";
import { toast } from "@avm-daily/ui/components/sonner";
import { Icon, type IconName } from "@avm-daily/ui/components/icon";
import { cn } from "@avm-daily/ui/lib/utils";

import { useEligibility } from "@/lib/eligibility";

/**
 * QuickActions — the 3-tile row of primary CTAs at the bottom of BalanceHero.
 * Matches the design's `DashboardScreen` action grid: Deposit / Withdraw /
 * Transfer, each on the same glassy tile.
 *
 * Eligibility gate: taps on disabled actions surface `eligibility.reason` via
 * a toast (design uses tooltips — RN parity, no browser hover, so toast is
 * the shared idiom). PR 04 wires actual routes; for now Deposit/Transfer land
 * on a placeholder toast until the merged Deposit-Withdraw screen ships.
 */

type Action = {
  label: string;
  icon: IconName;
  onClick: () => void;
  enabled: boolean;
};

export function QuickActions() {
  const navigate = useNavigate();
  const eligibility = useEligibility();

  const withdraw = () => {
    void navigate({ to: "/user/withdrawals/new" as string });
  };

  const soon = (label: string) => () => {
    toast(`${label} arrives with the next release`);
  };

  const actions: readonly Action[] = [
    {
      label: "Deposit",
      icon: "arrow-down",
      onClick: soon("Deposit"),
      enabled: eligibility.kycApproved,
    },
    {
      label: "Withdraw",
      icon: "arrow-up",
      onClick: withdraw,
      enabled: eligibility.canWithdraw,
    },
    {
      label: "Transfer",
      icon: "send",
      onClick: soon("Transfers"),
      enabled: eligibility.kycApproved,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          onClick={() => {
            if (!a.enabled) {
              toast(eligibility.reason || `${a.label} not available yet`);
              return;
            }
            a.onClick();
          }}
          aria-disabled={!a.enabled}
          className={cn(
            "flex flex-col items-center gap-2 rounded-[14px] px-2 py-3.5 backdrop-blur-sm transition-colors",
            "border border-white/10 bg-white/10 text-white",
            "hover:bg-white/[0.14] aria-disabled:opacity-50 aria-disabled:hover:bg-white/10",
          )}
        >
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white/15">
            <Icon name={a.icon} size={16} color="#fff" strokeWidth={2} />
          </span>
          <span className="text-xs font-semibold">{a.label}</span>
        </button>
      ))}
    </div>
  );
}
