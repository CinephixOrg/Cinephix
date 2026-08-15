import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import NotificationBell from "../../../src/components/NotificationBell";
import CommunityTab from "../../../src/components/social/CommunityTab";
import MessagesTab from "../../../src/components/social/MessagesTab";
import { useChat } from "../../../src/context/ChatContext";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

type SocialTab = "communities" | "messages";

function MessagesHeaderRight() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        headerRow: { flexDirection: "row", alignItems: "center" },
        newButton: { marginRight: 12, padding: 4 },
      }),
    [colors]
  );
  return (
    <View style={styles.headerRow}>
      <Pressable onPress={() => router.push("/social/recommend")} hitSlop={8} style={styles.newButton}>
        <Ionicons name="gift-outline" size={22} color={colors.baseContent} />
      </Pressable>
      <Pressable onPress={() => router.push("/social/new")} hitSlop={8} style={styles.newButton}>
        <Ionicons name="create-outline" size={22} color={colors.baseContent} />
      </Pressable>
      <NotificationBell />
    </View>
  );
}

export default function SocialScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { totalUnread } = useChat();
  const [activeTab, setActiveTab] = useState<SocialTab>("communities");

  // Message composer shortcuts (gift a recommendation / start a new DM) only
  // make sense while the Messages sub-tab is showing — Communities gets just
  // the notification bell, matching community/_layout.tsx's original header.
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (activeTab === "messages" ? <MessagesHeaderRight /> : <NotificationBell />),
    });
  }, [activeTab, navigation]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.base100 },
        tabRow: {
          flexDirection: "row",
          alignSelf: "stretch",
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        tabButton: {
          flex: 1,
          flexDirection: "row",
          gap: 6,
          paddingVertical: 12,
          alignItems: "center",
          justifyContent: "center",
          borderBottomWidth: 2,
          borderBottomColor: "transparent",
          marginBottom: -StyleSheet.hairlineWidth,
        },
        tabButtonActive: { borderBottomColor: colors.primary },
        tabButtonText: { fontFamily: fonts.medium, fontSize: 13, color: colors.placeholder },
        tabButtonTextActive: { color: colors.baseContent, fontFamily: fonts.bold },
        badge: {
          minWidth: 16,
          height: 16,
          borderRadius: 8,
          paddingHorizontal: 4,
          backgroundColor: colors.error,
          alignItems: "center",
          justifyContent: "center",
        },
        badgeText: { fontSize: 10, fontFamily: fonts.bold, color: "#ffffff" },
        tabContent: { flex: 1 },
      }),
    [colors]
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabButton, activeTab === "communities" && styles.tabButtonActive]}
          onPress={() => setActiveTab("communities")}
        >
          <Text
            style={[styles.tabButtonText, activeTab === "communities" && styles.tabButtonTextActive]}
          >
            {t("Communities")}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === "messages" && styles.tabButtonActive]}
          onPress={() => setActiveTab("messages")}
        >
          <Text style={[styles.tabButtonText, activeTab === "messages" && styles.tabButtonTextActive]}>
            {t("Messages")}
          </Text>
          {totalUnread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{totalUnread > 9 ? "9+" : totalUnread}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <View style={styles.tabContent}>
        {activeTab === "communities" && <CommunityTab />}
        {activeTab === "messages" && <MessagesTab />}
      </View>
    </View>
  );
}
