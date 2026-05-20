import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "EXPO_PUBLIC_",
  client: {
    EXPO_PUBLIC_CONVEX_URL: z.url(),
    EXPO_PUBLIC_POSTHOG_KEY: z.string().min(1),
    EXPO_PUBLIC_POSTHOG_HOST: z.string().url().default("https://us.i.posthog.com"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
