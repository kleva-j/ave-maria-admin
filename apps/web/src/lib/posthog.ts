import posthog from "posthog-js";
import { env } from "@avm-daily/env/web";

let initialized = false;

export function initPostHog() {
  if (typeof window === "undefined" || initialized) return;
  if (!env.VITE_POSTHOG_KEY) return;

  try {
    posthog.init(env.VITE_POSTHOG_KEY, {
      api_host: env.VITE_POSTHOG_HOST,
      person_profiles: "identified_only",
      capture_pageview: false,
      capture_pageleave: true,
      loaded: (ph) => {
        if (import.meta.env.DEV) ph.opt_out_capturing();
      },
    });
    initialized = true;
  } catch (e) {
    console.error("[posthog] init failed", e);
  }
}

export { posthog };
