import { Stack, router } from "expo-router";
import { Button, Surface } from "heroui-native";
import { useEffect } from "react";
import { Text, View } from "react-native";

import { Container } from "@/components/container";
import { Sentry } from "@/lib/sentry";

/**
 * Expo Router error boundary. Renders when a route throws during render.
 * Forwards the error to Sentry so the crash surfaces in the dashboard with
 * the React component stack.
 */
export default function ErrorBoundary({ error }: { error: Error }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <>
      <Stack.Screen options={{ title: "Error" }} />
      <Container>
        <View className="flex-1 justify-center items-center p-4">
          <Surface variant="secondary" className="items-center p-6 max-w-sm rounded-lg">
            <Text className="text-4xl mb-3">⚠️</Text>
            <Text className="text-foreground font-medium text-lg mb-1">
              Something went wrong
            </Text>
            <Text className="text-muted text-sm text-center mb-4">
              {error.message}
            </Text>
            <Button size="sm" onPress={() => router.replace("/")}>
              Go Home
            </Button>
          </Surface>
        </View>
      </Container>
    </>
  );
}
