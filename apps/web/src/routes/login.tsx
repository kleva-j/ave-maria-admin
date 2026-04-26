import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { DEFAULT_RETURN_PATH } from "@/lib/auth";
import { startHostedSignIn } from "@/server/hosted-auth.functions";

/**
 * /login is a thin redirector to the WorkOS-hosted AuthKit sign-in page.
 *
 * The hosted page provides:
 *  - Social provider buttons (Google, GitHub, ...)
 *  - Email + password
 *  - MFA enrollment / challenge
 *  - Bot detection (Cloudflare Turnstile)
 *  - Brute force throttling
 *  - Branding configured in the WorkOS dashboard
 *
 * The OAuth callback at `/api/auth/callback` handles session creation and
 * `state.returnPathname` controls where the user lands after auth.
 */
export const Route = createFileRoute("/login")({
  validateSearch: z.object({
    returnTo: z.string().optional().default(DEFAULT_RETURN_PATH),
  }),
  loader: async ({ location }) => {
    const params = new URLSearchParams(location.search);
    const returnTo = params.get("returnTo") ?? undefined;
    // Throws redirect to the hosted sign-in page.
    await startHostedSignIn({ data: { returnTo } });
    return null;
  },
  component: () => null,
});
