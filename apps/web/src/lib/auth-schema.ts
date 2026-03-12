import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Email is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginSchema = z.infer<typeof loginSchema>;

export const pendingTokenSchema = z.object({
  pendingAuthenticationToken: z.string().min(1),
});

export const emailVerificationSchema = pendingTokenSchema.extend({
  code: z.string().min(4, "Verification code is required"),
});

export type EmailVerificationSchema = z.infer<typeof emailVerificationSchema>;

export const totpSchema = pendingTokenSchema.extend({
  code: z.string().min(6, "Code must be at least 6 digits"),
  authenticationChallengeId: z.string().min(1),
});

export const totpEnrollmentSchema = z.object({
  email: z.email(),
});

export const challengeSchema = z.object({
  authenticationFactorId: z.string().min(1),
});

export type ChallengeSchema = z.infer<typeof challengeSchema>;

export const organizationSelectionSchema = pendingTokenSchema.extend({
  organizationId: z.string().min(1),
});

export type OrganizationSelectionSchema = z.infer<
  typeof organizationSelectionSchema
>;
