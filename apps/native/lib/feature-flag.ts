import { useEffect, useState } from "react";
import { usePostHog } from "posthog-react-native";

import {
  isUserDashboardEnabled as evaluate,
  USER_DASHBOARD_FLAG_KEY,
  type FeatureFlagDeps,
} from "@avm-daily/application/client";

/**
 * Native mirror of `apps/web/src/lib/feature-flags.ts`. Reads the same shared
 * flag adapter but sources the env value from Expo's public env pattern.
 * PostHog client comes from `posthog-react-native`'s `usePostHog` hook.
 */

export function getUserDashboardEnvValue(): string | undefined {
  return process.env.EXPO_PUBLIC_FF_USER_DASHBOARD_V1 as
    | string
    | undefined;
}

const envDeps: FeatureFlagDeps = {
  envValue: getUserDashboardEnvValue(),
};

/**
 * Synchronous evaluation from env alone. Used inside Expo Router layout
 * guards where PostHog resolution isn't guaranteed yet.
 */
export function isUserDashboardEnabledFromEnv(): boolean {
  return evaluate(envDeps);
}

/**
 * Client hook — respects env override; otherwise defers to PostHog once the
 * client has hydrated. Returns `undefined` while PostHog resolves so callers
 * can distinguish "not decided" from "explicitly off".
 */
export function useIsUserDashboardEnabled(): boolean | undefined {
  const envValue = getUserDashboardEnvValue();
  const posthog = usePostHog();
  const [enabled, setEnabled] = useState<boolean | undefined>(() => {
    if (envValue === "true") return true;
    if (envValue === "false") return false;
    return undefined;
  });

  useEffect(() => {
    if (envValue === "true" || envValue === "false") return;
    if (!posthog) return;
    let cancelled = false;
    const check = () => {
      if (cancelled) return;
      const raw = posthog.isFeatureEnabled?.(USER_DASHBOARD_FLAG_KEY);
      if (raw === true || raw === false) setEnabled(raw);
      // `undefined` from PostHog = flags not loaded yet — keep waiting.
    };
    check();
    const off = posthog.onFeatureFlags?.(check);
    return () => {
      cancelled = true;
      off?.();
    };
  }, [envValue, posthog]);

  return enabled;
}
