import type {
  AvailableOrganization,
  AuthenticationFactor,
  AuthResponse,
  AuthNextStep,
} from "@/lib/auth";

import { getAuth, getAuthkit } from "@workos/authkit-tanstack-react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createServerFn } from "@tanstack/react-start";
import { getSafeReturnPathname } from "@/lib/auth";
import { redirect } from "@tanstack/react-router";
import { env } from "@avm-daily/env/server";
import { logger } from "@/server/logging";

import {
  GenericServerException,
  BadRequestException,
  OauthException,
  WorkOS,
} from "@workos-inc/node";

import {
  organizationSelectionSchema,
  emailVerificationSchema,
  totpEnrollmentSchema,
  challengeSchema,
  loginSchema,
  totpSchema,
} from "@/lib/auth-schema";

import {
  assertSameOrigin,
  enforceRateLimit,
  getClientIp,
} from "@/server/security";

const workos = new WorkOS(env.WORKOS_API_KEY);
const sessionOptions = {
  sealSession: true,
  cookiePassword: env.WORKOS_COOKIE_PASSWORD,
};

type WorkosAuthErrorData = {
  code?: string;
  message?: string;
  pending_authentication_token?: string;
  authentication_factors?: unknown;
  available_organizations?: unknown;
  organizations?: unknown;
  email?: string;
  user?: { id?: string; email?: string };
};

function extractErrorData(error: unknown): WorkosAuthErrorData | null {
  if (
    error instanceof OauthException ||
    error instanceof GenericServerException
  ) {
    return (error.rawData ?? null) as WorkosAuthErrorData | null;
  }

  if (error instanceof BadRequestException) {
    return { code: error.code, message: error.message };
  }

  if (error && typeof error === "object" && "rawData" in error) {
    return (error as { rawData?: WorkosAuthErrorData }).rawData ?? null;
  }

  return null;
}

function normalizeFactors(raw: unknown): AuthenticationFactor[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((factor) => {
      if (typeof factor === "string") {
        return { type: factor };
      }
      if (factor && typeof factor === "object") {
        const value = factor as { id?: string; type?: string };
        return value.type ? { id: value.id, type: value.type } : null;
      }
      return null;
    })
    .filter((factor): factor is AuthenticationFactor => !!factor);
}

function normalizeOrganizations(raw: unknown): AvailableOrganization[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((org) => {
      if (typeof org === "string") {
        return { id: org };
      }
      if (org && typeof org === "object") {
        const value = org as { id?: string; name?: string };
        return value.id ? { id: value.id, name: value.name } : null;
      }
      return null;
    })
    .filter((org): org is AvailableOrganization => !!org);
}

function buildNextStep(
  code: string | undefined,
  data: WorkosAuthErrorData | null,
  email: string
): AuthNextStep | null {
  if (!code || !data?.pending_authentication_token) return null;

  const resolvedEmail = data.email ?? data.user?.email ?? email;

  switch (code) {
    case "email_verification_required":
      logger("info", "auth.next_step", {
        step: "email_verification",
        email: resolvedEmail,
      });
      return {
        status: "next_step",
        step: "email_verification",
        pendingAuthenticationToken: data.pending_authentication_token,
        email: resolvedEmail,
      };
    case "mfa_enrollment": {
      if (!resolvedEmail) return null;
      logger("info", "auth.next_step", {
        step: "mfa_enrollment",
        email: resolvedEmail,
      });
      return {
        status: "next_step",
        step: "mfa_enrollment",
        pendingAuthenticationToken: data.pending_authentication_token,
        email: resolvedEmail,
      };
    }
    case "mfa_challenge": {
      const factors = normalizeFactors(data.authentication_factors);
      logger("info", "auth.next_step", {
        step: "mfa_challenge",
      });
      return {
        status: "next_step",
        step: "mfa_challenge",
        pendingAuthenticationToken: data.pending_authentication_token,
        authenticationFactors: factors,
      };
    }
    case "organization_selection_required": {
      const organizations = normalizeOrganizations(
        data.organizations ?? data.available_organizations
      );
      logger("info", "auth.next_step", {
        step: "organization_selection",
      });
      return {
        status: "next_step",
        step: "organization_selection",
        pendingAuthenticationToken: data.pending_authentication_token,
        availableOrganizations: organizations,
      };
    }
    default:
      return null;
  }
}

function extractErrorCode(error: unknown, data: WorkosAuthErrorData | null) {
  const errorCode =
    data?.code ??
    (error && typeof error === "object" && "code" in error
      ? String((error as { code?: string }).code)
      : undefined) ??
    (error instanceof OauthException ? error.error : undefined);

  return errorCode;
}

function logAuthError(event: string, error: unknown, code?: string) {
  const payload: Record<string, string | undefined> = { code };

  if (error instanceof Error) {
    payload.name = error.name;
    payload.message = error.message;
  }

  logger("error", event, payload);
}

