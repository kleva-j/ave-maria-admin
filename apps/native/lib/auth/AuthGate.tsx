import { useEffect } from "react";
import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useRouter, useSegments } from "expo-router";

import { isAuthConfigured, useAuth } from "@/lib/auth/AuthKitProvider";

/**
 * Redirects between the (auth) group and the protected app based on the
 * current `useAuth()` state. Two rules:
 *
 * 1. Not authenticated + outside (auth) → replace with /(auth)/login
 * 2. Authenticated + inside (auth)     → replace with /(drawer)
 *
 * Renders a loading spinner while `useAuth().loading` is true so we never
 * navigate during the initial hydration flash — that flash is what causes the
 * "log-in screen flickers before drawer mounts" bug on cold boot.
 *
 * When WorkOS is not configured for this build the gate becomes a passthrough
 * so dev builds boot straight into the drawer. Screens that need auth still
 * fail their Convex queries the same way they always did in that build — the
 * gate isn't the enforcement point, the backend is.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const isAuthenticated = !!user;
  const inAuthGroup = segments[0] === "(auth)";

  useEffect(() => {
    if (!isAuthConfigured || loading) return;
    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/(drawer)");
    }
  }, [isAuthenticated, inAuthGroup, loading, router]);

  if (isAuthConfigured && loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
});
