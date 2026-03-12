import { DEFAULT_RETURN_PATH, getSafeReturnPathname } from "@/lib/auth";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { toast } from "@avm-daily/ui/components/sonner";
import { Button } from "@avm-daily/ui/components/button";
import { Input } from "@avm-daily/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import { loginSchema } from "@/lib/auth-schema";
import { useForm } from "@tanstack/react-form";
import { useMemo, useState } from "react";
import { z } from "zod";

import type {
  EmailVerificationSchema,
  ChallengeSchema,
  LoginSchema,
} from "@/lib/auth-schema";

import type {
  AvailableOrganization,
  AuthResponse,
  AuthNextStep,
  AuthStep,
} from "@/lib/auth";

import {
  CardContent,
  CardHeader,
  CardTitle,
  Card,
} from "@avm-daily/ui/components/card";

import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";

import {
  startTotpEnrollment,
  selectOrganization,
  startTotpChallenge,
  loginWithPassword,
  completeTotp,
  verifyEmail,
} from "@/server/auth.functions";

import {
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Field,
} from "@avm-daily/ui/components/field";

const emailVerificationSchema = z.object({
  code: z.string().min(4, "Verification code is required"),
});

const totpCodeSchema = z.object({
  code: z.string().min(6, "Code must be at least 6 digits"),
});

export const Route = createFileRoute("/login")({
  validateSearch: z.object({
    returnTo: z.string().optional().default(DEFAULT_RETURN_PATH),
  }),
  loader: async ({ location }) => {
    const params = new URLSearchParams(location.search);
    const returnTo = getSafeReturnPathname(
      params.get("returnTo") ?? undefined,
      DEFAULT_RETURN_PATH,
    );
    return { returnTo };
  },
  component: LoginPage,
});

type LoginStep = "credentials" | AuthStep;

