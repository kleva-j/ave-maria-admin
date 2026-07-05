import { useCallback, useMemo } from "react";

import { useAccessToken, useAuth } from "./AuthKitProvider";

/**
 * Adapter that bridges the WorkOS AuthKit client into the shape Convex expects
 * for `ConvexProviderWithAuth`. Mirrors the web adapter at
 * `apps/web/src/routes/__root.tsx:85-112` so the backend contract is identical.
 *
 * Convex re-calls `fetchAccessToken` on every WebSocket reconnect and any time
 * it needs a fresh JWT.
 *
 * - `getAccessToken()` returns the in-memory access token — cheap, no bridge.
 * - `refresh()` forces a WorkOS refresh-token round-trip to obtain a new
 *   access token. Called first when Convex signals `forceRefreshToken: true`
 *   (e.g. after a server-side 401) so the stale token is replaced before we
 *   return.
 */
export function useAuthForConvex() {
  const { user, loading } = useAuth();
  const { getAccessToken, refresh } = useAccessToken();

  const fetchAccessToken = useCallback(
    async (args: { forceRefreshToken: boolean }) => {
      try {
        if (args.forceRefreshToken) return await refresh();
        return await getAccessToken();
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
