/**
 * Feature-flag adapter — platform-neutral. Callers inject the PostHog client
 * + the build-time env value; this module never imports either directly.
 *
 * Flag key `user_dashboard_v1` gates the Phase 1 user surface. PostHog owns
 * the cohort rollout in prod; env value (`VITE_FF_USER_DASHBOARD_V1` on web,
 * `EXPO_PUBLIC_FF_USER_DASHBOARD_V1` on native) is the dev/staging override.
 *
 * Resolution order:
 *   1. envValue === "true"   → enabled (override on)
 *   2. envValue === "false"  → disabled (override off)
 *   3. posthog?.isFeatureEnabled("user_dashboard_v1") === true → enabled
 *   4. anything else         → disabled (fail-closed for a fintech surface)
 */

export const USER_DASHBOARD_FLAG_KEY = "user_dashboard_v1";

export type FeatureFlagChecker = {
  isFeatureEnabled: (
    key: string,
  ) => boolean | undefined | Promise<boolean | undefined>;
};

export interface FeatureFlagDeps {
  envValue?: string | null | undefined;
  posthog?: FeatureFlagChecker | null | undefined;
}

/**
 * Synchronous variant — safe in TanStack Router `beforeLoad` and Convex
 * queries. Only inspects `envValue` and the synchronous PostHog result.
 * If PostHog returns a Promise (unlikely on posthog-js after `onFeatureFlags`
 * fires), the call resolves as `false` here — call `isUserDashboardEnabledAsync`
 * when async is acceptable.
 */
export function isUserDashboardEnabled(deps: FeatureFlagDeps): boolean {
  if (deps.envValue === "true") return true;
  if (deps.envValue === "false") return false;
  const raw = deps.posthog?.isFeatureEnabled(USER_DASHBOARD_FLAG_KEY);
  return raw === true;
}

/**
 * Async variant — awaits PostHog if the client returns a Promise (server
 * runtime, cold PostHog init). Same fail-closed rule.
 */
export async function isUserDashboardEnabledAsync(
  deps: FeatureFlagDeps,
): Promise<boolean> {
  if (deps.envValue === "true") return true;
  if (deps.envValue === "false") return false;
  const raw = await deps.posthog?.isFeatureEnabled(USER_DASHBOARD_FLAG_KEY);
  return raw === true;
}
