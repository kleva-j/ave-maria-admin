import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { posthog } from "@/lib/posthog";
import { useEffect } from "react";

export function PostHogIdentity() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      posthog.reset();
      return;
    }
    posthog.identify(user.id, {
      email: user.email,
      name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || undefined,
    });
  }, [user]);

  return null;
}
