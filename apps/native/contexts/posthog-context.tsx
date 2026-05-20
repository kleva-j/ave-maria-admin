import { PostHogProvider as BaseProvider } from "posthog-react-native";
import { env } from "@avm-daily/env/native";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
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
