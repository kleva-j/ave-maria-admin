import { forwardRef } from "react";
import {
  StyleSheet,
  Pressable,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { useThemeTokens } from "@/contexts/app-theme-context";

/**
 * Native Button primitive — palette-aware, mirrors the web variant API from
 * `packages/ui/src/components/button.tsx`. No hover-lift (RN has no hover).
 * Press feedback comes from Pressable's `pressed` state (bg brightens).
 */

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "md" | "hero" | "sm";

export interface ButtonProps
  extends Omit<PressableProps, "children" | "style"> {
  variant?: Variant;
  size?: Size;
  label?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  children?: React.ReactNode;
}

export const Button = forwardRef<View, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    label,
    leftIcon,
    rightIcon,
    fullWidth,
    disabled,
    style,
    labelStyle,
    children,
    ...pressableProps
  },
  ref,
) {
  const tokens = useThemeTokens();

  const sizeStyle = SIZE_STYLES[size];

  return (
    <Pressable
      ref={ref}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.base,
        sizeStyle.container,
        fullWidth && styles.fullWidth,
        variantContainerStyle(variant, tokens, pressed),
        disabled && styles.disabled,
        style,
      ]}
      {...pressableProps}
    >
      {leftIcon}
      {label != null && (
        <Text
          style={[
            sizeStyle.label,
            { color: variantTextColor(variant, tokens) },
            labelStyle,
          ]}
        >
          {label}
        </Text>
      )}
      {children}
      {rightIcon}
    </Pressable>
  );
});

function variantContainerStyle(
  variant: Variant,
  tokens: ReturnType<typeof useThemeTokens>,
  pressed: boolean,
): ViewStyle {
  const dim = pressed ? 0.85 : 1;
  switch (variant) {
    case "primary":
      return { backgroundColor: withAlpha(tokens.primary, dim) };
    case "secondary":
      return {
        backgroundColor: tokens.secondary,
        borderWidth: 1,
        borderColor: pressed ? tokens.primary : tokens.border,
      };
    case "ghost":
      return { backgroundColor: pressed ? tokens.primaryDim : "transparent" };
    case "destructive":
      return { backgroundColor: withAlpha(tokens.destructive, dim) };
  }
}

function variantTextColor(
  variant: Variant,
  tokens: ReturnType<typeof useThemeTokens>,
): string {
  switch (variant) {
    case "primary":
    case "destructive":
      return "#ffffff";
    case "secondary":
      return tokens.foreground;
    case "ghost":
      return tokens.primary;
  }
}

/**
 * Apply an alpha multiplier onto a hex color for the pressed state without
 * dragging in a color library. Only touches hex values; passes rgba() through.
 */
function withAlpha(color: string, factor: number): string {
  if (factor >= 1) return color;
  if (!color.startsWith("#") || (color.length !== 7 && color.length !== 9)) {
    return color;
  }
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)}, 1)`;
}

const SIZE_STYLES: Record<Size, { container: ViewStyle; label: TextStyle }> = {
  md: {
    container: { height: 44, paddingHorizontal: 24, borderRadius: 14 },
    label: { fontSize: 15, fontWeight: "600" },
  },
  hero: {
    container: { height: 56, paddingHorizontal: 24, borderRadius: 14 },
    label: { fontSize: 15, fontWeight: "600" },
  },
  sm: {
    container: { height: 36, paddingHorizontal: 16, borderRadius: 10 },
    label: { fontSize: 13, fontWeight: "600" },
  },
};

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  fullWidth: { width: "100%" },
  disabled: { opacity: 0.45 },
});
