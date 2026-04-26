import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";

import {
  AuthKitProvider,
  useAccessToken,
  useAuth,
} from "@workos/authkit-tanstack-react-start/client";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Toaster } from "@avm-daily/ui/components/sonner";
import { ConvexProviderWithAuth } from "convex/react";
import { useCallback, useMemo } from "react";

import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  Outlet,
} from "@tanstack/react-router";

import appCss from "../index.css?url";

export interface RouterAppContext {
  queryClient: QueryClient;
  convexQueryClient: ConvexQueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "My App" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),

  component: RootDocument,
});

/**
 * Adapter that bridges the WorkOS AuthKit client into the shape Convex expects
 * for `ConvexProviderWithAuth`.
 *
 * Convex re-calls `fetchAccessToken` on every WebSocket reconnect and any time
 * it needs a fresh JWT.
 *
 * - `getAccessToken()` returns a guaranteed-fresh token but only auto-refreshes
 *   based on local expiry — it will serve a cached token if it hasn't expired
 *   locally, even if the server has already rejected it.
 * - `refresh()` forces a server-side round-trip to obtain a new token. We call
 *   it first when Convex signals `forceRefreshToken: true` (e.g. after a
 *   server-side 401), so the stale token is replaced before we return.
 */
function useAuthForConvex() {
  const { user, loading } = useAuth();
  const { getAccessToken, refresh } = useAccessToken();

  const fetchAccessToken = useCallback(
    async (_args: { forceRefreshToken: boolean }) => {
      try {
        if (_args.forceRefreshToken) {
          await refresh();
        }
        const token = await getAccessToken();
        return token ?? null;
      } catch {
        return null;
      }
    },
    [getAccessToken, refresh],
  );

  return useMemo(
    () => ({
      isLoading: loading,
      isAuthenticated: !loading && !!user,
      fetchAccessToken,
    }),
    [loading, user, fetchAccessToken],
  );
}

function RootDocument() {
  return (
    <AuthKitProvider>
      <ConvexAuthBridge>
        <html lang="en" className="dark">
          <head>
            <HeadContent />
          </head>
          <body>
            <div className="grid h-svh grid-rows-[auto_1fr]">
              <Outlet />
            </div>
            <Toaster richColors />
            <TanStackRouterDevtools position="bottom-left" />
            <Scripts />
          </body>
        </html>
      </ConvexAuthBridge>
    </AuthKitProvider>
  );
}

function ConvexAuthBridge({ children }: { children: React.ReactNode }) {
  const { convexQueryClient } = Route.useRouteContext();
  return (
    <ConvexProviderWithAuth
      client={convexQueryClient.convexClient}
      useAuth={useAuthForConvex}
    >
      {children}
    </ConvexProviderWithAuth>
  );
}
