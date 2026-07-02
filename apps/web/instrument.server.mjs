// Server-side Sentry init for TanStack Start. Loaded via NODE_OPTIONS
// `--import ./instrument.server.mjs` so Sentry is registered before any
// application code runs. Silent no-op when SENTRY_DSN is unset.
import * as Sentry from "@sentry/tanstackstart-react";

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    sendDefaultPii: false,
  });
}
