import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Button } from "heroui-native";

import { isAuthConfigured, useAuth } from "@/lib/auth/AuthKitProvider";

export default function LoginScreen() {
  const { loading, error, signIn } = useAuth();

  if (!isAuthConfigured) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Sign in unavailable</Text>
        <Text style={styles.body}>
          Set EXPO_PUBLIC_WORKOS_CLIENT_ID and EXPO_PUBLIC_WORKOS_REDIRECT_URI
          before running this build.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome</Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>

      <View style={styles.actions}>
        {loading ? (
          <ActivityIndicator />
        ) : (
          <Button onPress={signIn}>Sign in with WorkOS</Button>
        )}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 12,
  },
  title: { fontSize: 28, fontWeight: "600" },
  subtitle: { fontSize: 16, opacity: 0.6, marginBottom: 24 },
  body: { fontSize: 14, textAlign: "center", opacity: 0.7 },
  actions: { width: "100%", alignItems: "stretch", marginTop: 16 },
  error: { color: "#dc2626", marginTop: 16, textAlign: "center" },
});
