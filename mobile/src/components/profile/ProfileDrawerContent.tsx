import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Pressable from "../common/TapSafePressable";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useNotifications } from "../../context/NotificationContext";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

interface Props {
  onNavigate: () => void;
}

type MenuItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
};

const ITEMS: MenuItem[] = [
  { key: "activity", label: "Activity", icon: "pulse-outline", route: "/profile/activity" },
  // Relocated out of the removed Analyze tab, direct ask — "Analyze
  // Profile" itself moved to a button at the end of the username row
  // (profile/index.tsx), this is just the history list now.
  { key: "analyses", label: "My Analyses", icon: "document-text-outline", route: "/profile/analyses" },
  { key: "watched", label: "Watched List", icon: "checkmark-done-outline", route: "/watchlist" },
  { key: "lists", label: "Lists", icon: "list-outline", route: "/lists" },
  { key: "watchlist", label: "Watchlist", icon: "bookmark-outline", route: "/to-watch" },
  // Promoted out of Settings: bringing a library over from another service is
  // a first-run task, and burying it two levels deep meant most people never
  // found it. It sits with the other library destinations rather than with
  // account preferences.
  { key: "import", label: "Import", icon: "cloud-download-outline", route: "/profile/import" },
  { key: "notifications", label: "Notifications", icon: "notifications-outline", route: "/notifications" },
  // Direct ask: subscription used to be reachable only from an Upgrade
  // button somewhere already gated behind a locked feature — a real,
  // always-available entry point for someone who just wants to go look,
  // not triggered by hitting a paywall first.
  { key: "subscriptions", label: "Subscriptions", icon: "diamond-outline", route: "/match/subscription" },
  { key: "settings", label: "Settings", icon: "settings-outline", route: "/profile/settings" },
];

// The items displaced from Profile's outer tab bar / category icons /
// header icons — a pure relocation, none of the destination screens change.
export default function ProfileDrawerContent({ onNavigate }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { unreadCount } = useNotifications();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.base200 },
        row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 16 },
        label: { fontFamily: fonts.medium, fontSize: 15, color: colors.baseContent, flex: 1 },
        badge: {
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          paddingHorizontal: 4,
          backgroundColor: colors.error,
          alignItems: "center",
          justifyContent: "center",
        },
        badgeText: { fontSize: 10, fontFamily: fonts.bold, color: "#ffffff" },
      }),
    [colors]
  );

  return (
    <SafeAreaView style={styles.container}>
      {ITEMS.map((item) => (
        <Pressable
          key={item.key}
          style={styles.row}
          onPress={() => {
            onNavigate();
            router.push(item.route as any);
          }}
        >
          <Ionicons name={item.icon} size={20} color={colors.baseContent} />
          <Text style={styles.label}>{t(item.label)}</Text>
          {item.key === "notifications" && unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
            </View>
          )}
        </Pressable>
      ))}
    </SafeAreaView>
  );
}
