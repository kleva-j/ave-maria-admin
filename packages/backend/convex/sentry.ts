/**
 * Sentry error reporting for Convex functions — DSN envelope over fetch.
 *
 * Why this file has no @sentry/* import:
 *
 * Convex runs each function in a V8 isolate whose default runtime does not
 * provide Node built-ins (`node:http`, `node:https`, `node:async_hooks`,
 * `fs`, `path`, etc.). Every published Sentry runtime SDK we evaluated
 * pulls one or more of those in transitively at bundle time, which breaks
 * `npx convex codegen`:
 *
 *   - @sentry/node        → requires `node:http` / `node:https` via node-core
 *   - @sentry/cloudflare  → requires `node:async_hooks` for context propagation
 *   - @sentry/core        → does not export a runtime `init`; the only
 *                           entrypoint is `initAndBind(Client, options)` and
 *                           every Client shipped with the platform SDKs pulls
 *                           in its runtime's Node built-ins
 *
 * Adding `"use node"` to sentry.ts is not a fix either: the modules that
 * import it — admin.ts, adminSync.ts, transactions.ts — export queries and
 * mutations alongside their actions, and Convex forbids `"use node"` in
 * files that export anything other than actions.
 *
 * Instead this module builds Sentry envelopes by hand and POSTs them via
 * `fetch` (available in the default runtime). The envelope format is the
 * public wire protocol Sentry's ingest endpoint accepts, so events show up
 * in the dashboard exactly as if a real SDK sent them.
 *
 * Public API preserved so callers don't change:
 *   - captureCriticalError(err, context?) — enqueue an error event
 *   - flushSentry(timeoutMs = 2000)       — await pending sends
 *   - withSentry(handler)                 — action wrapper: capture + flush
 *                                            + re-throw
 *
 * Every export is a silent no-op when `SENTRY_DSN` is unset. captureCriticalError
 * and withSentry never throw for reasons unrelated to the caller's handler.
 */

const SDK_NAME = "avm-daily-convex";
const SDK_VERSION = "1.0.0";
const DEFAULT_FLUSH_TIMEOUT_MS = 2000;

type StackFrame = {
  filename: string;
  function: string;
  lineno: number;
  colno: number;
};

type SentryEvent = {
  event_id: string;
  timestamp: number;
  platform: "javascript";
  level: "error";
  environment?: string;
  release?: string;
  exception: { values: Array<Record<string, unknown>> };
  extra?: Record<string, unknown>;
  sdk: { name: string; version: string };
};

interface DsnParts {
  scheme: string;
  publicKey: string;
  host: string;
  projectId: string;
}

function parseDsn(dsn: string): DsnParts | null {
  try {
    const url = new URL(dsn);
    // DSN format: https://{public_key}@{host}[:port]/{project_id}
    // The project id is the last (usually only) path segment.
    const projectId = url.pathname.replace(/^\/+/, "").split("/").pop();
    if (!url.username || !url.host || !projectId) return null;
    return {
      scheme: url.protocol.replace(":", ""),
      publicKey: url.username,
      host: url.host,
      projectId,
    };
  } catch {
    return null;
  }
}

function newEventId(): string {
  // Sentry expects a 32-char hex event_id. crypto.randomUUID is available
  // in the Convex default runtime; strip the dashes to match.
  return globalThis.crypto.randomUUID().replace(/-/g, "");
}

/**
 * Best-effort V8 stack parse. Sentry accepts any subset of frame fields;
 * unparseable frames are silently dropped. Returns innermost-first (Sentry's
 * expected ordering); V8 emits outermost-first.
 */
function parseStack(stack: string): StackFrame[] {
  const frames: StackFrame[] = [];
  for (const line of stack.split("\n").slice(1)) {
    // Match `    at fn (file:line:col)`
    let m = line.match(/^\s*at (.+?) \((.+?):(\d+):(\d+)\)$/);
    if (m) {
      frames.push({
        function: m[1],
        filename: m[2],
        lineno: Number(m[3]),
        colno: Number(m[4]),
      });
      continue;
    }
    // Match `    at file:line:col` (anonymous)
    m = line.match(/^\s*at (.+?):(\d+):(\d+)$/);
    if (m) {
      frames.push({
        function: "<anonymous>",
        filename: m[1],
        lineno: Number(m[2]),
        colno: Number(m[3]),
      });
    }
  }
  return frames.reverse();
}

