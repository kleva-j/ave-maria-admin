import { createIsomorphicFn } from "@tanstack/react-start";
import * as Sentry from "@sentry/tanstackstart-react";
import { Axiom } from "@axiomhq/js";

export const LOG_LEVELS = {
  debug: "debug",
  info: "info",
  warn: "warn",
  error: "error",
} as const;

export type LogLevel = (typeof LOG_LEVELS)[keyof typeof LOG_LEVELS];

let _axiom: Axiom | null = null;

function getAxiom(): { client: Axiom; dataset: string } | null {
  if (process.env.NODE_ENV !== "production") return null;
  const token = process.env.AXIOM_TOKEN;
  const dataset = process.env.AXIOM_DATASET;
  if (!token || !dataset) return null;
  return { client: (_axiom ??= new Axiom({ token })), dataset };
}

// Forward error-level logs to Sentry as captured messages. Unhandled throws
// are already caught by sentryGlobalRequestMiddleware + sentryGlobalFunctionMiddleware
// in start.ts — this covers explicit logger.error(...) calls that don't throw.
// No-op when Sentry was not initialized (DSN unset in instrument.server.mjs).
function forwardErrorToSentry(
  level: LogLevel,
  event: string,
  data?: unknown,
): void {
  if (level !== "error") return;
  const err = data instanceof Error ? data : undefined;
  if (err) {
    Sentry.captureException(err, { extra: { event } });
  } else {
    Sentry.captureMessage(event, { level: "error", extra: { data } });
  }
}

export const logger = createIsomorphicFn()
  .server((level: LogLevel, event: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      level,
      event,
      data,
      service: "avm-daily-server-logs",
      environment: process.env.NODE_ENV,
    };

    if (process.env.NODE_ENV === "development") {
      console[level](`[${timestamp}] [${level.toUpperCase()}]`, event, data);
    } else {
      console.log(JSON.stringify(entry));
      const ax = getAxiom();
      ax?.client.ingest(ax.dataset, [entry]);
    }

    forwardErrorToSentry(level, event, data);
  })
  .client((level: LogLevel, event: string, data?: any) => {
    if (process.env.NODE_ENV === "development") {
      console[level](`[CLIENT] [${level.toUpperCase()}]`, event, data);
    }

    forwardErrorToSentry(level, event, data);
  });
