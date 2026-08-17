import { useState, useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import SearchBar from "../../../src/components/SearchBar";
import SearchContentGrid from "../../../src/components/search/SearchContentGrid";
import SearchReviewsSection from "../../../src/components/search/SearchReviewsSection";
import SearchListsSection from "../../../src/components/search/SearchListsSection";
import SearchUsersSection from "../../../src/components/search/SearchUsersSection";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

type MainTab = "films" | "series" | "reviews" | "lists" | "users";

const TABS: { key: MainTab; label: (t: (k: string) => string) => string }[] = [
  { key: "films", label: (t) => t("Movies") },
  { key: "series", label: (t) => t("Series") },
  { key: "reviews", label: (t) => t("Reviews") },
  { key: "lists", label: (t) => t("Lists") },
  { key: "users", label: (t) => t("Users") },
];

// One shared search box feeds whichever sub-tab is active — switching tabs
// does NOT clear the typed query, since it's lifted here rather than owned
// per-tab (unlike Home's fully independent tab bodies, these all react to
// the same text).
export default function SearchScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        // No header on this screen (see search/_layout.tsx) — the search
        // box is the very first thing on the page, so it needs to account
        // for the status bar/notch itself instead of a header bar doing it.
        container: { flex: 1, backgroundColor: colors.base100, paddingTop: insets.top },
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
    [colors, insets.top]
  );

  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab>("films");
  const [visitedTabs, setVisitedTabs] = useState<Set<MainTab>>(() => new Set(["films"]));

  const switchTab = (tab: MainTab) => {
    setMainTab(tab);
    setVisitedTabs((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
  };

  return (
    <View style={styles.container}>
      <SearchBar
        placeholder={t("Search")}
        onChangeQuery={setQuery}
        onFilterPress={
          mainTab === "films" || mainTab === "series" ? () => setShowFilters((v) => !v) : undefined
        }
      />

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

      {/* Same lazy-mount-once-then-display:none pattern as home/index.tsx —
          switching tabs doesn't refetch. */}
      <View style={[{ flex: 1 }, mainTab !== "films" && styles.hidden]}>
        {visitedTabs.has("films") && (
          <SearchContentGrid contentType="movie" query={query} showFilters={showFilters} />
        )}
      </View>
      <View style={[{ flex: 1 }, mainTab !== "series" && styles.hidden]}>
        {visitedTabs.has("series") && (
          <SearchContentGrid contentType="series" query={query} showFilters={showFilters} />
        )}
      </View>
      <View style={[{ flex: 1 }, mainTab !== "reviews" && styles.hidden]}>
        {visitedTabs.has("reviews") && <SearchReviewsSection query={query} />}
      </View>
      <View style={[{ flex: 1 }, mainTab !== "lists" && styles.hidden]}>
        {visitedTabs.has("lists") && <SearchListsSection query={query} />}
      </View>
      <View style={[{ flex: 1 }, mainTab !== "users" && styles.hidden]}>
        {visitedTabs.has("users") && <SearchUsersSection query={query} />}
      </View>
    </View>
  );
}
