import { useEffect, useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useNavigation } from "expo-router";
import { useTranslation } from "react-i18next";
import MessagesSection from "../../../src/components/socials/MessagesSection";
import CommunitiesSection from "../../../src/components/socials/CommunitiesSection";
import CapsuleTabSwitcher from "../../../src/components/CapsuleTabSwitcher";
import { useTheme } from "../../../src/context/ThemeContext";

type MainTab = "messages" | "communities";

// Same lazy-mount-once-then-display:none shell as home/index.tsx and
// search/index.tsx. The Messages/Community toggle lives in the header
// itself now (via navigation.setOptions, same as Home's Paylaşımlar/Keşfet
// switcher) instead of a row inside the body — same component, styling,
// slide transition, *and* placement, not a lookalike re-implementation.
export default function SocialsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.base100 },
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

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <CapsuleTabSwitcher
          activeKey={mainTab}
          onChange={switchTab}
          options={[
            { key: "messages", label: t("Messages"), icon: "chatbubble-outline" },
            { key: "communities", label: t("Community"), icon: "people-outline" },
          ]}
        />
      ),
    });
  }, [navigation, mainTab, t]);

  return (
    <View style={styles.container}>
      <View style={[{ flex: 1 }, mainTab !== "messages" && styles.hidden]}>
        {visitedTabs.has("messages") && <MessagesSection />}
      </View>
      <View style={[{ flex: 1 }, mainTab !== "communities" && styles.hidden]}>
        {visitedTabs.has("communities") && <CommunitiesSection />}
      </View>
    </View>
  );
}
