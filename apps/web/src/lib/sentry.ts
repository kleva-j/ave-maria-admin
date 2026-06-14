import * as Sentry from "@sentry/tanstackstart-react";
import { env } from "@avm-daily/env/web";

import type { getRouter } from "@/router";

let initialized = false;

/**
 * Initialize Sentry on the client. Idempotent + a silent no-op when the DSN
 * is not configured, so dev environments need no extra setup.
 *
 * Called from `getRouter()` after `createTanStackRouter` so the router is
 * available for `tanstackRouterBrowserTracingIntegration`.
 *
 * Server-side init lives in `apps/web/instrument.server.mjs` and is loaded
 * via the `--import` Node flag set in package.json scripts.
 */
export function initSentry(router: ReturnType<typeof getRouter>) {
  if (router.isServer || initialized) return;
  if (!env.VITE_SENTRY_DSN) return;

  try {
    Sentry.init({
      dsn: env.VITE_SENTRY_DSN,
      environment: env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE,
      integrations: [
        Sentry.tanstackRouterBrowserTracingIntegration(router),
        Sentry.replayIntegration({
          maskAllText: true,
          maskAllInputs: true,
          blockAllMedia: true,
        }),
      ],
      tracesSampleRate: env.VITE_SENTRY_TRACES_SAMPLE_RATE,
      replaysSessionSampleRate: env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
      replaysOnErrorSampleRate: env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
      sendDefaultPii: false,
    });
    initialized = true;
  } catch (e) {
    console.error("[sentry] init failed", e);
  }
}

export { Sentry };
