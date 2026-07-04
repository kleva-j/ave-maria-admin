import { env } from "@avm-daily/env/native";

/**
 * Thin REST wrapper for the WorkOS User Management authenticate endpoint.
 *
 * We hit `/user_management/authenticate` (not the legacy `/sso/token`) so the
 * tokens carry the same issuer + JWKS that the backend's
 * @convex-dev/workos-authkit verifies. PKCE + no client_secret → safe for a
 * public mobile client.
 */

const WORKOS_TIMEOUT_MS = 10_000;

export interface WorkOSUser {
  id: string;
  email: string;
  email_verified: boolean;
  first_name: string | null;
  last_name: string | null;
  profile_picture_url: string | null;
  object: "user";
}

export interface AuthenticateResponse {
  user: WorkOSUser;
  access_token: string;
  refresh_token: string;
  organization_id: string | null;
  impersonator: unknown;
}

export class WorkOSAuthError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "WorkOSAuthError";
  }
}

function baseUrl(): string {
  return `https://${env.EXPO_PUBLIC_WORKOS_API_HOSTNAME}`;
}

function requireClientId(): string {
  const clientId = env.EXPO_PUBLIC_WORKOS_CLIENT_ID;
  if (!clientId) {
    throw new WorkOSAuthError(
      0,
      "not_configured",
      "EXPO_PUBLIC_WORKOS_CLIENT_ID is not set",
    );
  }
  return clientId;
}

async function postAuthenticate(
  body: Record<string, string>,
): Promise<AuthenticateResponse> {
  const res = await fetch(`${baseUrl()}/user_management/authenticate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(WORKOS_TIMEOUT_MS),
  });

  if (!res.ok) {
    let code = "unknown_error";
    let message = `WorkOS authenticate failed with status ${res.status}`;
    try {
      const payload = (await res.json()) as {
        code?: string;
        error?: string;
        error_description?: string;
        message?: string;
      };
      code = payload.code ?? payload.error ?? code;
      message = payload.error_description ?? payload.message ?? message;
    } catch {
      // Non-JSON error body — keep the status-based fallback.
    }
    throw new WorkOSAuthError(res.status, code, message);
  }

  return (await res.json()) as AuthenticateResponse;
}

export async function authenticateWithCode(params: {
  code: string;
  codeVerifier: string;
}): Promise<AuthenticateResponse> {
  return postAuthenticate({
    grant_type: "authorization_code",
    client_id: requireClientId(),
    code: params.code,
    code_verifier: params.codeVerifier,
  });
}

export async function authenticateWithRefreshToken(params: {
  refreshToken: string;
}): Promise<AuthenticateResponse> {
  return postAuthenticate({
    grant_type: "refresh_token",
    client_id: requireClientId(),
    refresh_token: params.refreshToken,
  });
}
