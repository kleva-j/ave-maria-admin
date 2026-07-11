import { Tabs } from "expo-router";

import { AppTabBar } from "@/components/user-shell/tab-bar";

/**
 * Bottom-tabs layout for the user surface. Tab order (fixed by file name
 * order) matches the design's mobile IA: Dashboard / Plans / + / Transactions
 * / Settings. The center `+` route is intentionally inert in N01 — real
 * Deposit/Withdraw actions ship in PR N04.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => (
        <AppTabBar {...(props as unknown as Parameters<typeof AppTabBar>[0])} />
      )}
    >
      <Tabs.Screen name="index" options={{ title: "Dashboard" }} />
      <Tabs.Screen name="plans" options={{ title: "Plans" }} />
      <Tabs.Screen name="plus" options={{ title: "" }} />
      <Tabs.Screen name="transactions" options={{ title: "Transactions" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
