import { memo } from "react";
import Svg, { Path, Circle, Rect, Line, Polyline, Polygon } from "react-native-svg";

import { useThemeTokens } from "@/contexts/app-theme-context";

/**
 * Native mirror of `packages/ui/src/components/icon.tsx`.
 *
 * The path strings there are DOM-only (`dangerouslySetInnerHTML`); RN needs
 * structured SVG children. So we re-declare each icon here as JSX. Keep the
 * two files in sync when adding icons.
 *
 * Source: `avm-components.jsx` `ICON_PATHS`. Do not swap for
 * `@expo/vector-icons` — several paths (`zap`, `layers`, `fingerprint`)
 * diverge from Lucide and the design is authoritative.
 */

export type IconName =
  | "home"
  | "target"
  | "plus"
  | "clock"
  | "user"
  | "bell"
  | "eye"
  | "eye-off"
  | "chevron-right"
  | "chevron-left"
  | "chevron-down"
  | "check"
  | "check-circle"
  | "shield"
  | "arrow-down"
  | "arrow-up"
  | "arrow-right"
  | "arrow-left"
  | "arrow-up-right"
  | "arrow-down-left"
  | "settings"
  | "log-out"
  | "lock"
  | "upload"
  | "sun"
  | "moon"
  | "x"
  | "search"
  | "credit-card"
  | "send"
  | "trending-up"
  | "help-circle"
  | "alert-circle"
  | "wallet"
  | "phone"
  | "file-text"
  | "camera"
  | "gift"
  | "building"
  | "fingerprint"
  | "layers"
  | "zap"
  | "bar-chart"
  | "more-horizontal"
  | "refresh-cw";

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  ariaLabel?: string;
}

type CommonProps = {
  stroke: string;
  strokeWidth: number;
  strokeLinecap: "round";
  strokeLinejoin: "round";
  fill: "none";
};

function IconInner({
  name,
  size = 20,
  color,
  strokeWidth = 1.5,
  ariaLabel,
}: IconProps) {
  const tokens = useThemeTokens();
  const resolved = color ?? tokens.foreground;
  const common: CommonProps = {
    stroke: resolved,
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    fill: "none",
  };
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessible={ariaLabel != null}
      accessibilityRole={ariaLabel != null ? "image" : undefined}
      accessibilityLabel={ariaLabel}
    >
      {renderIcon(name, common)}
    </Svg>
  );
}

export const Icon = memo(IconInner);

