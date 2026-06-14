import tailwindcss from "@tailwindcss/vite";
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  // Load all envs (no VITE_ prefix filter) so SENTRY_AUTH_TOKEN / ORG / PROJECT
  // resolve at build time. The plugin no-ops silently when authToken is unset
  // so local dev builds without Sentry credentials still work.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      tsconfigPaths(),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
      sentryTanstackStart({
        org: env.SENTRY_ORG,
        project: env.SENTRY_PROJECT_WEB,
        authToken: env.SENTRY_AUTH_TOKEN,
        telemetry: false,
      }),
    ],
    server: {
      port: 3001,
    },
  };
});
