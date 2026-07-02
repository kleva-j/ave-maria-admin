import { useNotifications } from "@novu/react-native";
import { Surface } from "heroui-native";
import { router } from "expo-router";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { useNovuEnabled } from "@/components/novu-provider";
import { Container } from "@/components/container";

export default function NotificationsScreen() {
  const enabled = useNovuEnabled();
  if (!enabled) {
    return (
      <Container>
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-muted text-sm text-center">
            Notifications are not available right now.
          </Text>
        </View>
      </Container>
    );
  }
  return <NotificationsList />;
}

type NovuNotification = NonNullable<
  ReturnType<typeof useNotifications>["notifications"]
>[number];

function NotificationsList() {
  const { notifications, isLoading, isFetching, refetch, fetchMore, hasMore } =
    useNotifications();

  const onPressNotification = (notification: NovuNotification) => {
    void notification.read();
    const url = notification.redirect?.url;
    // Only follow internal app paths. Reject absolute / protocol-relative /
    // external URLs so a crafted or unexpected payload can't drive navigation
    // somewhere unsafe.
    if (
      url &&
      url.startsWith("/") &&
      !url.startsWith("//") &&
      !url.includes("://")
    ) {
      router.push(url as Parameters<typeof router.push>[0]);
    }
  };

  return (
    <Container>
      <FlatList
        data={notifications ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} />
        }
        onEndReached={() => {
          if (hasMore) void fetchMore();
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center p-10">
            <Text className="text-muted text-sm">
              {isLoading ? "Loading…" : "No notifications yet."}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => onPressNotification(item)}>
            <Surface
              variant={item.isRead ? "secondary" : "default"}
              className="rounded-lg p-4"
            >
              {item.subject ? (
                <Text className="text-foreground mb-1 font-medium">
                  {item.subject}
                </Text>
              ) : null}
              <Text className="text-foreground text-sm">{item.body}</Text>
              {!item.isRead && (
                <View className="mt-2 h-2 w-2 rounded-full bg-red-500" />
              )}
            </Surface>
          </Pressable>
        )}
      />
    </Container>
  );
}
