import { getAuth } from "@workos/authkit-tanstack-react-start";
import { createMiddleware } from "@tanstack/react-start";
import { logger } from "@/server/logging";

export const authMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    const auth = await getAuth();
    if (!auth.user) {
      const path = new URL(request.url).pathname;
      logger("warn", "auth.forbidden", { path });
      return new Response("Forbidden", { status: 403 });
    }

    logger("info", "auth.middleware", {
      userId: auth.user?.id ?? null,
      sessionId: auth.sessionId ?? null,
      organizationId: auth.organizationId ?? null,
    });

    return next({ context: { auth } });
  }
);