function renderIcon(name: IconName, s: CommonProps) {
  switch (name) {
    case "home":
      return (
        <>
          <Path {...s} d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <Path {...s} d="M9 22V12h6v10" />
        </>
      );
    case "target":
      return (
        <>
          <Circle {...s} cx={12} cy={12} r={10} />
          <Circle {...s} cx={12} cy={12} r={6} />
          <Circle {...s} cx={12} cy={12} r={2} />
        </>
      );
    case "plus":
      return <Path {...s} d="M12 5v14M5 12h14" />;
    case "clock":
      return (
        <>
          <Circle {...s} cx={12} cy={12} r={10} />
          <Polyline {...s} points="12 6 12 12 16 14" />
        </>
      );
    case "user":
      return (
        <>
          <Path {...s} d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <Circle {...s} cx={12} cy={7} r={4} />
        </>
      );
    case "bell":
      return (
        <>
          <Path {...s} d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <Path {...s} d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </>
      );
    case "eye":
      return (
        <>
          <Path {...s} d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <Circle {...s} cx={12} cy={12} r={3} />
        </>
      );
    case "eye-off":
      return (
        <>
          <Path {...s} d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
          <Path {...s} d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
          <Path {...s} d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
          <Line {...s} x1={2} x2={22} y1={2} y2={22} />
        </>
      );
    case "chevron-right":
      return <Path {...s} d="m9 18 6-6-6-6" />;
    case "chevron-left":
      return <Path {...s} d="m15 18-6-6 6-6" />;
    case "chevron-down":
      return <Path {...s} d="m6 9 6 6 6-6" />;
    case "check":
      return <Path {...s} d="M20 6 9 17l-5-5" />;
    case "check-circle":
      return (
        <>
          <Circle {...s} cx={12} cy={12} r={10} />
          <Path {...s} d="m9 12 2 2 4-4" />
        </>
      );
    case "shield":
      return <Path {...s} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />;
    case "arrow-down":
      return (
        <>
          <Path {...s} d="M12 5v14" />
          <Path {...s} d="m19 12-7 7-7-7" />
        </>
      );
    case "arrow-up":
      return (
        <>
          <Path {...s} d="M12 19V5" />
          <Path {...s} d="m5 12 7-7 7 7" />
        </>
      );
    case "arrow-right":
      return (
        <>
          <Path {...s} d="M5 12h14" />
          <Path {...s} d="m12 5 7 7-7 7" />
        </>
      );
    case "arrow-left":
      return (
        <>
          <Path {...s} d="M19 12H5" />
          <Path {...s} d="m12 19-7-7 7-7" />
        </>
      );
    case "arrow-up-right":
      return (
        <>
          <Path {...s} d="M7 7h10v10" />
          <Path {...s} d="M7 17 17 7" />
        </>
      );
    case "arrow-down-left":
      return (
        <>
          <Path {...s} d="M17 17H7V7" />
          <Path {...s} d="m17 7-10 10" />
        </>
      );
    case "settings":
      return (
        <>
          <Path
            {...s}
            d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
          />
          <Circle {...s} cx={12} cy={12} r={3} />
        </>
      );
    case "log-out":
      return (
        <>
          <Path {...s} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <Polyline {...s} points="16 17 21 12 16 7" />
          <Line {...s} x1={21} x2={9} y1={12} y2={12} />
        </>
      );
    case "lock":
      return (
        <>
          <Rect {...s} width={18} height={11} x={3} y={11} rx={2} ry={2} />
          <Path {...s} d="M7 11V7a5 5 0 0 1 10 0v4" />
        </>
      );
    case "upload":
      return (
        <>
          <Path {...s} d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <Polyline {...s} points="17 8 12 3 7 8" />
          <Line {...s} x1={12} x2={12} y1={3} y2={15} />
        </>
      );
    case "sun":
      return (
        <>
          <Circle {...s} cx={12} cy={12} r={4} />
          <Path
            {...s}
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
          />
        </>
      );
    case "moon":
      return <Path {...s} d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />;
    case "x":
      return <Path {...s} d="M18 6 6 18M6 6l12 12" />;
    case "search":
      return (
        <>
          <Circle {...s} cx={11} cy={11} r={8} />
          <Path {...s} d="m21 21-4.3-4.3" />
        </>
      );
    case "credit-card":
      return (
        <>
          <Rect {...s} width={20} height={14} x={2} y={5} rx={2} />
          <Line {...s} x1={2} x2={22} y1={10} y2={10} />
        </>
      );
    case "send":
      return (
        <>
          <Path {...s} d="m22 2-7 20-4-9-9-4Z" />
          <Path {...s} d="M22 2 11 13" />
        </>
      );
    case "trending-up":
      return (
        <>
          <Polyline {...s} points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <Polyline {...s} points="16 7 22 7 22 13" />
        </>
      );
    case "help-circle":
      return (
        <>
          <Circle {...s} cx={12} cy={12} r={10} />
          <Path {...s} d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <Line {...s} x1={12} x2={12.01} y1={17} y2={17} />
        </>
      );
    case "alert-circle":
      return (
        <>
          <Circle {...s} cx={12} cy={12} r={10} />
          <Line {...s} x1={12} x2={12} y1={8} y2={12} />
          <Line {...s} x1={12} x2={12.01} y1={16} y2={16} />
        </>
      );
    case "wallet":
      return (
        <>
          <Path {...s} d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
          <Path {...s} d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
          <Path {...s} d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
        </>
      );
    case "phone":
      return (
        <Path
          {...s}
          d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.92 13 19.79 19.79 0 0 1 1.87 4.38 2 2 0 0 1 3.84 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"
        />
      );
    case "file-text":
      return (
        <>
          <Path {...s} d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <Polyline {...s} points="14 2 14 8 20 8" />
          <Line {...s} x1={16} x2={8} y1={13} y2={13} />
          <Line {...s} x1={16} x2={8} y1={17} y2={17} />
        </>
      );
    case "camera":
      return (
        <>
          <Path {...s} d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
          <Circle {...s} cx={12} cy={13} r={3} />
        </>
      );
    case "gift":
      return (
        <>
          <Polyline {...s} points="20 12 20 22 4 22 4 12" />
          <Rect {...s} width={20} height={5} x={2} y={7} />
          <Line {...s} x1={12} x2={12} y1={22} y2={7} />
          <Path {...s} d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
          <Path {...s} d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
        </>
      );
    case "building":
      return (
        <>
          <Path {...s} d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
          <Path {...s} d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
          <Path {...s} d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
          <Path {...s} d="M10 6h4" />
          <Path {...s} d="M10 10h4" />
          <Path {...s} d="M10 14h4" />
          <Path {...s} d="M10 18h4" />
        </>
      );
    case "fingerprint":
      return (
        <>
          <Path {...s} d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
          <Path {...s} d="M14 13.12c0 2.38 0 6.38-1 8.88" />
          <Path {...s} d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
          <Path {...s} d="M2 12a10 10 0 0 1 18-6" />
          <Path {...s} d="M2 17c1 1.75 2.7 3.5 4.7 4.5" />
          <Path {...s} d="M9 10H5.6a8 8 0 0 0 .4 6" />
          <Path {...s} d="M9 14a15 15 0 0 0-.24 5" />
        </>
      );
    case "layers":
      return (
        <>
          <Path
            {...s}
            d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"
          />
          <Path {...s} d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
          <Path {...s} d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
        </>
      );
    case "zap":
      return <Polygon {...s} points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />;
    case "bar-chart":
      return (
        <>
          <Line {...s} x1={18} x2={18} y1={20} y2={10} />
          <Line {...s} x1={12} x2={12} y1={20} y2={4} />
          <Line {...s} x1={6} x2={6} y1={20} y2={14} />
        </>
      );
    case "more-horizontal":
      return (
        <>
          <Circle {...s} cx={12} cy={12} r={1} />
          <Circle {...s} cx={19} cy={12} r={1} />
          <Circle {...s} cx={5} cy={12} r={1} />
        </>
      );
    case "refresh-cw":
      return (
        <>
          <Path {...s} d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <Path {...s} d="M21 3v5h-5" />
          <Path {...s} d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <Path {...s} d="M8 16H3v5" />
        </>
      );
    default: {
      const _exhaustive: never = name;
      return null;
    }
  }
}
