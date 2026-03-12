const BLOCKED_RETURN_PATHS = new Set([
  "/login",
  "/signin",
  "/signup",
  "/sso",
  "/signout",
  "/api/auth/callback",
]);

export const DEFAULT_RETURN_PATH = "/dashboard";

export type AuthStep =
  | "email_verification"
  | "mfa_enrollment"
  | "mfa_challenge"
  | "organization_selection";

export type AuthenticationFactor = {
  id?: string;
  type: string;
};

export type AvailableOrganization = {
  id: string;
  name?: string;
};

export type AuthSuccess = {
  status: "success";
};

export type AuthNextStep =
  | {
      status: "next_step";
      step: "email_verification";
      pendingAuthenticationToken: string;
      email: string;
    }
  | {
      status: "next_step";
      step: "mfa_enrollment";
      pendingAuthenticationToken: string;
      email: string;
    }
  | {
      status: "next_step";
      step: "mfa_challenge";
      pendingAuthenticationToken: string;
      authenticationFactors: AuthenticationFactor[];
    }
  | {
      status: "next_step";
      step: "organization_selection";
      pendingAuthenticationToken: string;
      availableOrganizations: AvailableOrganization[];
    };

export type AuthResponse = AuthSuccess | AuthNextStep;

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
