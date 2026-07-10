/**
 * Gradient utilities — thin wrappers around the CSS custom properties defined
 * in `styles/globals.css`. Prefer these over hardcoding `linear-gradient(...)`
 * inline so theme switches (midnight / indigo / daylight) recolor correctly.
 */

/** Balance card hero gradient (used on Dashboard, Goals summary, Settings profile hero). */
export const balanceGradient = "var(--gradient-balance)";

/**
 * Utility for consumers that need a native (non-CSS) gradient definition,
 * e.g. React Native LinearGradient. Returns the raw hex stops per theme.
 * For DOM usage, prefer `balanceGradient` above.
 */
export const balanceGradientStops = {
  midnight: {
    angle: 140,
    stops: [
      { color: "#0a1f60", offset: 0 },
      { color: "#1535a8", offset: 0.5 },
      { color: "#091850", offset: 1 },
    ],
  },
  indigo: {
    angle: 140,
    stops: [
      { color: "#1a0a4e", offset: 0 },
      { color: "#2d1080", offset: 0.5 },
      { color: "#14073c", offset: 1 },
    ],
  },
  daylight: {
    angle: 140,
    stops: [
      { color: "#1e3a8a", offset: 0 },
      { color: "#2563eb", offset: 0.5 },
      { color: "#1e40af", offset: 1 },
    ],
  },
} as const;
