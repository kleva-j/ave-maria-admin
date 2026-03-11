import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    WORKOS_CLIENT_ID: z.string().min(1),
    WORKOS_API_KEY: z.string().min(1),
    WORKOS_REDIRECT_URI: z.string().url(),
    WORKOS_COOKIE_PASSWORD: z.string().min(32),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
