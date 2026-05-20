import { initPostHog, posthog } from "@/lib/posthog";
import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    initPostHog();
    const unsub = router.subscribe("onResolved", () => {
      posthog.capture("$pageview", { $current_url: window.location.href });
    });
    return () => unsub();
  }, [router]);

  return <>{children}</>;
}
