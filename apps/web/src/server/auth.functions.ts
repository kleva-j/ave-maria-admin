import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/middleware/auth";
import { redirect } from "@tanstack/react-router";
import { env } from "@avm-daily/env/server";
import { WorkOS } from "@workos-inc/node";
import { logger } from "@/server/logging";

const workos = new WorkOS(env.WORKOS_API_KEY);

export const getCurrentUser = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return {
      userId: context.auth.user.id,
      email: context.auth.user.email,
      sessionId: context.auth.sessionId,
      organizationId: context.auth.organizationId ?? null,
      role: context.auth.role,
      permissions: context.auth.permissions ?? [],
    };
  });

export const requireAuth = createServerFn().handler(async () => {
  const user = await getCurrentUser();

  if (!user) throw redirect({ to: "/login" });

  return user;
});

export const login = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => {
    const userAgent = getRequestHeader("user-agent");
    const ipAddress = getRequestIP();
    const { email, password } = data;
    try {
      const { user, organizationId, sealedSession } =
        await workos.userManagement.authenticateWithPassword({
          clientId: env.WORKOS_CLIENT_ID,
          email,
          password,
          ipAddress,
          userAgent,
        });

      return {
        userId: user.id,
        email,
        sessionId: sealedSession,
        organizationId: organizationId ?? null,
      };
    } catch (error) {
      logger("error", "login.error", { error });
      return new Response("Internal Server Error", { status: 500 });
    }
  });
