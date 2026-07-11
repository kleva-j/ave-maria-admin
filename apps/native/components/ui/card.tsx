import { View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";

import { useThemeTokens } from "@/contexts/app-theme-context";

export interface CardProps extends ViewProps {
  padding?: number;
  radius?: number;
  bordered?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * Native Card primitive — rounded, palette-aware container. Uses
 * `useThemeTokens` so colours track the active palette (midnight / indigo
 * / daylight). Matches the design's card styling in `avm-components.jsx`.
 */
export function Card({
  padding = 20,
  radius = 18,
  bordered = true,
  style,
  children,
  ...props
}: CardProps) {
  const tokens = useThemeTokens();
  return (
    <View
      style={[
        {
          backgroundColor: tokens.card,
          borderRadius: radius,
          padding,
          borderWidth: bordered ? 1 : 0,
          borderColor: tokens.border,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