function LoginPage() {
  const router = useRouter();
  const navigate = useNavigate();

  const { returnTo } = Route.useLoaderData();
  const { getAuth } = useAuth();

  const [step, setStep] = useState<LoginStep>("credentials");
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState<string>("");
  const [availableOrganizations, setAvailableOrganizations] = useState<
    AvailableOrganization[]
  >([]);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [totpQrCode, setTotpQrCode] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);

  const resetFlow = () => {
    setStep("credentials");
    setPendingToken(null);
    setLoginEmail("");
    setAvailableOrganizations([]);
    setChallengeId(null);
    setTotpQrCode(null);
    setTotpSecret(null);
    setFlowError(null);
  };

  const finalizeAuth = async () => {
    await getAuth();
    await router.invalidate({ sync: true });
    await navigate({ to: returnTo, replace: true });
  };

  const handleNextStep = async (result: AuthNextStep) => {
    setFlowError(null);
    setPendingToken(result.pendingAuthenticationToken);

    switch (result.step) {
      case "email_verification":
        setStep("email_verification");
        return;
      case "organization_selection":
        setAvailableOrganizations(result.availableOrganizations);
        setStep("organization_selection");
        return;
      case "mfa_enrollment": {
        setStep("mfa_enrollment");

        const email = (result.email || loginEmail).trim().toLowerCase();

        if (!email) {
          setFlowError("Unable to enroll MFA for this account.");
          return;
        }

        try {
          const enrollment = await startTotpEnrollmentMutation.mutateAsync({
            email,
          });

          setTotpQrCode(enrollment.qrCode);
          setTotpSecret(enrollment.secret);

          const challenge = await startTotpChallengeMutation.mutateAsync({
            authenticationFactorId: enrollment.authenticationFactorId,
          });

          setChallengeId(challenge.authenticationChallengeId);
        } catch (error) {
          setFlowError(await toErrorMessage(error, "Unable to start MFA"));
        }
        return;
      }
      case "mfa_challenge": {
        setStep("mfa_challenge");

        const totpFactor = result.authenticationFactors.find(
          (factor) => factor.type === "totp",
        );

        if (!totpFactor?.id) {
          setFlowError("No TOTP factor available for this account.");
          return;
        }

        try {
          const challenge = await startTotpChallengeMutation.mutateAsync({
            authenticationFactorId: totpFactor.id,
          });
          setChallengeId(challenge.authenticationChallengeId);
        } catch (error) {
          setFlowError(await toErrorMessage(error, "Unable to start MFA"));
        }
        return;
      }
    }
  };

  const loginMutation = useMutation({
    mutationFn: async (payload: LoginSchema) => {
      const result = await loginWithPassword({ data: payload });
      if (result instanceof Response) throw result;
      return result as AuthResponse;
    },
    onSuccess: async (result) => {
      if (result.status === "success") {
        toast.success("Successfully signed in!");
        await finalizeAuth();
      } else {
        await handleNextStep(result);
      }
    },
    onError: (error) => {
      toast.error(
        error instanceof Response
          ? "Invalid email or password"
          : "Unable to sign in. Please try again.",
      );
    },
  });

  const verifyEmailMutation = useMutation({
    mutationFn: async (payload: EmailVerificationSchema) => {
      const result = await verifyEmail({ data: payload });
      if (result instanceof Response) throw result;
      return result as AuthResponse;
    },
    onSuccess: async (result) => {
      if (result.status === "success") {
        toast.success("Email verified successfully!");
        await finalizeAuth();
      } else {
        await handleNextStep(result);
      }
    },
    onError: () => {
      toast.error("Invalid verification code. Please try again.");
    },
  });

  const startTotpEnrollmentMutation = useMutation({
    mutationFn: async (payload: Omit<LoginSchema, "password">) => {
      const result = await startTotpEnrollment({ data: payload });
      if (result instanceof Response) throw result;
      return result as {
        authenticationFactorId: string;
        qrCode: string;
        secret: string;
      };
    },
    onSuccess: () => {
      toast.info("Scan the QR code with your authenticator app");
    },
  });

  const startTotpChallengeMutation = useMutation({
    mutationFn: async (payload: ChallengeSchema) => {
      const result = await startTotpChallenge({ data: payload });
      if (result instanceof Response) throw result;
      return result as { authenticationChallengeId: string };
    },
  });

  const completeTotpMutation = useMutation({
    mutationFn: async (payload: {
      code: string;
      pendingAuthenticationToken: string;
      authenticationChallengeId: string;
    }) => {
      const result = await completeTotp({ data: payload });
      if (result instanceof Response) throw result;
      return result as AuthResponse;
    },
    onSuccess: async (result) => {
      if (result.status === "success") {
        toast.success("MFA verified successfully!");
        await finalizeAuth();
      } else {
        await handleNextStep(result);
      }
    },
    onError: () => {
      toast.error("Invalid MFA code. Please try again.");
    },
  });

  const selectOrganizationMutation = useMutation({
    mutationFn: async (payload: {
      organizationId: string;
      pendingAuthenticationToken: string;
    }) => {
      const result = await selectOrganization({ data: payload });
      if (result instanceof Response) throw result;
      return result as AuthResponse;
    },
    onSuccess: async (result) => {
      if (result.status === "success") {
        toast.success("Organization selected!");
        await finalizeAuth();
      } else {
        await handleNextStep(result);
      }
    },
    onError: () => {
      toast.error("Unable to select organization. Please try again.");
    },
  });

  const isBusy = useMemo(
    () =>
      loginMutation.isPending ||
      verifyEmailMutation.isPending ||
      startTotpEnrollmentMutation.isPending ||
      startTotpChallengeMutation.isPending ||
      completeTotpMutation.isPending ||
      selectOrganizationMutation.isPending,
    [
      loginMutation.isPending,
      verifyEmailMutation.isPending,
      startTotpEnrollmentMutation.isPending,
      startTotpChallengeMutation.isPending,
      completeTotpMutation.isPending,
      selectOrganizationMutation.isPending,
    ],
  );

  const loginForm = useForm({
    defaultValues: { email: "", password: "" },
    validators: { onSubmit: loginSchema },
    onSubmit: async ({ value }) => {
      loginMutation.reset();
      setFlowError(null);
      const normalizedEmail = value.email.trim().toLowerCase();
      setLoginEmail(normalizedEmail);
      try {
        await loginMutation.mutateAsync({
          email: normalizedEmail,
          password: value.password,
        });
      } catch (error) {
        setFlowError(await toErrorMessage(error, "Unable to sign in."));
      }
    },
  });

  const emailVerificationForm = useForm({
    defaultValues: { code: "" },
    validators: { onSubmit: emailVerificationSchema },
    onSubmit: async ({ value }) => {
      if (!pendingToken) return;
      verifyEmailMutation.reset();
      setFlowError(null);
      try {
        await verifyEmailMutation.mutateAsync({
          code: value.code,
          pendingAuthenticationToken: pendingToken,
        });
      } catch (error) {
        setFlowError(await toErrorMessage(error, "Invalid verification code."));
      }
    },
  });

  const totpForm = useForm({
    defaultValues: { code: "" },
    validators: { onSubmit: totpCodeSchema },
    onSubmit: async ({ value }) => {
      if (!pendingToken || !challengeId) return;
      completeTotpMutation.reset();
      setFlowError(null);
      try {
        await completeTotpMutation.mutateAsync({
          code: value.code,
          pendingAuthenticationToken: pendingToken,
          authenticationChallengeId: challengeId,
        });
      } catch (error) {
        setFlowError(await toErrorMessage(error, "Invalid MFA code."));
      }
    },
  });

  const renderCredentials = () => (
    <form onSubmit={loginForm.handleSubmit}>
      <FieldGroup>
        <loginForm.Field name="email">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  type="email"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={isInvalid}
                  placeholder="example@example.com"
                  autoComplete="off"
                  disabled={isBusy}
                  required
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        </loginForm.Field>

        <loginForm.Field name="password">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  type="password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={isInvalid}
                  placeholder="Enter your password"
                  autoComplete="off"
                  disabled={isBusy}
                  required
                />
                <FieldDescription>
                  Use the password for your account.
                </FieldDescription>
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        </loginForm.Field>

        {flowError && (
          <Field>
            <FieldError>{flowError}</FieldError>
          </Field>
        )}

        <Field>
          <Button
            type="submit"
            className="w-full cursor-pointer"
            disabled={isBusy}
            aria-busy={isBusy}
          >
            {isBusy ? "Signing in..." : "Sign in"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );

  const renderEmailVerification = () => (
    <form onSubmit={emailVerificationForm.handleSubmit}>
      <FieldGroup>
        <emailVerificationForm.Field name="code">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Verification code</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  type="text"
                  inputMode="numeric"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={isInvalid}
                  placeholder="Enter code"
                  disabled={isBusy}
                  required
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        </emailVerificationForm.Field>

        {flowError && (
          <Field>
            <FieldError>{flowError}</FieldError>
          </Field>
        )}

        <Field>
          <Button
            type="submit"
            className="w-full cursor-pointer"
            disabled={isBusy}
            aria-busy={isBusy}
          >
            {isBusy ? "Verifying..." : "Verify email"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );

  const renderTotp = () => (
    <form onSubmit={totpForm.handleSubmit}>
      <FieldGroup>
        {totpQrCode && (
          <Field>
            <div className="flex flex-col items-center gap-3">
              <img
                src={totpQrCode}
                alt="Scan this QR code with your authenticator app"
                className="h-40 w-40"
              />
              {totpSecret && (
                <p className="text-xs text-muted-foreground">
                  Secret: {totpSecret}
                </p>
              )}
            </div>
          </Field>
        )}

        <totpForm.Field name="code">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Authenticator code</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  type="text"
                  inputMode="numeric"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={isInvalid}
                  placeholder="123456"
                  disabled={isBusy}
                  required
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        </totpForm.Field>

        {flowError && (
          <Field>
            <FieldError>{flowError}</FieldError>
          </Field>
        )}

        <Field>
          <Button
            type="submit"
            className="w-full cursor-pointer"
            disabled={isBusy}
            aria-busy={isBusy}
          >
            {isBusy ? "Verifying..." : "Verify code"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );

  const renderOrganizations = () => (
    <div className="space-y-3">
      {availableOrganizations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No organizations available for this account.
        </p>
      ) : (
        availableOrganizations.map((org) => (
          <Button
            key={org.id}
            type="button"
            variant="outline"
            className="w-full justify-start"
            disabled={isBusy}
            onClick={async () => {
              if (!pendingToken) return;
              selectOrganizationMutation.reset();
              setFlowError(null);
              try {
                await selectOrganizationMutation.mutateAsync({
                  organizationId: org.id,
                  pendingAuthenticationToken: pendingToken,
                });
              } catch (error) {
                setFlowError(
                  await toErrorMessage(error, "Unable to continue."),
                );
              }
            }}
          >
            {org.name ?? org.id}
          </Button>
        ))
      )}

      {flowError && (
        <Field>
          <FieldError>{flowError}</FieldError>
        </Field>
      )}
    </div>
  );

  const heading = useMemo(() => {
    switch (step) {
      case "email_verification":
        return "Verify your email";
      case "mfa_enrollment":
        return "Set up MFA";
      case "mfa_challenge":
        return "Enter MFA code";
      case "organization_selection":
        return "Select organization";
      default:
        return "Login to your account";
    }
  }, [step]);

  return (
    <div className="flex h-[calc(100vh-2.5rem)] w-full items-center justify-center p-6 md:p-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">{heading}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "credentials" && renderCredentials()}
          {step === "email_verification" && renderEmailVerification()}
          {(step === "mfa_enrollment" || step === "mfa_challenge") &&
            renderTotp()}
          {step === "organization_selection" && renderOrganizations()}

          {step !== "credentials" && (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={resetFlow}
              disabled={isBusy}
            >
              Back to sign in
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Response) {
    const message = await error.text();
    return message || fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}
