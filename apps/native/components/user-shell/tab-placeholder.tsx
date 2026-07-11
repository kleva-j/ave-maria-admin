import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@/contexts/app-theme-context";
import { Icon, type IconName } from "@/components/icon";

/**
 * Shared empty-state placeholder used by the non-Dashboard tabs in PR N01.
 * Each downstream PR (N02–N06) replaces its tab file's body with real
 * content; the placeholder disappears organically.
 */
export function TabPlaceholder({
  title,
  copy,
  pr,
  icon,
}: {
  title: string;
  copy: string;
  pr: string;
  icon: IconName;
}) {
  const { tokens } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: tokens.background, paddingTop: insets.top + 24 },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: tokens.primaryDim }]}>
        <Icon name={icon} size={28} color={tokens.primary} />
      </View>
      <Text style={[styles.title, { color: tokens.foreground }]}>{title}</Text>
      <Text style={[styles.copy, { color: tokens.mutedForeground }]}>
        {copy}
      </Text>
      <View
        style={[
          styles.pill,
          {
            backgroundColor: tokens.card,
            borderColor: tokens.border,
          },
        ]}
      >
        <Text style={[styles.pillText, { color: tokens.subtle }]}>
          Arrives with {pr}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "NotoSans_700Bold",
    letterSpacing: -0.2,
  },
  copy: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  pill: {
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
