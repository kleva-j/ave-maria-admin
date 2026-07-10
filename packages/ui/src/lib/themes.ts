/**
 * AVM Daily theme registry — palette subset intended for JS/native
 * consumers (React Native, Skia, chart libs). This is deliberately smaller
 * than the full CSS custom-property set in `styles/globals.css`: sidebar,
 * radius, and other DOM-only tokens are read directly via `var(--token)`
 * from components and are not mirrored here.
 *
 * Source of truth for the full token map: packages/ui/DESIGN.md.
 */

export type ThemeName = "midnight" | "indigo" | "daylight";

export interface ThemeTokens {
  name: ThemeName;
  dark: boolean;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  primaryDim: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  subtle: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  destructiveDim: string;
  success: string;
  successForeground: string;
  successDim: string;
  warning: string;
  warningForeground: string;
  warningDim: string;
  border: string;
  input: string;
  ring: string;
  navBg: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  gradientBalance: string;
}

const MIDNIGHT: ThemeTokens = {
  name: "midnight",
  dark: true,
  background: "#060c1c",
  foreground: "#e8f0ff",
  card: "#0c1930",
  cardForeground: "#e8f0ff",
  popover: "#0c1930",
  popoverForeground: "#e8f0ff",
  primary: "#3b7fff",
  primaryForeground: "#ffffff",
  primaryDim: "rgba(59, 127, 255, 0.14)",
  secondary: "#0f1e3a",
  secondaryForeground: "#e8f0ff",
  muted: "#0f1e3a",
  mutedForeground: "rgba(232, 240, 255, 0.52)",
  subtle: "rgba(232, 240, 255, 0.26)",
  accent: "#00c6a9",
  accentForeground: "#060c1c",
  destructive: "#ff5c5c",
  destructiveForeground: "#ffffff",
  destructiveDim: "rgba(255, 92, 92, 0.14)",
  success: "#10d98e",
  successForeground: "#060c1c",
  successDim: "rgba(16, 217, 142, 0.14)",
  warning: "#ffb340",
  warningForeground: "#060c1c",
  warningDim: "rgba(255, 179, 64, 0.14)",
  border: "rgba(255, 255, 255, 0.07)",
  input: "rgba(255, 255, 255, 0.05)",
  ring: "#3b7fff",
  navBg: "#080e20",
  chart1: "#3b7fff",
  chart2: "#10d98e",
  chart3: "#ffb340",
  chart4: "#00c6a9",
  chart5: "#ff5c5c",
  gradientBalance:
    "linear-gradient(140deg, #0a1f60 0%, #1535a8 50%, #091850 100%)",
};

const INDIGO: ThemeTokens = {
  name: "indigo",
  dark: true,
  background: "#08091a",
  foreground: "#f0f0ff",
  card: "#0f1030",
  cardForeground: "#f0f0ff",
  popover: "#0f1030",
  popoverForeground: "#f0f0ff",
  primary: "#7c5cfc",
  primaryForeground: "#ffffff",
  primaryDim: "rgba(124, 92, 252, 0.14)",
  secondary: "#151640",
  secondaryForeground: "#f0f0ff",
  muted: "#151640",
  mutedForeground: "rgba(240, 240, 255, 0.52)",
  subtle: "rgba(240, 240, 255, 0.26)",
  accent: "#38bdf8",
  accentForeground: "#08091a",
  destructive: "#f87171",
  destructiveForeground: "#ffffff",
  destructiveDim: "rgba(248, 113, 113, 0.14)",
  success: "#34d399",
  successForeground: "#08091a",
  successDim: "rgba(52, 211, 153, 0.14)",
  warning: "#fbbf24",
  warningForeground: "#08091a",
  warningDim: "rgba(251, 191, 36, 0.14)",
  border: "rgba(255, 255, 255, 0.07)",
  input: "rgba(255, 255, 255, 0.05)",
  ring: "#7c5cfc",
  navBg: "#060714",
  chart1: "#7c5cfc",
  chart2: "#34d399",
  chart3: "#fbbf24",
  chart4: "#38bdf8",
  chart5: "#f87171",
  gradientBalance:
    "linear-gradient(140deg, #1a0a4e 0%, #2d1080 50%, #14073c 100%)",
};

const DAYLIGHT: ThemeTokens = {
  name: "daylight",
  dark: false,
  background: "#f0f4ff",
  foreground: "#0a1628",
  card: "#ffffff",
  cardForeground: "#0a1628",
  popover: "#ffffff",
  popoverForeground: "#0a1628",
  primary: "#2563eb",
  primaryForeground: "#ffffff",
  primaryDim: "rgba(37, 99, 235, 0.10)",
  secondary: "#e4eaff",
  secondaryForeground: "#0a1628",
  muted: "#e4eaff",
  mutedForeground: "rgba(10, 22, 40, 0.52)",
  subtle: "rgba(10, 22, 40, 0.30)",
  accent: "#0891b2",
  accentForeground: "#ffffff",
  destructive: "#dc2626",
  destructiveForeground: "#ffffff",
  destructiveDim: "rgba(220, 38, 38, 0.10)",
  success: "#059669",
  successForeground: "#ffffff",
  successDim: "rgba(5, 150, 105, 0.10)",
  warning: "#d97706",
  warningForeground: "#ffffff",
  warningDim: "rgba(217, 119, 6, 0.10)",
  border: "rgba(10, 30, 80, 0.10)",
  input: "rgba(10, 30, 80, 0.04)",
  ring: "#2563eb",
  navBg: "#ffffff",
  chart1: "#2563eb",
  chart2: "#059669",
  chart3: "#d97706",
  chart4: "#0891b2",
  chart5: "#dc2626",
  gradientBalance:
    "linear-gradient(140deg, #1e3a8a 0%, #2563eb 50%, #1e40af 100%)",
};

export const THEMES: Record<ThemeName, ThemeTokens> = {
  midnight: MIDNIGHT,
  indigo: INDIGO,
  daylight: DAYLIGHT,
};

export const DEFAULT_THEME: ThemeName = "midnight";
