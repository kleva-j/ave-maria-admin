import { createIsomorphicFn } from "@tanstack/react-start";
import { Axiom } from "@axiomhq/js";

export const LOG_LEVELS = {
  debug: "debug",
  info: "info",
  warn: "warn",
  error: "error",
} as const;

export type LogLevel = (typeof LOG_LEVELS)[keyof typeof LOG_LEVELS];

let _axiom: Axiom | null = null;

function getAxiom(): Axiom | null {
  if (process.env.NODE_ENV !== "production") return null;
  if (!process.env.AXIOM_TOKEN || !process.env.AXIOM_DATASET) return null;
  return (_axiom ??= new Axiom({ token: process.env.AXIOM_TOKEN }));
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
      getAxiom()?.ingest(process.env.AXIOM_DATASET!, [entry]);
    }
  })
  .client((level: LogLevel, event: string, data?: any) => {
    if (process.env.NODE_ENV === "development") {
      console[level](`[CLIENT] [${level.toUpperCase()}]`, event, data);
    }
  });
