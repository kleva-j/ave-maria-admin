import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { Ratelimit } from "@upstash/ratelimit";
import { env } from "@avm-daily/env/server";
import { Redis } from "@upstash/redis";

const rateLimitMax = env.AUTH_RATE_LIMIT_MAX ?? 5;
const rateLimitWindowSeconds = env.AUTH_RATE_LIMIT_WINDOW_SECONDS ?? 60;

const redis =
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(
        rateLimitMax,
        `${rateLimitWindowSeconds} s`
      ),
    })
  : null;

export function assertSameOrigin() {
  const origin = getRequestHeader("origin");
  const host = getRequestHeader("x-forwarded-host") ?? getRequestHeader("host");
  const proto = getRequestHeader("x-forwarded-proto") ?? "http";

  if (!origin || !host) return;

  const expectedOrigin = `${proto}://${host}`;
  if (origin !== expectedOrigin) {
    throw new Response("Forbidden", { status: 403 });
  }
}

export function getClientIp() {
  return getRequestIP() ?? undefined;
}

export async function enforceRateLimit(key: string) {
  if (!ratelimit) return;

  const result = await ratelimit.limit(key);
  if (result.success) return;

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((result.reset - Date.now()) / 1000)
  );

  throw new Response("Too Many Requests", {
    status: 429,
    headers: { "Retry-After": retryAfterSeconds.toString() },
  });
}