function errorToEvent(
  err: unknown,
  context?: Record<string, unknown>,
): SentryEvent {
  const isErr = err instanceof Error;
  const values: Array<Record<string, unknown>> = [
    {
      type: isErr ? err.name : "Error",
      value: isErr ? err.message : String(err),
    },
  ];
  if (isErr && err.stack) {
    const frames = parseStack(err.stack);
    if (frames.length > 0) values[0].stacktrace = { frames };
  }
  return {
    event_id: newEventId(),
    timestamp: Date.now() / 1000,
    platform: "javascript",
    level: "error",
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,
    exception: { values },
    ...(context ? { extra: context } : {}),
    sdk: { name: SDK_NAME, version: SDK_VERSION },
  };
}

function buildEnvelope(event: SentryEvent, dsn: DsnParts): string {
  // Sentry envelope = newline-separated JSON:
  //   {envelope_header}\n{item_header}\n{item_payload}
  const envelopeHeader = JSON.stringify({
    event_id: event.event_id,
    sent_at: new Date().toISOString(),
    dsn: `${dsn.scheme}://${dsn.publicKey}@${dsn.host}/${dsn.projectId}`,
  });
  const itemHeader = JSON.stringify({
    type: "event",
    content_type: "application/json",
  });
  return `${envelopeHeader}\n${itemHeader}\n${JSON.stringify(event)}`;
}

// Track in-flight sends so flushSentry can await them.
const pendingSends: Set<Promise<void>> = new Set();

function sendEvent(dsn: DsnParts, event: SentryEvent): Promise<void> {
  const url = `${dsn.scheme}://${dsn.host}/api/${dsn.projectId}/envelope/`;
  const auth =
    `Sentry sentry_version=7,sentry_client=${SDK_NAME}/${SDK_VERSION},` +
    `sentry_key=${dsn.publicKey}`;
  const body = buildEnvelope(event, dsn);
  // Never throw or propagate — capture is best-effort. Individual failures
  // are silently swallowed so a Sentry outage can't affect the caller's
  // control flow.
  const p = fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-sentry-envelope",
      "X-Sentry-Auth": auth,
    },
    body,
    signal: AbortSignal.timeout(DEFAULT_FLUSH_TIMEOUT_MS),
  })
    .then(() => undefined)
    .catch(() => undefined);
  pendingSends.add(p);
  void p.finally(() => {
    pendingSends.delete(p);
  });
  return p;
}

/**
 * One-line capture for code paths that already handle the error locally
 * (existing audit-log + rollback patterns). Never throws — capture failures
 * must not mask the original error path.
 */
export function captureCriticalError(
  err: unknown,
  context?: Record<string, unknown>,
): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  const parts = parseDsn(dsn);
  if (!parts) {
    // Invalid DSN — log once so misconfig is visible, don't retry per call.
    console.error("[sentry] SENTRY_DSN is not a valid DSN — capture disabled.");
    return;
  }
  try {
    const event = errorToEvent(err, context);
    void sendEvent(parts, event);
  } catch {
    // Never throw.
  }
}

/**
 * Best-effort flush of the in-flight send buffer, bounded by timeoutMs.
 * Convex isolates are short-lived, so capture-and-return code paths must
 * flush before returning or the fetch may be aborted mid-request. Never
 * throws — the caller's error semantics must not be affected.
 */
export async function flushSentry(
  timeoutMs = DEFAULT_FLUSH_TIMEOUT_MS,
): Promise<void> {
  if (pendingSends.size === 0) return;
  const snapshot = Array.from(pendingSends);
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  try {
    await Promise.race([Promise.allSettled(snapshot), timeout]);
  } catch {
    // Never throw.
  }
}

/**
 * Higher-order wrapper for Convex action handlers. Catches throws, captures
 * them, flushes the buffer, then re-throws so existing error semantics
 * (rollback, audit log, UI surfaces) are preserved.
 *
 * Usage:
 *   export const myAction = action({
 *     args: { ... },
 *     returns: ...,
 *     handler: withSentry(async (ctx, args) => { ... }),
 *   });
 */
export function withSentry<TArgs extends unknown[], TResult>(
  handler: (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    try {
      return await handler(...args);
    } catch (err) {
      captureCriticalError(err);
      await flushSentry();
      throw err;
    }
  };
}
