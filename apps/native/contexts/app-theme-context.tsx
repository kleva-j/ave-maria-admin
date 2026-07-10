import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Uniwind } from "uniwind";

import { DEFAULT_THEME, THEMES, type ThemeName, type ThemeTokens } from "@avm-daily/ui/lib/themes";

/**
 * AVM Daily has three palettes per DESIGN.md:
 *  - midnight (dark navy, default)
 *  - indigo   (dark purple)
 *  - daylight (light blue)
 *
 * Uniwind still tracks light/dark for its own base tokens (layout, spacing);
 * we mirror light/dark from the selected palette so utility classes that
 * read theme-scoped tokens continue to resolve.
 *
 * Palette-scoped colors are exposed on `tokens` — RN components read from
 * `useAppTheme().tokens.primary` rather than classNames for palette-varying
 * colors, mirroring the design source's `t.primary` pattern.
 */

type AppThemeContextType = {
  palette: ThemeName;
  tokens: ThemeTokens;
  isDark: boolean;
  isLight: boolean;
  setPalette: (palette: ThemeName) => void;
  cyclePalette: () => void;
  toggleTheme: () => void;
};

const AppThemeContext = createContext<AppThemeContextType | undefined>(undefined);

const PALETTE_CYCLE: ThemeName[] = ["midnight", "indigo", "daylight"];

export const AppThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [palette, setPaletteState] = useState<ThemeName>(DEFAULT_THEME);
  const tokens = THEMES[palette];

  useEffect(() => {
    Uniwind.setTheme(tokens.dark ? "dark" : "light");
  }, [tokens.dark]);

  const setPalette = useCallback((next: ThemeName) => {
    setPaletteState(next);
  }, []);

  const cyclePalette = useCallback(() => {
    setPaletteState((prev) => {
      const idx = PALETTE_CYCLE.indexOf(prev);
      return PALETTE_CYCLE[(idx + 1) % PALETTE_CYCLE.length]!;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setPaletteState((prev) => (THEMES[prev].dark ? "daylight" : "midnight"));
  }, []);

  const value = useMemo<AppThemeContextType>(
    () => ({
      palette,
      tokens,
      isDark: tokens.dark,
      isLight: !tokens.dark,
      setPalette,
      cyclePalette,
      toggleTheme,
    }),
    [palette, tokens, setPalette, cyclePalette, toggleTheme],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
};

export function useAppTheme() {
  const context = useContext(AppThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }
  return context;
}

/** Convenience — get the active theme's tokens without wrapping in context. */
export function useThemeTokens(): ThemeTokens {
  return useAppTheme().tokens;
}
