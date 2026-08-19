import { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import MessagesSection from "../../../src/components/socials/MessagesSection";
import CommunitiesSection from "../../../src/components/socials/CommunitiesSection";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

type MainTab = "messages" | "communities";

// Same lazy-mount-once-then-display:none shell as home/index.tsx and
// search/index.tsx. The header is static (just NotificationBell, see
// socials/_layout.tsx) — Messages' gift/new-message actions live inside
// MessagesSection itself now, not the header.
export default function SocialsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.base100 },
        tabBar: {
          flexDirection: "row",
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.base300,
        },
        tabButton: { flex: 1, alignItems: "center", paddingVertical: 12 },
        tabButtonActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
        tabText: { fontFamily: fonts.medium, fontSize: 13, color: colors.placeholder },
        tabTextActive: { color: colors.primary, fontFamily: fonts.bold },
        hidden: { display: "none" },
      }),
    [colors]
  );

  const [mainTab, setMainTab] = useState<MainTab>("messages");
  const [visitedTabs, setVisitedTabs] = useState<Set<MainTab>>(() => new Set(["messages"]));

  const switchTab = (tab: MainTab) => {
    setMainTab(tab);
    setVisitedTabs((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tabButton, mainTab === "messages" && styles.tabButtonActive]}
          onPress={() => switchTab("messages")}
        >
          <Text style={[styles.tabText, mainTab === "messages" && styles.tabTextActive]}>{t("Messages")}</Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, mainTab === "communities" && styles.tabButtonActive]}
          onPress={() => switchTab("communities")}
        >
          <Text style={[styles.tabText, mainTab === "communities" && styles.tabTextActive]}>
            {t("Community")}
          </Text>
        </Pressable>
      </View>

      <View style={[{ flex: 1 }, mainTab !== "messages" && styles.hidden]}>
        {visitedTabs.has("messages") && <MessagesSection />}
      </View>
      <View style={[{ flex: 1 }, mainTab !== "communities" && styles.hidden]}>
        {visitedTabs.has("communities") && <CommunitiesSection />}
      </View>
    </View>
  );
}
