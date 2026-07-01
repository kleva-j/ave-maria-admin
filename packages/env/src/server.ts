import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    WORKOS_CLIENT_ID: z.string().min(1),
    WORKOS_API_KEY: z.string().min(1),
    WORKOS_REDIRECT_URI: z.string().url(),
    WORKOS_COOKIE_PASSWORD: z.string().min(32),
    WORKOS_TOTP_ISSUER: z.string().min(1).optional(),
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().optional(),
    AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .optional(),
    AXIOM_DATASET: z.string().min(1).optional(),
    AXIOM_TOKEN: z.string().min(1).optional(),
    NOVU_SECRET_KEY: z.string().min(1).optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
