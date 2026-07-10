import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@avm-daily/backend/convex/_generated/api";
import { formatNaira } from "@avm-daily/application/client";
import { Icon } from "@avm-daily/ui/components/icon";

/**
 * BalanceHero — the gradient card at the top of the user Dashboard.
 * Mirrors `DashboardScreen`'s balance card in the design source.
 *
 * Wraps children in the same panel so QuickActions can compose inside it
 * without an extra chrome layer.
 */
export function BalanceHero({ children }: { children?: React.ReactNode }) {
  const availableQ = useSuspenseQuery(
    convexQuery(api.users.availableForWithdrawal, {}),
  );
  const [visible, setVisible] = useState(true);

  return (
    <div className="mx-5 my-3 overflow-hidden rounded-[22px]">
      <div
        className="relative px-6 pb-6 pt-7"
        style={{ background: "var(--gradient-balance)" }}
      >
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-[200px] w-[200px] rounded-full"
          style={{ background: "rgba(255,255,255,0.04)" }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-7 right-16 h-[120px] w-[120px] rounded-full"
          style={{ background: "rgba(255,255,255,0.04)" }}
          aria-hidden
        />
        <div className="relative">
          <div className="mb-1.5 flex items-center justify-between">
            <span
              className="text-xs font-semibold uppercase tracking-[0.08em]"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              Available Balance
            </span>
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              className="rounded p-1 transition-colors hover:bg-white/10"
              aria-label={visible ? "Hide balance" : "Show balance"}
            >
              <Icon
                name={visible ? "eye" : "eye-off"}
                size={17}
                color="rgba(255,255,255,0.6)"
              />
            </button>
          </div>
          <div className="mb-6 font-display-tight text-[32px] font-bold text-white">
            {visible ? formatNaira(availableQ.data.availableKobo) : "₦ ••••••"}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
