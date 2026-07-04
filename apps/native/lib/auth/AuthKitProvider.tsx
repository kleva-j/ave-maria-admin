import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { env } from "@avm-daily/env/native";

import {
  authenticateWithCode,
  authenticateWithRefreshToken,
  WorkOSAuthError,
  type WorkOSUser,
} from "./workos-client";
import {
  clearRefreshToken,
  loadRefreshToken,
  saveRefreshToken,
} from "./token-storage";

/**
 * Complete the pending Expo browser session on iOS. Safe to call at module top
 * — no-op on Android + web.
 */
WebBrowser.maybeCompleteAuthSession();

/**
 * True when WorkOS is configured. Consumers (login screen, gate) should gate
 * their UI on this flag and render a "not configured" fallback when false so
 * dev builds without WorkOS env vars don't crash on import.
 */
export const isAuthConfigured = Boolean(env.EXPO_PUBLIC_WORKOS_CLIENT_ID);

/**
 * WorkOS User Management OAuth endpoints. The `token` endpoint is required by
 * expo-auth-session's PKCE machinery but we never let AuthRequest exchange the
 * code — we do that ourselves in `signIn()` via `authenticateWithCode()` so we
 * hit `/user_management/authenticate` (matches the backend's JWKS) rather than
 * the generic OAuth `/token` endpoint.
 */
const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: `https://${env.EXPO_PUBLIC_WORKOS_API_HOSTNAME}/user_management/authorize`,
  tokenEndpoint: `https://${env.EXPO_PUBLIC_WORKOS_API_HOSTNAME}/user_management/authenticate`,
};

interface AuthState {
  user: WorkOSUser | null;
  accessToken: string | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<string | null>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const INITIAL_STATE: AuthState = {
  user: null,
  accessToken: null,
  loading: true,
  error: null,
};

export function AuthKitProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);

  // Keep the current refresh token in a ref so refresh() doesn't need to hit
  // secure storage on every call (secure-store reads are async + hit native
  // bridge; Convex may call fetchAccessToken frequently).
  const refreshTokenRef = useRef<string | null>(null);

  // Serialize concurrent refresh() calls. Convex's ConvexProviderWithAuth may
  // fire multiple fetchAccessToken({ forceRefreshToken: true }) at once on a
  // reconnect; without this we'd race the WorkOS refresh endpoint and one call
  // would revoke the other's brand-new refresh token.
  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  const applyAuthResult = useCallback(
    (result: {
      user: WorkOSUser;
      access_token: string;
      refresh_token: string;
    }) => {
      refreshTokenRef.current = result.refresh_token;
      setState({
        user: result.user,
        accessToken: result.access_token,
        loading: false,
        error: null,
      });
    },
    [],
  );

  const clearAuth = useCallback((error: string | null = null) => {
    refreshTokenRef.current = null;
    setState({ user: null, accessToken: null, loading: false, error });
  }, []);

  // Hydrate from stored refresh token on mount. Fails silently — user just
  // sees the login screen if the stored token is stale or the network is out.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isAuthConfigured) {
        setState({
          user: null,
          accessToken: null,
          loading: false,
          error: null,
        });
        return;
      }
      try {
        const stored = await loadRefreshToken();
        if (!stored) {
          if (!cancelled) clearAuth();
          return;
        }
        const result = await authenticateWithRefreshToken({
          refreshToken: stored,
        });
        if (cancelled) return;
        await saveRefreshToken(result.refresh_token);
        applyAuthResult(result);
      } catch {
        if (cancelled) return;
        // Stored refresh token no longer valid — drop it and drop the user to
        // the login screen. Silent because this fires on every cold boot and
        // an expired token isn't an error worth surfacing.
        await clearRefreshToken().catch(() => undefined);
        clearAuth();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyAuthResult, clearAuth]);

  const signIn = useCallback(async () => {
    if (!isAuthConfigured) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "WorkOS is not configured for this build.",
      }));
      return;
    }
    const clientId = env.EXPO_PUBLIC_WORKOS_CLIENT_ID;
    const redirectUri = env.EXPO_PUBLIC_WORKOS_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "WorkOS client id or redirect URI missing.",
      }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    const request = new AuthSession.AuthRequest({
      clientId,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      // openid ensures WorkOS returns an id_token-shaped payload consistent
      // with the User Management issuer the backend verifies.
      scopes: ["openid", "profile", "email", "offline_access"],
      usePKCE: true,
      codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
    });

    try {
      await request.makeAuthUrlAsync(discovery);
      const result = await request.promptAsync(discovery);
      if (result.type !== "success") {
        // User cancelled the browser or the redirect returned an error — no
        // token to persist. Reset loading so the login screen re-enables.
        setState((prev) => ({
          ...prev,
          loading: false,
          error:
            result.type === "error"
              ? (result.error?.message ?? "OAuth error")
              : null,
        }));
        return;
      }
      const code = result.params.code;
      const codeVerifier = request.codeVerifier;
      if (!code || !codeVerifier) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "OAuth response missing code or PKCE verifier.",
        }));
        return;
      }
      const authResult = await authenticateWithCode({ code, codeVerifier });
      await saveRefreshToken(authResult.refresh_token);
      applyAuthResult(authResult);
    } catch (err) {
      const message =
        err instanceof WorkOSAuthError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Sign in failed";
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, [applyAuthResult]);

  const refresh = useCallback(async (): Promise<string | null> => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const token = refreshTokenRef.current;
    if (!token) return null;
    const p = (async () => {
      try {
        const result = await authenticateWithRefreshToken({
          refreshToken: token,
        });
        await saveRefreshToken(result.refresh_token);
        applyAuthResult(result);
        return result.access_token;
      } catch (err) {
        // Refresh token rejected — force the user back to sign-in. The
        // rejection likely means the token was revoked or expired.
        await clearRefreshToken().catch(() => undefined);
        clearAuth(err instanceof WorkOSAuthError ? err.message : null);
        return null;
      } finally {
        refreshInFlight.current = null;
      }
    })();
    refreshInFlight.current = p;
    return p;
  }, [applyAuthResult, clearAuth]);

  const signOut = useCallback(async () => {
    await clearRefreshToken().catch(() => undefined);
    clearAuth();
  }, [clearAuth]);

  const getAccessToken = useCallback(async () => {
    return state.accessToken;
  }, [state.accessToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signIn,
      signOut,
      refresh,
      getAccessToken,
    }),
    [state, signIn, signOut, refresh, getAccessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error(
      "AuthKitProvider missing — useAuth / useAccessToken must be called inside <AuthKitProvider>",
    );
  }
  return ctx;
}

export function useAuth(): {
  user: WorkOSUser | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
} {
  const { user, loading, error, signIn, signOut } = useAuthContext();
  return { user, loading, error, signIn, signOut };
}

export function useAccessToken(): {
  getAccessToken: () => Promise<string | null>;
  refresh: () => Promise<string | null>;
} {
  const { getAccessToken, refresh } = useAuthContext();
  return { getAccessToken, refresh };
}
