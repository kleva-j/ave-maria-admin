import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// sentry.ts posts events directly via fetch (no @sentry SDK — see the
// header comment in sentry.ts for the runtime-compat rationale). Tests mock
// the global fetch so we can assert send-and-flush behavior without hitting
// the network.
const VALID_DSN = "https://public_key@o0.ingest.sentry.io/1234567";

describe("packages/backend/convex/sentry", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("captureCriticalError", () => {
    it("never throws even when fetch throws", async () => {
      vi.stubEnv("SENTRY_DSN", VALID_DSN);
      fetchMock.mockImplementation(() => {
        throw new Error("network boom");
      });

      const { captureCriticalError, flushSentry } = await import("../sentry");

      // Must not propagate the fetch failure — capture is best-effort.
      expect(() =>
        captureCriticalError(new Error("original"), { where: "test" }),
      ).not.toThrow();
      await flushSentry(50);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("withSentry", () => {
    it("captures + flushes before re-throwing when the handler throws", async () => {
      vi.stubEnv("SENTRY_DSN", VALID_DSN);

      // Reset module state so pendingSends buffer is fresh.
      vi.resetModules();
      const { withSentry } = await import("../sentry");

      const wrapped = withSentry(async () => {
        throw new Error("handler failed");
      });

      await expect(wrapped()).rejects.toThrow("handler failed");

      // fetch must be called (event sent) before the handler's throw
      // re-propagates, so the event isn't lost when the isolate recycles.
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // POST'd to the DSN's envelope endpoint with a Sentry auth header.
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe("https://o0.ingest.sentry.io/api/1234567/envelope/");
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers["X-Sentry-Auth"]).toContain("sentry_key=public_key");
      expect(headers["Content-Type"]).toBe("application/x-sentry-envelope");
    });
  });

  describe("no-op when SENTRY_DSN unset", () => {
    it("does not call fetch on either helper", async () => {
      vi.stubEnv("SENTRY_DSN", "");
      vi.resetModules();

      const { captureCriticalError, withSentry, flushSentry } = await import(
        "../sentry"
      );

      // Direct capture: silent.
      expect(() => captureCriticalError(new Error("x"))).not.toThrow();

      // withSentry on a passing handler: returns normally, no fetch.
      const wrappedOk = withSentry(async () => 42);
      await expect(wrappedOk()).resolves.toBe(42);

      // withSentry on a throwing handler: re-throws without touching fetch.
      const wrappedErr = withSentry(async () => {
        throw new Error("y");
      });
      await expect(wrappedErr()).rejects.toThrow("y");

      await flushSentry(10);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
