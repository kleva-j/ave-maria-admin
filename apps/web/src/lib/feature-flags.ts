import { useEffect, useState } from "react";

import {
  USER_DASHBOARD_FLAG_KEY,
  isUserDashboardEnabled as evaluate,
  type FeatureFlagDeps,
} from "@avm-daily/application/client";

import { posthog } from "@/lib/posthog";

/**
 * Build-time env override for the user-dashboard flag. Truthy overrides win
 * on both SSR and client — the resolution table lives in
 * `packages/application/src/client/feature-flags.ts`.
 */
export function getUserDashboardEnvValue(): string | undefined {
  return import.meta.env.VITE_FF_USER_DASHBOARD_V1 as string | undefined;
}

const envDeps: FeatureFlagDeps = {
  envValue: getUserDashboardEnvValue(),
};

/**
 * SSR-safe synchronous evaluation. Called from TanStack Router loaders.
 * PostHog is not consulted here — that gate belongs to the client hook
 * below so a mid-rollout redirect doesn't fight SSR hydration.
 */
export function isUserDashboardEnabledFromEnv(): boolean {
  return evaluate(envDeps);
}

/**
 * Client hook — respects env override; otherwise defers to PostHog once the
 * client has hydrated.
 *
 * Returns `undefined` while PostHog is still resolving so callers can
 * distinguish "not yet decided" from "explicitly off". A `false` verdict
 * means the flag is truly disabled and the caller should redirect.
 *
 * Callers **must** treat `undefined` as pending — a redirect-on-mount that
 * triggers on `!enabled` would race PostHog's first `onFeatureFlags` fire
 * and bounce users out of the surface just as their cohort is being loaded.
 */
export function useIsUserDashboardEnabled(): boolean | undefined {
  const envValue = getUserDashboardEnvValue();
  const [enabled, setEnabled] = useState<boolean | undefined>(() => {
    if (envValue === "true") return true;
    if (envValue === "false") return false;
    return undefined;
  });

  useEffect(() => {
    if (envValue === "true" || envValue === "false") return;
    let cancelled = false;
    const check = () => {
      if (cancelled) return;
      const raw = posthog.isFeatureEnabled?.(USER_DASHBOARD_FLAG_KEY);
      if (raw === true || raw === false) setEnabled(raw);
      // A `undefined` from PostHog means the client hasn't loaded flags yet.
      // Keep local state at `undefined` so callers know to wait.
    };
    check();
    posthog.onFeatureFlags?.(check);
    return () => {
      cancelled = true;
    };
  }, [envValue]);

  return enabled;
}
