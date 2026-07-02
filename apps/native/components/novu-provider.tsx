import { NovuProvider } from "@novu/react-native";
import { api } from "@avm-daily/backend/convex/_generated/api";
import { env } from "@avm-daily/env/native";
import { useQuery } from "convex/react";
import { createContext, useContext, type ReactNode } from "react";

/**
 * Whether the Novu inbox is live (app id set + backend returned secure-mode
 * creds). Consumers gate hook usage on this — the Novu hooks throw outside a
 * NovuProvider, so components must render a hook-using child only when true.
 */
const NovuEnabledContext = createContext(false);

export function useNovuEnabled(): boolean {
  return useContext(NovuEnabledContext);
}

/**
 * Wraps the app in a NovuProvider when Novu is configured. When it isn't
 * (no EXPO_PUBLIC_NOVU_APP_ID or NOVU_SECRET_KEY unset → auth null), renders
 * children with the enabled flag false so the bell + inbox stay inert.
 * Must live inside ConvexProvider so getNovuInboxAuth can be queried.
 */
export function NovuInboxProvider({ children }: { children: ReactNode }) {
  const applicationIdentifier = env.EXPO_PUBLIC_NOVU_APP_ID;
  const auth = useQuery(
    api.userNotifications.getNovuInboxAuth,
    applicationIdentifier ? {} : "skip",
  );

  // Deliberate one-time remount tradeoff: when a signed-in user's auth query
  // resolves, the returned root switches from this context-only provider to
  // NovuProvider, remounting the subtree once. We accept this because:
  //   - NovuProvider requires subscriberId + subscriberHash, which don't exist
  //     until the async getNovuInboxAuth query resolves — it can't be mounted
  //     earlier with valid creds.
  //   - Gating the subtree render on `auth` would hang SIGNED-OUT users
  //     forever: getNovuInboxAuth calls getUser(), which throws "Not
  //     authenticated", so `auth` never resolves for them.
  // The remount is a single event that fires before the user navigates, so
  // the practical impact (nav/local state reset) is negligible.
  if (!applicationIdentifier || !auth) {
    return (
      <NovuEnabledContext.Provider value={false}>
        {children}
      </NovuEnabledContext.Provider>
    );
  }

  return (
    <NovuProvider
      applicationIdentifier={applicationIdentifier}
      subscriberId={auth.subscriberId}
      subscriberHash={auth.subscriberHash}
      backendUrl={env.EXPO_PUBLIC_NOVU_BACKEND_URL}
      socketUrl={env.EXPO_PUBLIC_NOVU_SOCKET_URL}
    >
      <NovuEnabledContext.Provider value={true}>
        {children}
      </NovuEnabledContext.Provider>
    </NovuProvider>
  );
}
