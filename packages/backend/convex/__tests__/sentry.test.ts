import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Sentry SDK mock — vi.hoisted so it's constructed before the vi.mock factory
// evaluates. All three exports are the ones sentry.ts touches; per-test we can
// reconfigure their behavior (e.g., make captureException throw) via .mock*.
const { initMock, captureExceptionMock, flushMock } = vi.hoisted(() => ({
  initMock: vi.fn(),
  captureExceptionMock: vi.fn(),
  flushMock: vi.fn().mockResolvedValue(true),
}));

vi.mock("@sentry/node", () => ({
  init: initMock,
  captureException: captureExceptionMock,
  flush: flushMock,
}));

// The module holds `initAttempted` + `initialized` flags at module scope, so
// each test needs a fresh copy. resetModules() + dynamic import gives us that.
async function loadSentryFresh() {
  vi.resetModules();
  return await import("../sentry");
}

describe("packages/backend/convex/sentry", () => {
  beforeEach(() => {
    initMock.mockReset();
    captureExceptionMock.mockReset();
    flushMock.mockReset().mockResolvedValue(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("captureCriticalError", () => {
    it("never throws even when the SDK throws", async () => {
      vi.stubEnv("SENTRY_DSN", "https://public@sentry.example/1");
      captureExceptionMock.mockImplementation(() => {
        throw new Error("sdk boom");
      });

      const { captureCriticalError } = await loadSentryFresh();

      // Must not propagate the SDK's throw — capture failures must not mask
      // the original error path in the caller.
      expect(() => captureCriticalError(new Error("original"))).not.toThrow();
      expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("withSentry", () => {
    it("flushes with a 2s timeout before re-throwing when the handler throws", async () => {
      vi.stubEnv("SENTRY_DSN", "https://public@sentry.example/1");

      const { withSentry } = await loadSentryFresh();

      const wrapped = withSentry(async () => {
        throw new Error("handler failed");
      });

      await expect(wrapped()).rejects.toThrow("handler failed");

      // Capture the error and flush before the re-throw so events aren't
      // lost when the Convex isolate is recycled after the throw propagates.
      expect(captureExceptionMock).toHaveBeenCalledTimes(1);
      expect(flushMock).toHaveBeenCalledWith(2000);

      // Ordering: capture must be called before flush so the event is in the
      // buffer at flush time.
      const captureOrder = captureExceptionMock.mock.invocationCallOrder[0]!;
      const flushOrder = flushMock.mock.invocationCallOrder[0]!;
      expect(captureOrder).toBeLessThan(flushOrder);
    });
  });

  describe("no-op when SENTRY_DSN unset", () => {
    it("does not init, capture, or throw on either helper", async () => {
      vi.stubEnv("SENTRY_DSN", "");

      const { captureCriticalError, withSentry } = await loadSentryFresh();

      // captureCriticalError: called → should not init or capture.
      expect(() => captureCriticalError(new Error("x"))).not.toThrow();

      // withSentry: wrapped success returns normally; wrapped throw re-throws
      // without touching the SDK.
      const wrappedOk = withSentry(async () => 42);
      await expect(wrappedOk()).resolves.toBe(42);

      const wrappedErr = withSentry(async () => {
        throw new Error("y");
      });
      await expect(wrappedErr()).rejects.toThrow("y");

      expect(initMock).not.toHaveBeenCalled();
      expect(captureExceptionMock).not.toHaveBeenCalled();
      expect(flushMock).not.toHaveBeenCalled();
    });
  });
});
