import { Inbox } from "@novu/react";
import { api } from "@avm-daily/backend/convex/_generated/api";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { env } from "@avm-daily/env/web";

import { isSafeInternalPath } from "@/lib/auth";

/**
 * Novu in-app notification bell for the consumer app.
 *
 * Renders nothing unless VITE_NOVU_APP_ID is set AND the backend returns
 * secure-mode credentials (getNovuInboxAuth is null when NOVU_SECRET_KEY is
 * unset). subscriberHash is computed server-side so the secret never ships.
 */
export function NotificationBell() {
  const applicationIdentifier = env.VITE_NOVU_APP_ID;
  const navigate = useNavigate();

  const auth = useQuery({
    ...convexQuery(api.userNotifications.getNovuInboxAuth, {}),
    // Feature is off without an app id — don't even hit the backend.
    enabled: Boolean(applicationIdentifier),
  });

  if (!applicationIdentifier || !auth.data) return null;

  return (
    <Inbox
      applicationIdentifier={applicationIdentifier}
      subscriberId={auth.data.subscriberId}
      subscriberHash={auth.data.subscriberHash}
      backendUrl={env.VITE_NOVU_BACKEND_URL}
      socketUrl={env.VITE_NOVU_SOCKET_URL}
      routerPush={(path: string) => {
        // Deep-link from a notification's payload.path into the app. The path
        // comes from untrusted notification data — only follow safe internal
        // paths (open-redirect hardening, same rules as auth returnTo).
        if (isSafeInternalPath(path)) void navigate({ to: path });
      }}
    />
  );
}
