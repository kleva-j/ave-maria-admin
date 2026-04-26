import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { env } from "@avm-daily/env/server";
import { WorkOS } from "@workos-inc/node";
import { z } from "zod";

import { getSafeReturnPathname, DEFAULT_RETURN_PATH } from "@/lib/auth";
import { logger } from "@/server/logging";

/**
 * Server functions that produce a redirect to the WorkOS-hosted AuthKit UI.
 *
 * These intentionally bypass the embedded sign-in form and rely on WorkOS to
 * render branded sign-in / sign-up pages with built-in:
 *   - Cloudflare Turnstile bot protection
 *   - Brute-force throttling
 *   - Configurable branding
 *   - Social provider buttons (Google, GitHub, etc. — toggled in the WorkOS dashboard)
 *
 * Direct provider entry (e.g. /signup/google) skips the chooser by passing
 * `provider: "GoogleOAuth"` so the user lands on the provider consent screen
 * immediately.
 */

const workos = new WorkOS(env.WORKOS_API_KEY);

const PROVIDERS = ["authkit", "GoogleOAuth", "GitHubOAuth"] as const;
type Provider = (typeof PROVIDERS)[number];

const returnToInputSchema = z
  .object({ returnTo: z.string().optional() })
  .optional();

const providerInputSchema = z.object({
  provider: z.enum(PROVIDERS),
  returnTo: z.string().optional(),
});

function buildAuthUrl(args: {
  provider: Provider;
  screenHint?: "sign-up" | "sign-in";
  returnTo?: string;
}) {
  const safeReturnPathname = getSafeReturnPathname(
    args.returnTo
      ? new URLSearchParams({ returnTo: args.returnTo }).toString()
      : undefined,
    DEFAULT_RETURN_PATH,
  );

  return workos.userManagement.getAuthorizationUrl({
    clientId: env.WORKOS_CLIENT_ID,
    redirectUri: env.WORKOS_REDIRECT_URI,
    provider: args.provider,
    ...(args.screenHint ? { screenHint: args.screenHint } : {}),
    state: JSON.stringify({ returnPathname: safeReturnPathname }),
  });
}

/**
 * Redirects to the WorkOS-hosted AuthKit sign-in page.
 * AuthKit chooser shows all enabled providers (Google, GitHub, password, etc.).
 */
export const startHostedSignIn = createServerFn({ method: "GET" })
  .inputValidator(returnToInputSchema)
  .handler(async ({ data }) => {
    const url = buildAuthUrl({
      provider: "authkit",
      screenHint: "sign-in",
      returnTo: data?.returnTo,
    });
    logger("info", "auth.hosted.signin.redirect", {});
    throw redirect({ href: url });
  });

/**
 * Redirects to the WorkOS-hosted AuthKit sign-up page.
 * AuthKit page shows the sign-up screen with all enabled providers.
 */
export const startHostedSignUp = createServerFn({ method: "GET" })
  .inputValidator(returnToInputSchema)
  .handler(async ({ data }) => {
    const url = buildAuthUrl({
      provider: "authkit",
      screenHint: "sign-up",
      returnTo: data?.returnTo,
    });
    logger("info", "auth.hosted.signup.redirect", {});
    throw redirect({ href: url });
  });

/**
 * Redirects to the WorkOS authorization URL for a specific provider.
 * Use this for "Continue with Google" / "Continue with GitHub" buttons —
 * skips the AuthKit chooser and goes directly to the provider consent screen.
 */
export const startProviderAuth = createServerFn({ method: "GET" })
  .inputValidator(providerInputSchema)
  .handler(async ({ data }) => {
    const url = buildAuthUrl({
      provider: data.provider,
      returnTo: data.returnTo,
    });
    logger("info", "auth.hosted.provider.redirect", {
      provider: data.provider,
    });
    throw redirect({ href: url });
  });
