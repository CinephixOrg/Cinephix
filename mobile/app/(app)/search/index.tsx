import { useState, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import SearchBar from "../../../src/components/SearchBar";
import SearchContentRows from "../../../src/components/search/SearchContentRows";
import SearchReviewsSection from "../../../src/components/search/SearchReviewsSection";
import SearchListsSection from "../../../src/components/search/SearchListsSection";
import SearchUsersSection from "../../../src/components/search/SearchUsersSection";
import SlidingUnderlineTabs from "../../../src/components/SlidingUnderlineTabs";
import TutorialSpotlight from "../../../src/components/tutorial/TutorialSpotlight";
import TutorialInfoBox from "../../../src/components/tutorial/TutorialInfoBox";
import { useComposeTutorial } from "../../../src/context/ComposeTutorialContext";
import { useTheme } from "../../../src/context/ThemeContext";

type MainTab = "films" | "series" | "reviews" | "lists" | "users";

const TABS: { key: MainTab; label: (t: (k: string) => string) => string }[] = [
  { key: "films", label: (t) => t("Movies") },
  { key: "series", label: (t) => t("Series") },
  { key: "reviews", label: (t) => t("Reviews") },
  { key: "lists", label: (t) => t("Lists") },
  { key: "users", label: (t) => t("Users") },
];

// Used to be one shared search box + a "stay mounted forever, just hidden"
// pattern for every visited tab (like Home's tab bodies) — switching tabs
// carried the typed query and each tab's own filters across with it. Changed
// on direct request: a tab switch now resets both, because carrying state
// across silently different result sets read as "stuck" (an old query/
// filter combo still active on a tab the viewer just arrived at, with no
// visible reason why). Only the currently-selected tab is ever mounted now —
// switching unmounts the old one and mounts a fresh instance of the new one,
// which is what actually resets each tab's own internal filter state for
// free (there's no lifted filter state to separately clear). SearchBar gets
// a `key={mainTab}` for the same reason: it owns its own typed text
// internally, so it needs a real remount (not just a prop change) to clear
// on switch.
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
      }),
    [colors, insets.top]
  );

  const { tutorial, setRecommendStep, setReviewStep, endTutorial } = useComposeTutorial();
  // "films" is already the default tab below — tapping it again while it's
  // already active is a no-op for switchTab (early-returns), so the
  // tutorial step has to advance from this screen's own onChange wrapper,
  // not from inside switchTab, or re-confirming the already-selected
  // Movies tab would never register as "picked a category." Recommend and
  // Review share this exact same pair of Search-screen steps — only the
  // info text (and which screen takes over after) differs between them.
  const isRecommendTutorial = tutorial?.id === "recommend";
  const isReviewTutorial = tutorial?.id === "review";
  const showPickCategoryTutorial = (isRecommendTutorial || isReviewTutorial) && tutorial!.step === "pickCategory";
  const showSearchTutorial = (isRecommendTutorial || isReviewTutorial) && tutorial!.step === "search";

  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab>("films");
  // Reported by whichever single section is currently mounted, purely so the
  // search bar's own filter icon can show a "something's applied" badge.
  // Reset immediately on tab switch rather than waiting for the freshly
  // mounted tab's own effect to report in (that would still be correct a
  // moment later, but resetting here avoids one frame of the old tab's badge
  // state showing on the new tab).
  const [hasActiveFilter, setHasActiveFilter] = useState(false);

  const switchTab = (tab: MainTab) => {
    if (tab === mainTab) return;
    setMainTab(tab);
    setQuery("");
    setShowFilters(false);
    setHasActiveFilter(false);
  };

  const handleTabChange = (key: string) => {
    if (showPickCategoryTutorial && (key === "films" || key === "series")) {
      if (isRecommendTutorial) setRecommendStep("search");
      else if (isReviewTutorial) setReviewStep("search");
    }
    switchTab(key as MainTab);
  };

  const filterableTab = mainTab === "films" || mainTab === "series" || mainTab === "lists" || mainTab === "reviews";

  return (
    <View style={styles.container}>
      {/* SearchBar sets its own marginHorizontal/marginVertical — this
          wrapper adds none of its own, so it sizes to exactly that margin
          box and the highlight border traces the real search box (plus its
          normal breathing room), not a second, separately-spaced region. */}
      <TutorialSpotlight active={showSearchTutorial}>
        <SearchBar
          key={mainTab}
          placeholder={t("Search")}
          onChangeQuery={setQuery}
          onFilterPress={filterableTab ? () => setShowFilters(true) : undefined}
          filterActive={hasActiveFilter}
        />
      </TutorialSpotlight>
      {showSearchTutorial && (
        <TutorialInfoBox
          text={
            isRecommendTutorial
              ? t("Now search for the movie or series you want to recommend.")
              : t("Now search for the movie or series you want to review.")
          }
          onDismiss={endTutorial}
        />
      )}

      <SlidingUnderlineTabs
        tabs={TABS.map((tab) => ({ key: tab.key, label: tab.label(t) }))}
        activeKey={mainTab}
        onChange={handleTabChange}
        highlightKeys={showPickCategoryTutorial ? ["films", "series"] : undefined}
      />
      {showPickCategoryTutorial && (
        <TutorialInfoBox text={t("Select Movies or Series to continue.")} onDismiss={endTutorial} />
      )}

      <View style={{ flex: 1 }}>
        {mainTab === "films" && (
          <SearchContentRows
            contentType="movie"
            query={query}
            showFilters={showFilters}
            onCloseFilters={() => setShowFilters(false)}
            onActiveFilterChange={setHasActiveFilter}
          />
        )}
        {mainTab === "series" && (
          <SearchContentRows
            contentType="series"
            query={query}
            showFilters={showFilters}
            onCloseFilters={() => setShowFilters(false)}
            onActiveFilterChange={setHasActiveFilter}
          />
        )}
        {mainTab === "reviews" && (
          <SearchReviewsSection
            query={query}
            showFilters={showFilters}
            onCloseFilters={() => setShowFilters(false)}
            onActiveFilterChange={setHasActiveFilter}
          />
        )}
        {mainTab === "lists" && (
          <SearchListsSection
            query={query}
            showFilters={showFilters}
            onCloseFilters={() => setShowFilters(false)}
            onActiveFilterChange={setHasActiveFilter}
          />
        )}
        {mainTab === "users" && <SearchUsersSection query={query} />}
      </View>
    </View>
  );
}
