import { Suspense, useEffect } from "react";
import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { Skeleton } from "@avm-daily/ui/components/skeleton";

import {
  isUserDashboardEnabledFromEnv,
  useIsUserDashboardEnabled,
} from "@/lib/feature-flags";
import { UserShell } from "@/components/user-shell";

/**
 * Layout route for the Phase 1 user surface.
 *
 * Gating happens twice:
 *   1. `beforeLoad` reads the build-time env override; if it's the disabled
 *      value, the user is bounced to the legacy `/dashboard` before the shell
 *      hydrates.
 *   2. The component subscribes to the PostHog flag; if the cohort rollout
 *      turns the user off after mount (mid-session flag change), a
 *      client-side redirect fires. `undefined` is treated as "still loading"
 *      so users aren't bounced before their cohort resolves.
 */
export const Route = createFileRoute("/_protected/user")({
  beforeLoad: () => {
    const envValue =
      (import.meta.env.VITE_FF_USER_DASHBOARD_V1 as string | undefined) ??
      undefined;
    if (envValue === "false") {
      throw redirect({ to: "/dashboard" });
    }
    if (!isUserDashboardEnabledFromEnv()) {
      // env unset — defer to the PostHog gate on the client. Fall through.
    }
  },
  component: UserLayout,
});

function UserLayout() {
  const enabled = useIsUserDashboardEnabled();
  const navigate = useNavigate();

  useEffect(() => {
    const envValue = import.meta.env.VITE_FF_USER_DASHBOARD_V1 as
      | string
      | undefined;
    // env value locks the gate — PostHog only decides when env is unset.
    if (envValue === "true" || envValue === "false") return;
    // Only redirect on an explicit `false` from PostHog. `undefined` means
    // the client hasn't loaded flags yet — keep the shell mounted and wait.
    if (enabled === false) {
      void navigate({ to: "/dashboard", replace: true });
    }
  }, [enabled, navigate]);

  return (
    <Suspense fallback={<UserShellFallback />}>
      <UserShell>
        <Outlet />
      </UserShell>
    </Suspense>
  );
}

function UserShellFallback() {
  return (
    <div
      data-theme="midnight"
      className="dark flex h-screen w-full items-center justify-center bg-background"
    >
      <Skeleton className="h-32 w-64 rounded-3xl" />
    </div>
  );
}
