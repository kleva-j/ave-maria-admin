import { Ionicons } from "@expo/vector-icons";
import { useCounts } from "@novu/react-native";
import { useThemeColor } from "heroui-native";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { useNovuEnabled } from "@/components/novu-provider";

/**
 * Drawer-header notification bell. Renders nothing when Novu is not configured.
 * The hook-using inner component only mounts when enabled, since @novu hooks
 * throw outside a NovuProvider.
 */
export function NotificationBell() {
  const enabled = useNovuEnabled();
  if (!enabled) return null;
  return <NotificationBellInner />;
}

function NotificationBellInner() {
  const foreground = useThemeColor("foreground");
  const { counts } = useCounts({ filters: [{ read: false }] });
  const unread = counts?.[0]?.count ?? 0;

  return (
    <Pressable
      className="mr-4"
      accessibilityRole="button"
      accessibilityLabel={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
      onPress={() => router.push("/notifications")}
    >
      <Ionicons name="notifications-outline" size={24} color={foreground} />
      {unread > 0 && (
        <View className="absolute -right-1 -top-1 min-w-4 items-center justify-center rounded-full bg-red-500 px-1">
          <Text className="text-[10px] font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
