import { getAuth, getAuthkit } from "@workos/authkit-tanstack-react-start";
import { createServerFn } from "@tanstack/react-start";
import { getSafeReturnPathname } from "@/lib/auth";

import { assertSameOrigin } from "@/server/security";
import { logger } from "@/server/logging";

/**
 * Sign-out is the only embedded auth server fn that survives the migration to
 * WorkOS hosted AuthKit. All sign-in / sign-up / MFA / org-selection flows are
 * now driven by the hosted UI (see `hosted-auth.functions.ts` and
 * `routes/login.tsx` / `routes/signup.tsx`).
 */
export const signOutUser = createServerFn({ method: "POST" })
  .inputValidator((data: { returnTo?: string }) =>
    data && typeof data === "object" ? data : {},
  )
  .handler(async ({ data }) => {
    assertSameOrigin();

    const auth = await getAuth();
    if (!auth.user) {
      logger("info", "auth.logout.no_user", {});
      return { logoutUrl: "/" };
    }

    const returnTo = getSafeReturnPathname(
      new URLSearchParams({ returnTo: data?.returnTo ?? "/" }).toString(),
      "/",
    );

    const authkit = await getAuthkit();
    logger("info", "auth.logout.attempt", { sessionId: auth.sessionId });
    const { logoutUrl } = await authkit.signOut(auth.sessionId, { returnTo });
    logger("info", "auth.logout.success", { logoutUrl });

    return { logoutUrl };
  });
