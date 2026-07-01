import "@/global.css";
import { env } from "@avm-daily/env/native";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Stack } from "expo-router";
import { HeroUINativeProvider } from "heroui-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { NavigationTracker } from "@/contexts/navigation-tracker";
import { AppThemeProvider } from "@/contexts/app-theme-context";
import { PostHogProvider } from "@/contexts/posthog-context";
import { NovuInboxProvider } from "@/components/novu-provider";

export const unstable_settings = {
  initialRouteName: "(drawer)",
};

const convex = new ConvexReactClient(env.EXPO_PUBLIC_CONVEX_URL, {
  unsavedChangesWarning: false,
});

function StackLayout() {
  return (
    <>
      <NavigationTracker />
      <Stack screenOptions={{}}>
        <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ title: "Modal", presentation: "modal" }} />
      </Stack>
    </>
  );
}

export default function Layout() {
  return (
    <PostHogProvider>
    <ConvexProvider client={convex}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <AppThemeProvider>
            <HeroUINativeProvider>
              <NovuInboxProvider>
                <StackLayout />
              </NovuInboxProvider>
            </HeroUINativeProvider>
          </AppThemeProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </ConvexProvider>
    </PostHogProvider>
  );
}
