import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_CONVEX_URL: z.url(),
    VITE_POSTHOG_KEY: z.string().min(1).optional(),
    VITE_POSTHOG_HOST: z.url().default("https://us.i.posthog.com"),
    VITE_NOVU_APP_ID: z.string().min(1).optional(),
    VITE_NOVU_BACKEND_URL: z.url().optional(),
    VITE_NOVU_SOCKET_URL: z.url().optional(),
  },
  runtimeEnv: (import.meta as any).env,
  emptyStringAsUndefined: true,
});
