import { createIsomorphicFn } from "@tanstack/react-start";

export const LOG_LEVELS = {
  debug: "debug",
  info: "info",
  warn: "warn",
  error: "error",
} as const;

export type LogLevel = (typeof LOG_LEVELS)[keyof typeof LOG_LEVELS];

export const logger = createIsomorphicFn()
  .server((level: LogLevel, event: string, data?: any) => {
    const timestamp = new Date().toISOString();

    if (process.env.NODE_ENV === "development") {
      // Development: Detailed console logging
      console[level](`[${timestamp}] [${level.toUpperCase()}]`, event, data);
    } else {
      // Production: Structured JSON logging
      console.log(
        JSON.stringify({
          timestamp,
          level,
          event,
          data,
          service: "tanstack-start",
          environment: process.env.NODE_ENV,
        })
      );
    }
  })
  .client((level: LogLevel, event: string, data?: any) => {
    if (process.env.NODE_ENV === "development") {
      console[level](`[CLIENT] [${level.toUpperCase()}]`, event, data);
    } else {
      // Production: Send to analytics service
      // analytics.track('client_log', { level, event, data })
    }
  });
