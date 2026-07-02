/**
 * Sentry integration for Convex actions.
 *
 * Convex runs each action in a short-lived V8 isolate, so we cannot rely on
 * a long-lived process-wide init. Instead:
 *
 *   - initSentry() is lazy + idempotent. The first capture in an isolate
 *     pays the init cost; subsequent captures reuse the same client.
 *   - withSentry() wraps an action handler and calls Sentry.flush(2000)
 *     before returning so events are not lost when the isolate is recycled.
 *   - captureCriticalError() is a one-line convenience for the existing
 *     "rollback + critical audit log + throw" pattern in admin.ts /
 *     adminSync.ts. It does not throw on its own.
 *
 * Everything is a silent no-op when process.env.SENTRY_DSN is unset, so dev
 * deployments without a Sentry project remain unaffected.
 */
import * as Sentry from "@sentry/node";

// initAttempted flips true the moment we begin an init call (success OR failure).
// initialized flips true only on success. Splitting them guarantees the "log
// once and never retry" contract when Sentry.init throws (e.g. bad DSN, bad
// integrations config), so subsequent captureCriticalError / withSentry calls
// don't repeatedly attempt init and spam the log.
let initAttempted = false;
let initialized = false;

function parseSampleRate(value: string | undefined): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) return parsed;
  return 0.1;
}

function initSentry(): void {
  if (initAttempted) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  initAttempted = true;
  try {
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
      release: process.env.SENTRY_RELEASE,
      // Defensive parse — a non-numeric env var would otherwise produce NaN
      // and can cause Sentry.init to throw. Clamped to [0, 1]; default 0.1.
      tracesSampleRate: parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE),
      sendDefaultPii: false,
      // Convex isolates don't run full Node — opt out of integrations that
      // hook process / fs / signal handlers. captureException via fetch
      // transport works without them.
      defaultIntegrations: false,
    });
    initialized = true;
  } catch (e) {
    console.error("[sentry] init failed", e);
  }
}

/**
 * One-line capture for code paths that already handle the error locally
 * (existing audit-log + rollback patterns). Lazy-initializes the SDK on
 * first call. Never throws — capture failures must not mask the original
 * error path.
 */
export function captureCriticalError(
  err: unknown,
  context?: Record<string, unknown>,
): void {
  initSentry();
  if (!initialized) return;
  try {
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {
    // Capture must never throw on its own.
  }
}

/**
 * Higher-order wrapper for Convex action handlers. Catches throws, sends them
 * to Sentry, flushes the buffer, then re-throws so existing error semantics
 * (UI surfaces, audit log, rollback) are preserved.
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
    initSentry();
    try {
      return await handler(...args);
    } catch (err) {
      if (initialized) {
        try {
          Sentry.captureException(err);
          await Sentry.flush(2000);
        } catch {
          // Swallow capture failures so the original throw still propagates.
        }
      }
      throw err;
    }
  };
}

/**
 * Best-effort flush of the Sentry buffer. Convex isolates are short-lived, so
 * capture-and-return paths (audit-log-then-return, catch-and-swallow) can lose
 * events without an explicit flush. Never throws — flush failures must not
 * mask the caller's error path. No-op when Sentry was never initialized.
 */
export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!initialized) return;
  try {
    await Sentry.flush(timeoutMs);
  } catch {
    // Never throw — the caller's error semantics must not be affected.
  }
}

export { Sentry };
