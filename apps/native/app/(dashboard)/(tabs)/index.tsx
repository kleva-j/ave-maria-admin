import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "convex/react";

import { api } from "@avm-daily/backend/convex/_generated/api";

import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { useAppTheme } from "@/contexts/app-theme-context";
import { QuickActions } from "@/components/quick-actions";
import { BalanceHero } from "@/components/balance-hero";

/**
 * `/dashboard` — home tab. Mirrors the web dashboard's composition:
 *   greeting → balance hero (with quick actions inside) → onboarding
 *   checklist. Goals strip and recent transactions land in PRs N02 + N03.
 */
export default function DashboardHome() {
  const insets = useSafeAreaInsets();
  const { tokens } = useAppTheme();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <Greeting />
      <BalanceHero>
        <QuickActions />
      </BalanceHero>
      <OnboardingChecklist />
    </ScrollView>
  );
}

function Greeting() {
  const viewer = useQuery(api.users.viewer, {});
  const { tokens } = useAppTheme();
  const firstName = viewer?.first_name?.trim() || "there";

  return (
    <View style={styles.greeting}>
      <Text style={[styles.hi, { color: tokens.mutedForeground }]}>
        Good morning
      </Text>
      <Text style={[styles.name, { color: tokens.foreground }]}>
        {firstName}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  greeting: {
    paddingHorizontal: 20,
    paddingBottom: 4,
    paddingTop: 20,
  },
  hi: {
    fontSize: 13,
    marginBottom: 4,
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "NotoSans_700Bold",
    letterSpacing: -0.3,
  },
});
