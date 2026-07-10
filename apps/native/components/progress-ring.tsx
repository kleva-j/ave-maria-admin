import type { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { useThemeTokens } from "@/contexts/app-theme-context";

/**
 * Native mirror of `packages/ui/src/components/progress-ring.tsx`.
 * Uses `react-native-svg` (already a native dep) for the arc render.
 * Prop shape stays identical.
 */

export interface ProgressRingProps {
  percent: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
  ariaLabel?: string;
}

export function ProgressRing({
  percent,
  size = 72,
  stroke = 6,
  color,
  track,
  children,
  ariaLabel,
}: ProgressRingProps) {
  const tokens = useThemeTokens();
  const resolvedColor = color ?? tokens.primary;
  const resolvedTrack = track ?? (tokens.dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)");
  const safe = Number.isFinite(percent) ? percent : 0;
  const clamped = Math.max(0, Math.min(100, safe));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - clamped / 100);

  return (
    <View
      style={{ width: size, height: size, position: "relative" }}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
      accessibilityLabel={ariaLabel}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={resolvedTrack}
          strokeWidth={stroke}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={resolvedColor}
          strokeWidth={stroke}
          strokeDasharray={`${circ}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children != null && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {children}
        </View>
      )}
    </View>
  );
}
