import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { useThemeTokens } from "@/contexts/app-theme-context";

type Variant = "default" | "success" | "warning" | "destructive" | "muted";

export interface BadgeProps {
  variant?: Variant;
  label: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Native Badge primitive — palette-aware. Mirrors the five design variants
 * from `packages/ui/src/components/badge.tsx`.
 */
export function Badge({ variant = "default", label, style }: BadgeProps) {
  const tokens = useThemeTokens();
  const palette = paletteFor(variant, tokens);
  return (
    <View
      style={[styles.container, { backgroundColor: palette.bg }, style]}
      accessibilityLabel={label}
    >
      <Text
        style={[styles.label, { color: palette.fg }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function paletteFor(
  variant: Variant,
  tokens: ReturnType<typeof useThemeTokens>,
): { bg: string; fg: string } {
  switch (variant) {
    case "success":
      return { bg: tokens.successDim, fg: tokens.success };
    case "warning":
      return { bg: tokens.warningDim, fg: tokens.warning };
    case "destructive":
      return { bg: tokens.destructiveDim, fg: tokens.destructive };
    case "muted":
      return { bg: tokens.muted, fg: tokens.mutedForeground };
    default:
      return { bg: tokens.primaryDim, fg: tokens.primary };
  }
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 9999,
    alignSelf: "flex-start",
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
});
