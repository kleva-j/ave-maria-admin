import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_CONVEX_URL: z.url(),
    VITE_POSTHOG_KEY: z.string().min(1),
    VITE_POSTHOG_HOST: z.url().default("https://us.i.posthog.com"),
  },
  runtimeEnv: (import.meta as any).env,
  emptyStringAsUndefined: true,
});