async function handleAuthSuccess(authResponse: {
  sealedSession?: string;
}): Promise<AuthResponse> {
  if (!authResponse.sealedSession) {
    throw new Response("Missing session data", { status: 500 });
  }

  const authkit = await getAuthkit();
  logger("info", "auth.session.save.attempt", {});
  await authkit.saveSession(undefined, authResponse.sealedSession);
  logger("info", "auth.session.save.success", {});

  return {
    status: "success",
  };
}

export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async () => {
    const auth = await getAuth();
    if (!auth.user) {
      logger("info", "auth.user.none", {});
      return null;
    }
    logger("info", "auth.user.current", {
      userId: auth.user.id,
      sessionId: auth.sessionId,
      organizationId: auth.organizationId ?? null,
    });

    return {
      userId: auth.user.id,
      email: auth.user.email,
      sessionId: auth.sessionId,
      organizationId: auth.organizationId ?? null,
      role: auth.role,
      permissions: auth.permissions ?? [],
    };
  }
);

export const requireAuth = createServerFn().handler(async () => {
  const user = await getCurrentUser();

  if (!user) {
    logger("warn", "auth.guard.redirect", { to: "/login" });
    throw redirect({ to: "/login" });
  }

  return user;
});

export const loginWithPassword = createServerFn({ method: "POST" })
  .inputValidator(loginSchema)
  .handler(async ({ data }) => {
    assertSameOrigin();
    const email = data.email.trim().toLowerCase();
    const ipAddress = getClientIp();
    const ipKey = ipAddress ?? "unknown";
    logger("info", "rate.limit.check", {
      key: `auth:password:${ipKey}:${email}`,
    });
    await enforceRateLimit(`auth:password:${ipKey}:${email}`);

    const userAgent = getRequestHeader("user-agent") ?? undefined;

    try {
      logger("info", "auth.password.attempt", {
        email,
        ipAddress,
        userAgent,
      });
      const authResponse = await workos.userManagement.authenticateWithPassword(
        {
          clientId: env.WORKOS_CLIENT_ID,
          email,
          password: data.password,
          ...(ipAddress ? { ipAddress } : {}),
          ...(userAgent ? { userAgent } : {}),
          session: sessionOptions,
        }
      );

      logger("info", "auth.password.success", { email });
      return await handleAuthSuccess(authResponse);
    } catch (error) {
      const data = extractErrorData(error);
      const code = extractErrorCode(error, data);
      const nextStep = buildNextStep(code, data, email);

      if (nextStep) {
        logger("info", "auth.password.next_step", { step: nextStep.step });
        return nextStep;
      }

      if (code === "invalid_grant" || code === "invalid_credentials") {
        logger("warn", "auth.password.invalid", { email });
        return new Response("Invalid credentials", { status: 401 });
      }

      if (code === "sso_required") {
        logger("info", "auth.password.sso_required", { email });
        return new Response("Single sign-on required", { status: 403 });
      }

      logAuthError("auth.password.error", error, code);
      return new Response("Internal Server Error", { status: 500 });
    }
  });

export const verifyEmail = createServerFn({ method: "POST" })
  .inputValidator(emailVerificationSchema)
  .handler(async ({ data }) => {
    assertSameOrigin();
    const ipAddress = getClientIp();
    const ipKey = ipAddress ?? "unknown";
    logger("info", "rate.limit.check", { key: `auth:email:${ipKey}` });
    await enforceRateLimit(`auth:email:${ipKey}`);

    const userAgent = getRequestHeader("user-agent") ?? undefined;

    try {
      logger("info", "auth.email.verify.attempt", {
        ipAddress,
        userAgent,
      });
      const authResponse =
        await workos.userManagement.authenticateWithEmailVerification({
          clientId: env.WORKOS_CLIENT_ID,
          code: data.code,
          pendingAuthenticationToken: data.pendingAuthenticationToken,
          ...(ipAddress ? { ipAddress } : {}),
          ...(userAgent ? { userAgent } : {}),
          session: sessionOptions,
        });

      logger("info", "auth.email.verify.success", {});
      return await handleAuthSuccess(authResponse);
    } catch (error) {
      const data = extractErrorData(error);
      const code = extractErrorCode(error, data);
      const nextStep = buildNextStep(code, data, "");

      if (nextStep) {
        logger("info", "auth.email.verify.next_step", { step: nextStep.step });
        return nextStep;
      }

      logAuthError("auth.email.error", error, code);
      return new Response("Invalid verification code", { status: 401 });
    }
  });

export const startTotpEnrollment = createServerFn({ method: "POST" })
  .inputValidator(totpEnrollmentSchema)
  .handler(async ({ data }) => {
    assertSameOrigin();
    const ipAddress = getClientIp();
    const ipKey = ipAddress ?? "unknown";
    logger("info", "rate.limit.check", { key: `auth:mfa-enroll:${ipKey}` });
    await enforceRateLimit(`auth:mfa-enroll:${ipKey}`);

    try {
      const email = data.email.trim().toLowerCase();
      logger("info", "auth.mfa.enroll.attempt", { email });
      const factor = await workos.mfa.enrollFactor({
        type: "totp",
        issuer: env.WORKOS_TOTP_ISSUER ?? "AVM Daily",
        user: email,
      });
      if (!factor.totp) {
        return new Response("Unable to enroll TOTP", { status: 500 });
      }

      logger("info", "auth.mfa.enroll.success", {
        authenticationFactorId: factor.id,
      });
      return {
        authenticationFactorId: factor.id,
        qrCode: factor.totp.qrCode,
        secret: factor.totp.secret,
        uri: factor.totp.uri,
      };
    } catch (error) {
      logAuthError("auth.mfa.enroll.error", error);
      return new Response("Unable to enroll MFA", { status: 500 });
    }
  });

