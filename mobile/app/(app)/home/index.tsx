import { useEffect, useState, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { useNavigation } from "expo-router";
import { useTranslation } from "react-i18next";
import SharesFeedSection from "../../../src/components/home/SharesFeedSection";
import KesfetSection from "../../../src/components/home/KesfetSection";
import CapsuleTabSwitcher from "../../../src/components/CapsuleTabSwitcher";
import { useTheme } from "../../../src/context/ThemeContext";

type OuterTab = "shares" | "discover";

// Medya's shell: Paylaşımlar (new social feed) | Keşfet (the former entire
// Home tab, moved verbatim into KesfetSection.tsx). Same lazy-mount-then-
// display:none pattern KesfetSection's own inner tabs (and Search's/
// Socials' outer shells) already use.
export default function HomeScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.base100 },
    hidden: { display: "none" },
  }), [colors]);

  const [outerTab, setOuterTab] = useState<OuterTab>("shares");
  const [visitedTabs, setVisitedTabs] = useState<Set<OuterTab>>(() => new Set(["shares"]));

  const switchTab = (tab: OuterTab) => {
    setOuterTab(tab);
    setVisitedTabs((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
  };

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <CapsuleTabSwitcher
          activeKey={outerTab}
          onChange={switchTab}
          options={[
            { key: "shares", label: t("Paylaşımlar"), icon: "grid-outline" },
            { key: "discover", label: t("Keşfet"), icon: "compass-outline" },
          ]}
        />
      ),
    });
  }, [navigation, outerTab, t]);

  return (
    <View style={styles.container}>
      <View style={[{ flex: 1 }, outerTab !== "shares" && styles.hidden]}>
        {visitedTabs.has("shares") && <SharesFeedSection />}
      </View>
      <View style={[{ flex: 1 }, outerTab !== "discover" && styles.hidden]}>
        {visitedTabs.has("discover") && <KesfetSection />}
      </View>
    </View>
  );
}
