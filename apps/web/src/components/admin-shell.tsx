import { Link, useRouterState } from "@tanstack/react-router";
import { api } from "@avm-daily/backend/convex/_generated/api";
import { Button } from "@avm-daily/ui/components/button";
import { Badge } from "@avm-daily/ui/components/badge";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@avm-daily/ui/lib/utils";

type AdminShellProps = {
  admin: {
    first_name: string;
    last_name: string;
    email: string;
    role: string;
  };
  children: React.ReactNode;
};

const navigationItems = [
  { to: "/admin", label: "Overview" },
  { to: "/admin/alerts", label: "Alerts" },
  { to: "/admin/withdrawals", label: "Withdrawals" },
  { to: "/admin/kyc", label: "KYC" },
  { to: "/admin/bank-verification", label: "Bank Verification" },
  { to: "/admin/reconciliation", label: "Reconciliation" },
] as const;

export function AdminShell({ admin, children }: AdminShellProps) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const unreadAlertsQuery = useQuery({
    ...convexQuery(api.adminAlerts.getMyUnreadCount, {}),
    retry: false,
  });
  const unreadCount = unreadAlertsQuery.data?.unreadCount ?? 0;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
                Admin Console
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                Operations
              </h1>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {[admin.first_name, admin.last_name].join(" ").trim()}
                  </p>
                  <p className="text-xs text-zinc-500">{admin.email}</p>
                </div>
                <Badge variant="secondary">{admin.role}</Badge>
              </div>
            </div>
          </div>

          <nav className="mt-6 space-y-2">
            {navigationItems.map((item) => {
              const active =
                pathname === item.to ||
                (item.to !== "/admin" && pathname.startsWith(item.to));

              return (
                <Button
                  key={item.to}
                  variant={active ? "default" : "outline"}
                  className={cn(
                    "w-full justify-start rounded-2xl",
                    !active && "border-zinc-200 bg-transparent text-zinc-700",
                  )}
                  render={
                    <Link to={item.to}>
                      <span className="flex w-full items-center justify-between gap-3">
                        <span>{item.label}</span>
                        {item.to === "/admin/alerts" && unreadCount > 0 ? (
                          <Badge variant={active ? "secondary" : "outline"}>
                            {unreadCount}
                          </Badge>
                        ) : null}
                      </span>
                    </Link>
                  }
                />
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
