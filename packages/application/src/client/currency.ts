/**
 * Naira / kobo formatting for user-facing surfaces.
 *
 * Backend stores every amount as `int64` (BigInt) kobo. Client hooks receive
 * a `bigint`; some layers still surface `number` in derived aggregates. Both
 * are accepted here so callers never worry about the crossing.
 *
 * Rule from DESIGN.md: never inline `₦` + `toLocaleString` — always route
 * through `formatNaira` so a future currency/locale shift is a one-file
 * change.
 */

type Amount = bigint | number;

const NAIRA_INTL_FORMATTER = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NAIRA_INTL_FORMATTER_COMPACT = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** ₦1,234.56 style. Accepts kobo (bigint or number). */
export function formatNaira(kobo: Amount): string {
  return NAIRA_INTL_FORMATTER.format(koboToNaira(kobo));
}

/** ₦1.2M / ₦45k style. Accepts kobo. */
export function formatNairaCompact(kobo: Amount): string {
  return NAIRA_INTL_FORMATTER_COMPACT.format(koboToNaira(kobo));
}

/**
 * Convert kobo → naira as a plain `number`. Precise up to 2^53 kobo (i.e.
 * ~₦90,071,992,547,409 = ~₦9e13 naira). Any single account holding more
 * than that isn't happening in this decade — but callers who care about
 * lossless BigInt arithmetic should stay in kobo.
 */
export function koboToNaira(kobo: Amount): number {
  if (typeof kobo === "bigint") {
    return Number(kobo) / 100;
  }
  return kobo / 100;
}

/** Convert naira `number` → kobo `bigint`. Rounds to nearest kobo. */
export function nairaToKobo(naira: number): bigint {
  return BigInt(Math.round(naira * 100));
}
