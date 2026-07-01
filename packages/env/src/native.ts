import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "EXPO_PUBLIC_",
  client: {
    EXPO_PUBLIC_CONVEX_URL: z.url(),
    EXPO_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
    EXPO_PUBLIC_POSTHOG_HOST: z.url().default("https://us.i.posthog.com"),
    EXPO_PUBLIC_NOVU_APP_ID: z.string().min(1).optional(),
    EXPO_PUBLIC_NOVU_BACKEND_URL: z.url().optional(),
    EXPO_PUBLIC_NOVU_SOCKET_URL: z.url().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
