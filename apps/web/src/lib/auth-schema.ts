import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email is required"),
  password: z.string().min(1, "Password is required"),
});

export const pendingTokenSchema = z.object({
  pendingAuthenticationToken: z.string().min(1),
});

export const emailVerificationSchema = pendingTokenSchema.extend({
  code: z.string().min(4, "Verification code is required"),
});

export const totpSchema = pendingTokenSchema.extend({
  code: z.string().min(6, "Code must be at least 6 digits"),
  authenticationChallengeId: z.string().min(1),
});

export const totpEnrollmentSchema = z.object({
  email: z.string().email(),
});

export const challengeSchema = z.object({
  authenticationFactorId: z.string().min(1),
});

export const organizationSelectionSchema = pendingTokenSchema.extend({
  organizationId: z.string().min(1),
});
