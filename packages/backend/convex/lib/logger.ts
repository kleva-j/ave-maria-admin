export type LogLevel = "debug" | "info" | "warn" | "error";

export interface ConvexLogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  service: "convex";
  userId?: string;
  data?: Record<string, unknown>;
}

export function buildEntry(
  level: LogLevel,
  event: string,
  data?: Record<string, unknown>,
  userId?: string,
): ConvexLogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    event,
    service: "convex",
    userId,
    data,
  };
}
