export const DAY_MS = 24 * 60 * 60 * 1000;
export const VELOCITY_WINDOW_MS = 15 * 60 * 1000;
export const BANK_ACCOUNT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const WITHDRAWAL_DAILY_LIMIT_KOBO = 50_000_000n;
export const WITHDRAWAL_DAILY_COUNT_LIMIT = 3;
export const WITHDRAWAL_VELOCITY_COUNT_LIMIT = 2;

export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;
