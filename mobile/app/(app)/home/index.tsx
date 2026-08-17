import { useState, useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import ContentTypeSection from "../../../src/components/home/ContentTypeSection";
import ReviewsSection from "../../../src/components/home/ReviewsSection";
import ListsSection from "../../../src/components/home/ListsSection";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

type MainTab = "films" | "series" | "reviews" | "lists";

const TABS: { key: MainTab; label: (t: (k: string) => string) => string }[] = [
  { key: "films", label: (t) => t("Movies") },
  { key: "series", label: (t) => t("Series") },
  { key: "reviews", label: (t) => t("Reviews") },
  { key: "lists", label: (t) => t("Lists") },
];

export default function HomeScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => StyleSheet.create({
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
  }), [colors]);

  const [mainTab, setMainTab] = useState<MainTab>("films");
  const [visitedTabs, setVisitedTabs] = useState<Set<MainTab>>(() => new Set(["films"]));

  const switchTab = (tab: MainTab) => {
    setMainTab(tab);
    setVisitedTabs((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tabButton, mainTab === tab.key && styles.tabButtonActive]}
            onPress={() => switchTab(tab.key)}
          >
            <Text style={[styles.tabText, mainTab === tab.key && styles.tabTextActive]}>{tab.label(t)}</Text>
          </Pressable>
        ))}
      </View>

      {/* Each tab body is self-contained (own data fetching, loading, and
          pull-to-refresh) and mounted lazily on first activation, then kept
          mounted (display:none when inactive) so switching tabs doesn't
          refetch — only the currently active tab's pull-to-refresh runs. */}
      <View style={[{ flex: 1 }, mainTab !== "films" && styles.hidden]}>
        {visitedTabs.has("films") && <ContentTypeSection contentType="movie" />}
      </View>
      <View style={[{ flex: 1 }, mainTab !== "series" && styles.hidden]}>
        {visitedTabs.has("series") && <ContentTypeSection contentType="series" />}
      </View>
      <View style={[{ flex: 1 }, mainTab !== "reviews" && styles.hidden]}>
        {visitedTabs.has("reviews") && <ReviewsSection />}
      </View>
      <View style={[{ flex: 1 }, mainTab !== "lists" && styles.hidden]}>
        {visitedTabs.has("lists") && <ListsSection />}
      </View>
    </View>
  );
}
