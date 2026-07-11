import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useState, type ReactNode } from "react";
import { useQuery } from "convex/react";

import { balanceGradientStops } from "@avm-daily/ui/lib/gradients";
import { api } from "@avm-daily/backend/convex/_generated/api";
import { formatNaira } from "@avm-daily/application/client";

import { useAppTheme } from "@/contexts/app-theme-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/icon";
import { Pressable } from "react-native";

/**
 * Native BalanceHero — gradient card with available balance + eye toggle.
 * Uses `expo-linear-gradient` with palette-scoped stops from
 * `packages/ui/src/lib/gradients.ts`.
 *
 * Children render below the balance amount so `QuickActions` can compose
 * inside the same card, matching the web + design source pattern.
 */
export function BalanceHero({ children }: { children?: ReactNode }) {
  const { palette } = useAppTheme();
  const availableQ = useQuery(api.users.availableForWithdrawal, {});
  const [visible, setVisible] = useState(true);

  const grad = balanceGradientStops[palette];

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={
          grad.stops.map((s) => s.color) as unknown as readonly [
            string,
            string,
            ...string[],
          ]
        }
        locations={
          grad.stops.map((s) => s.offset) as unknown as readonly [
            number,
            number,
            ...number[],
          ]
        }
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={styles.card}
      >
        <View style={[styles.decoCircleLg]} />
        <View style={[styles.decoCircleSm]} />

        <View style={styles.header}>
          <Text style={styles.label}>Available Balance</Text>
          <Pressable
            onPress={() => setVisible((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={visible ? "Hide balance" : "Show balance"}
            hitSlop={10}
          >
            <Icon
              name={visible ? "eye" : "eye-off"}
              size={18}
              color="rgba(255,255,255,0.6)"
            />
          </Pressable>
        </View>

        <View style={styles.amountRow}>
          {availableQ === undefined ? (
            <Skeleton width={180} height={36} radius={6} />
          ) : (
            <Text style={styles.amount}>
              {visible ? formatNaira(availableQ.availableKobo) : "₦ ••••••"}
            </Text>
          )}
        </View>

        {children != null && <View style={styles.childrenSlot}>{children}</View>}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 22,
    overflow: "hidden",
  },
  card: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    position: "relative",
  },
  decoCircleLg: {
    position: "absolute",
    top: -48,
    right: -48,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  decoCircleSm: {
    position: "absolute",
    bottom: -28,
    right: 64,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  label: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  amountRow: {
    marginBottom: 24,
  },
  amount: {
    color: "#fff",
    fontFamily: "NotoSans_700Bold",
    fontSize: 32,
    letterSpacing: -0.8,
  },
  childrenSlot: {
    marginTop: 4,
  },
});
