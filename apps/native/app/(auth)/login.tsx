import { ActivityIndicator, Text, View } from "react-native";
import { Button } from "heroui-native";

import { Container } from "@/components/container";
import { isAuthConfigured, useAuth } from "@/lib/auth/AuthKitProvider";

export default function LoginScreen() {
  const { loading, error, signIn } = useAuth();

  if (!isAuthConfigured) {
    return (
      <Container isScrollable={false}>
        <View className="flex-1 justify-center items-center px-6 gap-3">
          <Text className="text-foreground font-semibold text-2xl">
            Sign in unavailable
          </Text>
          <Text className="text-muted text-sm text-center">
            Set EXPO_PUBLIC_WORKOS_CLIENT_ID and EXPO_PUBLIC_WORKOS_REDIRECT_URI
            before running this build.
          </Text>
        </View>
      </Container>
    );
  }

  return (
    <Container isScrollable={false}>
      <View className="flex-1 justify-center items-center px-6 gap-3">
        <Text className="text-foreground font-semibold text-2xl">Welcome</Text>
        <Text className="text-muted text-base mb-6">Sign in to continue</Text>

        <View className="w-full items-stretch mt-4">
          {loading ? (
            <ActivityIndicator />
          ) : (
            <Button onPress={signIn}>
              <Button.Label>Sign in with WorkOS</Button.Label>
            </Button>
          )}
        </View>

        {error ? (
          <Text className="text-danger text-sm text-center mt-4">{error}</Text>
        ) : null}
      </View>
    </Container>
  );
}
