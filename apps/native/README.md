# @avm-daily/native

Expo Router native app.

## Sentry source-map upload (EAS builds)

The `@sentry/react-native/expo` plugin is wired in `app.json` with two
deliberately safe defaults:

- `"organization": "YOUR_ORG_SLUG"` — a placeholder, not the real Sentry
  org. Do **not** run production EAS builds until this is replaced with the
  real org slug (either committed here or migrated to `app.config.ts` so it
  can be sourced from `SENTRY_ORG`).
- `"disableAutoUpload": true` — no source-map / dSYM upload is attempted
  during builds. This is the belt-and-braces guarantee that an accidental
  build with `SENTRY_AUTH_TOKEN` set won't push to the wrong Sentry
  project (or fail loudly with an invalid slug).

### Enabling upload

Do all three, in order:

1. Replace `"YOUR_ORG_SLUG"` in `app.json` with the real Sentry org slug
   (or move the whole plugin block into `app.config.ts` and source it from
   `SENTRY_ORG`).
2. Set `"disableAutoUpload": false` (or delete the key — `false` is the
   Sentry default).
3. Set `SENTRY_AUTH_TOKEN` in the EAS build environment (never commit it).

Runtime Sentry — DSN, tracing, replay — is unaffected by any of the above
and is controlled by `EXPO_PUBLIC_SENTRY_DSN` / `EXPO_PUBLIC_SENTRY_*`.
