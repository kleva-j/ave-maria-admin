import { useEffect } from "react";
import { usePostHog } from "posthog-react-native";
import { usePathname } from "expo-router";

export function NavigationTracker() {
  const posthog = usePostHog();
  const pathname = usePathname();

  useEffect(() => {
    posthog.capture("$screen", { $screen_name: pathname });
  }, [pathname]);

  return null;
}
