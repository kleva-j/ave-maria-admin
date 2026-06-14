import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_CONVEX_URL: z.url(),
    VITE_POSTHOG_KEY: z.string().min(1).optional(),
    VITE_POSTHOG_HOST: z.url().default("https://us.i.posthog.com"),
    VITE_SENTRY_DSN: z.url().optional(),
    VITE_SENTRY_ENVIRONMENT: z.string().min(1).optional(),
    VITE_SENTRY_TRACES_SAMPLE_RATE: z.coerce
      .number()
      .min(0)
      .max(1)
      .default(0.1),
    VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE: z.coerce
      .number()
      .min(0)
      .max(1)
      .default(0),
    VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: z.coerce
      .number()
      .min(0)
      .max(1)
      .default(1),
  },
  runtimeEnv: (import.meta as any).env,
  emptyStringAsUndefined: true,
});
