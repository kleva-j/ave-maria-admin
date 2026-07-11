import { Redirect, Stack } from "expo-router";

import { useIsUserDashboardEnabled, isUserDashboardEnabledFromEnv } from "@/lib/feature-flag";

/**
 * Layout for the Phase 1 user surface. Gating is two-tier:
 *   1. Env override (`EXPO_PUBLIC_FF_USER_DASHBOARD_V1`) — synchronous, wins.
 *   2. PostHog cohort flag (`user_dashboard_v1`) — client-only, resolves
 *      asynchronously. `undefined` = still loading, keep the surface
 *      mounted; explicit `false` = redirect to the legacy `(drawer)`.
 */
export default function DashboardLayout() {
  const envForced = isUserDashboardEnabledFromEnv();
  const flagState = useIsUserDashboardEnabled();

  const envValue = process.env.EXPO_PUBLIC_FF_USER_DASHBOARD_V1 as
    | string
    | undefined;
  const envExplicitOff = envValue === "false";
  const posthogExplicitOff = flagState === false;

  if (envExplicitOff || (envValue == null && posthogExplicitOff)) {
    return <Redirect href="/(drawer)/(tabs)" />;
  }

  // envForced === true or flagState pending — render the shell either way.
  void envForced;

  return <Stack screenOptions={{ headerShown: false }} />;
}
