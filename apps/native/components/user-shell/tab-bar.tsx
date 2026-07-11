import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@/contexts/app-theme-context";
import { Icon, type IconName } from "@/components/icon";

/**
 * The `expo-router` `<Tabs>` `tabBar` prop supplies the bottom-tabs props
 * from `@react-navigation/bottom-tabs`. We only touch a small slice of them,
 * so we mirror that slice locally instead of adding the dep.
 */
type TabBarProps = {
  state: {
    index: number;
    routes: Array<{ key: string; name: string; params?: object }>;
  };
  descriptors: Record<
    string,
    { options: { tabBarButtonTestID?: string; title?: string } }
  >;
  navigation: {
    emit: (event: {
      type: "tabPress";
      target: string;
      canPreventDefault?: boolean;
    }) => { defaultPrevented: boolean };
    navigate: (name: string, params?: object) => void;
  };
};

/**
 * Custom bottom tab bar for the `(dashboard)/(tabs)` group. Matches the
 * design's mobile nav: 68px tall, elevated `+` center pill (bigger than
 * side items), palette-aware active glow.
 *
 * The tab order is fixed by the route file layout — this component only
 * decorates. Rendering the plus button larger just means recognising its
 * route name in the map.
 */

const ROUTE_ICONS: Record<string, IconName> = {
  index: "home",
  plans: "target",
  plus: "plus",
  transactions: "clock",
  settings: "user",
};

const ROUTE_LABELS: Record<string, string> = {
  index: "Dashboard",
  plans: "Plans",
  plus: "",
  transactions: "Transactions",
  settings: "Settings",
};

export function AppTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { tokens } = useAppTheme();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: tokens.navBg,
          borderTopColor: tokens.border,
          paddingBottom: Math.max(insets.bottom, 8),
          height: 68 + Math.max(insets.bottom, 8),
        },
      ]}
      accessibilityRole="tablist"
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const isPlus = route.name === "plus";
        const iconName = ROUTE_ICONS[route.name] ?? "home";
        const label = ROUTE_LABELS[route.name] ?? route.name;

        const descriptor = descriptors[route.key];
        const listener = () => {
          if (isPlus) {
            // Center CTA — in N01 the target screen shows an eligibility
            // toast + placeholder. Full sheet ships in PR N04.
            descriptor?.options.tabBarButtonTestID; // no-op reference to keep types happy
          }
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        if (isPlus) {
          return (
            <Pressable
              key={route.key}
              onPress={listener}
              accessibilityRole="button"
              accessibilityLabel="Quick actions"
              style={styles.plusWrap}
            >
              <View
                style={[
                  styles.plusPill,
                  {
                    backgroundColor: tokens.primary,
                    shadowColor: tokens.primary,
                  },
                ]}
              >
                <Icon name={iconName} size={22} color="#fff" strokeWidth={2.5} />
              </View>
            </Pressable>
          );
        }

        return (
          <Pressable
            key={route.key}
            onPress={listener}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            style={styles.tab}
          >
            <Icon
              name={iconName}
              size={20}
              color={focused ? tokens.primary : tokens.mutedForeground}
              strokeWidth={focused ? 2 : 1.75}
            />
            <Text
              style={[
                styles.tabLabel,
                {
                  color: focused ? tokens.primary : tokens.mutedForeground,
                  fontWeight: focused ? "700" : "500",
                },
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-around",
    borderTopWidth: 1,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 3,
    minHeight: 52,
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.3,
  },
  plusWrap: {
    width: 68,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -18,
  },
  plusPill: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
});
