import { useRouter } from "expo-router";
import { Alert } from "react-native";
import { useEffect } from "react";

import { TabPlaceholder } from "@/components/user-shell/tab-placeholder";
import { useEligibility } from "@/lib/eligibility";

/**
 * Inert center tab in PR N01. Tapping the + pill triggers this screen; we
 * immediately show an eligibility-aware alert and bounce back to Dashboard
 * so it never feels like the user is stuck on a blank tab.
 *
 * The full Deposit / Withdraw / Transfer bottom sheet lands in PR N04.
 */
export default function PlusTab() {
  const router = useRouter();
  const eligibility = useEligibility();

  useEffect(() => {
    const message = eligibility.canTopUp
      ? "Deposit and withdrawal actions land in the next release."
      : eligibility.reason || "Complete signup to unlock quick actions.";
    Alert.alert("Quick actions", message, [
      { text: "OK", onPress: () => router.replace("/(dashboard)/(tabs)") },
    ]);
  }, [eligibility.canTopUp, eligibility.reason, router]);

  return (
    <TabPlaceholder
      title="Quick actions"
      copy="Deposit, withdraw, and transfer."
      pr="PR N04"
      icon="plus"
    />
  );
}
