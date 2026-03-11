const BLOCKED_RETURN_PATHS = new Set([
  "/login",
  "/signin",
  "/signup",
  "/sso",
  "/signout",
  "/api/auth/callback",
]);

export const DEFAULT_RETURN_PATH = "/_protected/dashboard";

export function getSafeReturnPathname(
  search: string | undefined,
  fallback: string = DEFAULT_RETURN_PATH
) {
  const params = new URLSearchParams(search ?? "");
  const returnTo = params.get("returnTo") ?? params.get("returnPathname");
  if (!returnTo) return fallback;
  if (!returnTo.startsWith("/")) return fallback;
  if (returnTo.startsWith("//") || returnTo.includes("://")) return fallback;
  if (BLOCKED_RETURN_PATHS.has(returnTo)) return fallback;
  return returnTo;
}
