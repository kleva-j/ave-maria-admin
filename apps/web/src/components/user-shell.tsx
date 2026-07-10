import { Link, useRouterState } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@avm-daily/backend/convex/_generated/api";
import { cn } from "@avm-daily/ui/lib/utils";
import { Icon, type IconName } from "@avm-daily/ui/components/icon";
import { formatNaira, formatNairaCompact } from "@avm-daily/application/client";

import { useEligibility } from "@/lib/eligibility";

/**
 * User surface shell — matches `DesktopApp` in the AVM Daily design source.
 *
 * Three columns:
 *  1. Sidebar (248px)          — logo, nav, user footer.
 *  2. Main content (up to 680) — the route's children, with `.screen-anim`
 *                                on route transitions.
 *  3. Right stats panel (280)  — Quick stats + Verification checklist.
 *
 * The whole surface defaults to the `midnight` palette by stamping
 * `data-theme="midnight" class="dark"` on the root wrapper. A theme picker in
 * Settings (Phase 1 §7.6 / follow-up) mutates the attribute later.
 *
 * Right panel data is co-located with the shell. Both the sidebar user chip
 * and the verification checklist subscribe to `users.viewer`; TanStack Query
 * de-duplicates identical `convexQuery` calls behind the scenes so the two
 * `useSuspenseQuery` hooks share one Convex subscription.
 */

type NavItem = { to: string; label: string; icon: IconName };

const NAV_ITEMS: readonly NavItem[] = [
  { to: "/user", label: "Dashboard", icon: "home" },
  { to: "/user/plans", label: "Goals", icon: "target" },
  { to: "/user/withdrawals", label: "Deposit / Withdraw", icon: "wallet" },
  { to: "/user/transactions", label: "Transactions", icon: "clock" },
  { to: "/user/banks", label: "Compliance", icon: "shield" },
  { to: "/user/settings", label: "Settings", icon: "settings" },
];

export function UserShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: ({ location }) => location.pathname });
  const viewerQ = useSuspenseQuery(convexQuery(api.users.viewer, {}));
  const eligibility = useEligibility();

  const viewer = viewerQ.data;
  const initials = [viewer?.first_name?.[0], viewer?.last_name?.[0]].join("").toUpperCase() || "AV";
  const fullName = [viewer?.first_name, viewer?.last_name].filter(Boolean).join(" ") || "Account holder";

  return (
    <div
      data-theme="midnight"
      className="dark flex h-screen w-full overflow-hidden bg-background text-foreground"
    >
      <Sidebar pathname={pathname} initials={initials} fullName={fullName} />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[680px]">{children}</div>
      </main>
      <RightStatsPanel eligibility={eligibility} />
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function Sidebar({
  pathname,
  initials,
  fullName,
}: {
  pathname: string;
  initials: string;
  fullName: string;
}) {
  return (
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-border bg-card px-3.5 py-7 md:flex">
      <Link
        to="/user"
        className="mb-10 flex items-center gap-[11px] px-1.5"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary">
          <Icon name="zap" size={18} color="#fff" strokeWidth={2.2} />
        </div>
        <span className="font-display text-xl font-bold tracking-[-0.015em] text-foreground">
          AVM <span className="text-primary">Daily</span>
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active =
            item.to === "/user"
              ? pathname === "/user"
              : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to as string}
              className={cn(
                "flex items-center gap-[11px] rounded-[11px] border border-transparent px-3 py-2.5 text-sm transition-colors",
                active
                  ? "border-[color-mix(in_oklab,var(--primary)_30%,transparent)] bg-primary-dim font-semibold text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon
                name={item.icon}
                size={18}
                color={active ? "var(--primary)" : "currentColor"}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 flex items-center gap-2.5 border-t border-border pt-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-dim text-[13px] font-bold text-primary">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-foreground">
            {fullName}
          </div>
          <div className="text-[11px] text-muted-foreground">Standard plan</div>
        </div>
        <Link
          to={"/user/settings" as string}
          className="text-[color:var(--subtle)] transition-colors hover:text-foreground"
        >
          <Icon name="settings" size={16} />
        </Link>
      </div>
    </aside>
  );
}

// ─── Right stats panel ───────────────────────────────────────────────────────

function RightStatsPanel({
  eligibility,
}: {
  eligibility: ReturnType<typeof useEligibility>;
}) {
  const viewerQ = useSuspenseQuery(convexQuery(api.users.viewer, {}));
  const availableQ = useSuspenseQuery(
    convexQuery(api.users.availableForWithdrawal, {}),
  );

  const viewer = viewerQ.data;
  const totalKobo = viewer?.total_balance_kobo ?? 0n;
  const savingsKobo = viewer?.savings_balance_kobo ?? 0n;

  const stats = [
    { label: "Balance", value: formatNairaCompact(totalKobo), color: "text-primary" },
    { label: "Savings", value: formatNairaCompact(savingsKobo), color: "text-success" },
    {
      label: "Available",
      value: formatNaira(availableQ.data.availableKobo),
      color: "text-foreground",
    },
  ] as const;

  const checks = [
    { label: "BVN", done: !!viewer?.bvn_encrypted },
    { label: "Government ID", done: eligibility.kycApproved },
    { label: "Bank verified", done: eligibility.hasPrimaryBank },
  ];

  return (
    <aside className="hidden w-[280px] shrink-0 flex-col gap-5 overflow-y-auto border-l border-border bg-card px-5 py-7 lg:flex">
      <section>
        <div className="mb-3.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Quick stats
        </div>
        {stats.map((s) => (
          <div key={s.label} className="mb-4">
            <div className="mb-1 text-xs text-muted-foreground">{s.label}</div>
            <div className={cn("font-display text-xl font-bold", s.color)}>
              {s.value}
            </div>
          </div>
        ))}
      </section>

      <section className="border-t border-border pt-5">
        <div className="mb-3.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Verification
        </div>
        <div className="flex flex-col gap-2.5">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-2.5">
              <div
                className={cn(
                  "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px]",
                  c.done
                    ? "border-success bg-success-dim"
                    : "border-border bg-secondary",
                )}
              >
                {c.done ? (
                  <Icon name="check" size={12} color="var(--success)" strokeWidth={2.5} />
                ) : null}
              </div>
              <span
                className={cn(
                  "text-[13px]",
                  c.done ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {c.label}
              </span>
            </div>
          ))}
        </div>
        {!eligibility.kycApproved && (
          <Link
            to={"/user/banks" as string}
            className="mt-4 block rounded-[12px] border border-[color-mix(in_oklab,var(--primary)_30%,transparent)] bg-primary-dim px-3 py-2.5 text-center text-[13px] font-semibold text-primary transition-colors hover:brightness-110"
          >
            Complete verification
          </Link>
        )}
      </section>
    </aside>
  );
}
