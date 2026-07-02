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
 * True when `path` is a safe in-app destination: an internal absolute path,
 * not protocol-relative or external, and not a known auth/system route.
 * Same hardening as getSafeReturnPathname, but for a raw path (not a query
 * string) — used to vet navigation targets that come from untrusted data
 * (e.g. a Novu notification payload).
 */
export function isSafeInternalPath(path: string | undefined | null): boolean {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//") || path.includes("://")) return false;
  if (BLOCKED_RETURN_PATHS.has(path)) return false;
  return true;
}

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
