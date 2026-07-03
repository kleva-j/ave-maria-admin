import { Stack, router, type RelativePathString } from "expo-router";
import { Button, Surface } from "heroui-native";
import { Text, View } from "react-native";

import { Container } from "@/components/container";
import { Sentry } from "@/lib/sentry";

/**
 * Expo Router error boundary. Renders when a route throws during render.
 * Forwards the error to Sentry so the crash surfaces in the dashboard with
 * the React component stack.
 *
 * Sentry.captureException runs synchronously in the component body (not in
 * useEffect) so it fires on the first render pass instead of waiting for a
 * commit. The Sentry SDK dedupes same-instance captures.
 */
export default function ErrorBoundary({ error }: { error: Error }) {
  Sentry.captureException(error);

  // Only show raw error details in dev — in production the message may leak
  // stack hints, API URLs, or DB errors. Prod users see a neutral fallback.
  const detail = __DEV__ ? error.message : "Please try again.";

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
              {detail}
            </Text>
            <Button size="sm" onPress={() => router.replace("/" as RelativePathString)}>
              Go Home
            </Button>
          </Surface>
        </View>
      </Container>
    </>
  );
}
