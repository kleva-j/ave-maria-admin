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
 * it needs a fresh JWT. AuthKit's `useAccessToken().getAccessToken()` returns a
 * guaranteed-fresh token (auto-refreshes on its own), so we always forward it.
 */
function useAuthForConvex() {
  const { user, loading } = useAuth();
  const { getAccessToken } = useAccessToken();

  const fetchAccessToken = useCallback(
    async (_args: { forceRefreshToken: boolean }) => {
      try {
        const token = await getAccessToken();
        return token ?? null;
      } catch {
        return null;
      }
    },
    [getAccessToken],
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
