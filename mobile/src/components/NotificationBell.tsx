import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
// Gesture handler's Pressable: see src/components/socials/MessagesSection.tsx for why.
import { Pressable } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useNotifications } from "../context/NotificationContext";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

export default function NotificationBell() {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  wrap: { marginRight: 12, padding: 4 },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 10, fontFamily: fonts.bold, color: "#ffffff" },
}), [colors]);
  const { unreadCount } = useNotifications();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push("/notifications")}
      hitSlop={8}
      style={styles.wrap}
    >
      <Ionicons
        name={unreadCount > 0 ? "notifications" : "notifications-outline"}
        size={22}
        color={colors.baseContent}
      />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
        </View>
      )}
    </Pressable>
  );
}

