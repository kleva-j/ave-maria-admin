import { useEffect } from "react";
import { usePostHog } from "posthog-react-native";
import { usePathname } from "expo-router";

import { isPostHogEnabled } from "@/contexts/posthog-context";

export function NavigationTracker() {
  if (!isPostHogEnabled) return null;
  return <NavigationTrackerInner />;
}

function NavigationTrackerInner() {
  const posthog = usePostHog();
  const pathname = usePathname();

  useEffect(() => {
    posthog?.capture("$screen", { $screen_name: pathname });
  }, [pathname, posthog]);

  return null;
}