export const startTotpChallenge = createServerFn({ method: "POST" })
  .inputValidator(challengeSchema)
  .handler(async ({ data }) => {
    assertSameOrigin();
    const ipAddress = getClientIp();
    const ipKey = ipAddress ?? "unknown";
    logger("info", "rate.limit.check", {
      key: `auth:mfa-challenge:${ipKey}`,
    });
    await enforceRateLimit(`auth:mfa-challenge:${ipKey}`);

    try {
      logger("info", "auth.mfa.challenge.attempt", {
        authenticationFactorId: data.authenticationFactorId,
      });
      const challenge = await workos.mfa.challengeFactor({
        authenticationFactorId: data.authenticationFactorId,
      });

      logger("info", "auth.mfa.challenge.success", {
        authenticationChallengeId: challenge.id,
      });
      return {
        authenticationChallengeId: challenge.id,
        expiresAt: challenge.expiresAt ?? null,
      };
    } catch (error) {
      logAuthError("auth.mfa.challenge.error", error);
      return new Response("Unable to start MFA challenge", { status: 500 });
    }
  });

export const completeTotp = createServerFn({ method: "POST" })
  .inputValidator(totpSchema)
  .handler(async ({ data }) => {
    assertSameOrigin();
    const ipAddress = getClientIp();
    const ipKey = ipAddress ?? "unknown";
    logger("info", "rate.limit.check", { key: `auth:mfa-verify:${ipKey}` });
    await enforceRateLimit(`auth:mfa-verify:${ipKey}`);

    const userAgent = getRequestHeader("user-agent") ?? undefined;

    try {
      logger("info", "auth.mfa.verify.attempt", {
        authenticationChallengeId: data.authenticationChallengeId,
      });
      const authResponse = await workos.userManagement.authenticateWithTotp({
        clientId: env.WORKOS_CLIENT_ID,
        code: data.code,
        pendingAuthenticationToken: data.pendingAuthenticationToken,
        authenticationChallengeId: data.authenticationChallengeId,
        ...(ipAddress ? { ipAddress } : {}),
        ...(userAgent ? { userAgent } : {}),
        session: sessionOptions,
      });

      logger("info", "auth.mfa.verify.success", {});
      return await handleAuthSuccess(authResponse);
    } catch (error) {
      const data = extractErrorData(error);
      const code = extractErrorCode(error, data);
      const nextStep = buildNextStep(code, data, "");

      if (nextStep) {
        logger("info", "auth.mfa.verify.next_step", { step: nextStep.step });
        return nextStep;
      }

      logAuthError("auth.mfa.verify.error", error, code);
      return new Response("Invalid MFA code", { status: 401 });
    }
  });

export const selectOrganization = createServerFn({ method: "POST" })
  .inputValidator(organizationSelectionSchema)
  .handler(async ({ data }) => {
    assertSameOrigin();
    const ipAddress = getClientIp();
    const ipKey = ipAddress ?? "unknown";
    logger("info", "rate.limit.check", { key: `auth:org:${ipKey}` });
    await enforceRateLimit(`auth:org:${ipKey}`);

    const userAgent = getRequestHeader("user-agent") ?? undefined;

    try {
      logger("info", "auth.organization.select.attempt", {
        organizationId: data.organizationId,
      });
      const authResponse =
        await workos.userManagement.authenticateWithOrganizationSelection({
          clientId: env.WORKOS_CLIENT_ID,
          organizationId: data.organizationId,
          pendingAuthenticationToken: data.pendingAuthenticationToken,
          ...(ipAddress ? { ipAddress } : {}),
          ...(userAgent ? { userAgent } : {}),
          session: sessionOptions,
        });

      logger("info", "auth.organization.select.success", {
        organizationId: data.organizationId,
      });
      return await handleAuthSuccess(authResponse);
    } catch (error) {
      const data = extractErrorData(error);
      const code = extractErrorCode(error, data);
      const nextStep = buildNextStep(code, data, "");

      if (nextStep) {
        logger("info", "auth.organization.next_step", { step: nextStep.step });
        return nextStep;
      }

      logAuthError("auth.organization.error", error, code);
      return new Response("Unable to select organization", { status: 400 });
    }
  });

export const signOutUser = createServerFn({ method: "POST" })
  .inputValidator((data: { returnTo?: string }) =>
    data && typeof data === "object" ? data : {}
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
      "/"
    );

    const authkit = await getAuthkit();
    logger("info", "auth.logout.attempt", { sessionId: auth.sessionId });
    const { logoutUrl } = await authkit.signOut(auth.sessionId, { returnTo });
    logger("info", "auth.logout.success", { logoutUrl });

    return { logoutUrl };
  });
