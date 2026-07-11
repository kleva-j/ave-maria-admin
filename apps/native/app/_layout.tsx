import "@/global.css";

import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { HeroUINativeProvider } from "heroui-native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { View } from "react-native";
import {
  Inter_600SemiBold,
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  NotoSans_600SemiBold,
  NotoSans_400Regular,
  NotoSans_500Medium,
  NotoSans_700Bold,
} from "@expo-google-fonts/noto-sans";

import { env } from "@avm-daily/env/native";

import { NavigationTracker } from "@/contexts/navigation-tracker";
import { AppThemeProvider } from "@/contexts/app-theme-context";
import { useAuthForConvex } from "@/lib/auth/useAuthForConvex";
import { NovuInboxProvider } from "@/components/novu-provider";
import { PostHogProvider } from "@/contexts/posthog-context";
import { AuthKitProvider } from "@/lib/auth/AuthKitProvider";
import { Sentry, initSentry } from "@/lib/sentry";
import { AuthGate } from "@/lib/auth/AuthGate";

// Initialize at module top so Sentry registers before the first render
// frame. No-op when EXPO_PUBLIC_SENTRY_DSN is unset.
initSentry();

export const unstable_settings = { initialRouteName: "(drawer)" };

const convex = new ConvexReactClient(env.EXPO_PUBLIC_CONVEX_URL, {
  unsavedChangesWarning: false,
});

function StackLayout() {
  return (
    <>
      <NavigationTracker />
      <Stack screenOptions={{}}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(dashboard)" options={{ headerShown: false }} />
        <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{ title: "Modal", presentation: "modal" }}
        />
      </Stack>
    </>
  );
}

function FontsGate({ children }: { children: React.ReactNode }) {
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    NotoSans_400Regular,
    NotoSans_500Medium,
    NotoSans_600SemiBold,
    NotoSans_700Bold,
  });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: "#060c1c" }} />;
  return <>{children}</>;
}

function Layout() {
  return (
    <PostHogProvider>
      <AuthKitProvider>
        <ConvexProviderWithAuth client={convex} useAuth={useAuthForConvex}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AppThemeProvider>
                <HeroUINativeProvider>
                  <NovuInboxProvider>
                    <AuthGate>
                      <FontsGate>
                        <StackLayout />
                      </FontsGate>
                    </AuthGate>
                  </NovuInboxProvider>
                </HeroUINativeProvider>
              </AppThemeProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </ConvexProviderWithAuth>
      </AuthKitProvider>
    </PostHogProvider>
  );
}

// Sentry.wrap adds automatic touch / nav instrumentation and a root error
// boundary that forwards to Sentry. Acts as a passthrough when init is a no-op.
export default Sentry.wrap(Layout);
