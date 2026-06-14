import * as Sentry from "@sentry/react-native";
import { env } from "@avm-daily/env/native";
import { isRunningInExpoGo } from "expo";

let initialized = false;

/**
 * Initialize Sentry for the React Native runtime. Idempotent + silent no-op
 * when EXPO_PUBLIC_SENTRY_DSN is unset, so dev environments without a Sentry
 * project remain unaffected.
 *
 * Expo Router projects do not need a navigation-container wrapper — navigation
 * spans are captured automatically by the SDK.
 */
export function initSentry(): void {
  if (initialized) return;
  if (!env.EXPO_PUBLIC_SENTRY_DSN) return;

  try {
    Sentry.init({
      dsn: env.EXPO_PUBLIC_SENTRY_DSN,
      environment:
        env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ??
        (__DEV__ ? "development" : "production"),
      tracesSampleRate: env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
      integrations: [Sentry.mobileReplayIntegration()],
      // mobileReplayIntegration is masked-by-default at SDK level; keep it
      // explicit for review clarity.
      replaysOnErrorSampleRate: 1.0,
      replaysSessionSampleRate: 0,
      // Slow / frozen frames metrics. Disabled in Expo Go because native code
      // for that integration is not bundled.
      enableNativeFramesTracking: !isRunningInExpoGo(),
      sendDefaultPii: false,
    });
    initialized = true;
  } catch (e) {
    console.error("[sentry] init failed", e);
  }
}

export { Sentry };
