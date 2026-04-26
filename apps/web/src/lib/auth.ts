const BLOCKED_RETURN_PATHS = new Set([
  "/login",
  "/signin",
  "/signup",
  "/sso",
  "/signout",
  "/api/auth/callback",
]);

export const DEFAULT_RETURN_PATH = "/dashboard";

/**
 * Validates a `returnTo` query parameter from auth flows.
 * Rejects external URLs, protocol-relative URLs, and known auth/system paths
 * to prevent open-redirect vulnerabilities after sign-in / sign-out.
 */
export function getSafeReturnPathname(
  search: string | undefined,
  fallback: string = DEFAULT_RETURN_PATH,
) {
  const params = new URLSearchParams(search ?? "");
  const returnTo = params.get("returnTo") ?? params.get("returnPathname");
  if (!returnTo) return fallback;
  if (!returnTo.startsWith("/")) return fallback;
  if (returnTo.startsWith("//") || returnTo.includes("://")) return fallback;
  if (BLOCKED_RETURN_PATHS.has(returnTo)) return fallback;
  return returnTo;
}
