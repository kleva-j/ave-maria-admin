import type { ReactNode } from "react";

import { PostHogProvider as BaseProvider } from "posthog-react-native";
import { env } from "@avm-daily/env/native";

/**
 * True when PostHog is configured for this build. Consumers that call
 * usePostHog() outside a mounted BaseProvider get null + a startup console
 * warning; hook-using components (e.g. NavigationTracker) must gate their
 * mount on this flag to avoid the spam and the wasted render.
 */
export const isPostHogEnabled = Boolean(env.EXPO_PUBLIC_POSTHOG_KEY);

export function PostHogProvider({ children }: { children: ReactNode }) {
  if (!isPostHogEnabled) return <>{children}</>;

  return (
    <BaseProvider
      apiKey={env.EXPO_PUBLIC_POSTHOG_KEY}
      options={{
        host: env.EXPO_PUBLIC_POSTHOG_HOST,
        captureAppLifecycleEvents: true,
      }}
    >
      {children}
    </BaseProvider>
  );
}
