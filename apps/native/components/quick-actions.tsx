import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "@/components/icon";
import { useEligibility } from "@/lib/eligibility";

/**
 * Native QuickActions — 3-tile grid inside BalanceHero. Deposit / Withdraw /
 * Transfer. Ineligible taps show an Alert with the reason (matches web
 * toast pattern; RN doesn't have a native toast baseline).
 *
 * All actions surface the eligibility.reason today — real navigation lands
 * when withdrawals (PR N04) and deposit (PR N04) routes ship.
 */

type Action = {
  label: string;
  icon: IconName;
  enabled: boolean;
};

export function QuickActions() {
  const eligibility = useEligibility();

  const actions: readonly Action[] = [
    {
      label: "Deposit",
      icon: "arrow-down",
      enabled: eligibility.kycApproved,
    },
    {
      label: "Withdraw",
      icon: "arrow-up",
      enabled: eligibility.canWithdraw,
    },
    {
      label: "Transfer",
      icon: "send",
      enabled: eligibility.kycApproved,
    },
  ];

  const handlePress = (a: Action) => {
    const message = a.enabled
      ? `${a.label} arrives with the next release`
      : eligibility.reason || `${a.label} not available yet`;
    Alert.alert(a.label, message);
  };

  return (
    <View style={styles.grid}>
      {actions.map((a) => (
        <Pressable
          key={a.label}
          onPress={() => handlePress(a)}
          accessibilityRole="button"
          accessibilityLabel={a.label}
          accessibilityState={{ disabled: !a.enabled }}
          style={({ pressed }) => [
            styles.tile,
            pressed && styles.tilePressed,
            !a.enabled && styles.tileDisabled,
          ]}
        >
          <View style={styles.iconWrap}>
            <Icon name={a.icon} size={16} color="#fff" strokeWidth={2} />
          </View>
          <Text style={styles.label}>{a.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    gap: 10,
  },
  tile: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  tilePressed: {
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  tileDisabled: {
    opacity: 0.5,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
});
