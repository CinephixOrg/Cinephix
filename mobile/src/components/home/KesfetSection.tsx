import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, Animated, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import ContentTypeSection from "./ContentTypeSection";
import ReviewsSection from "./ReviewsSection";
import ListsSection from "./ListsSection";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

type MainTab = "films" | "series" | "reviews" | "lists";

const TABS: { key: MainTab; label: (t: (k: string) => string) => string }[] = [
  { key: "films", label: (t) => t("Movies") },
  { key: "series", label: (t) => t("Series") },
  { key: "reviews", label: (t) => t("Reviews") },
  { key: "lists", label: (t) => t("Lists") },
];

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// The former entire Home tab body (Movies/Series/Reviews/Lists), moved
// verbatim under Medya's "Keşfet" sub-tab — a pure extraction, no behavior
// change. Popular This Week/With Friends and the network Activity feed
// still live inside ContentTypeSection exactly as before; only Medya's own
// new Paylaşımlar sub-tab is genuinely new (see SharesFeedSection.tsx).
export default function KesfetSection() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.base100 },
        // Same sliding-window capsule design as SharesFeedSection's own
        // Recent/Popular/Network control — equal-width segments, a real
        // Animated.View window sliding behind the active one. Same muted
        // gray palette as the Medya header's own switcher (colors.placeholder
        // at the same two alpha tiers), not the theme's primary color — the
        // 4 tab positions themselves are unchanged, only the visual style.
        tabBar: {
          flexDirection: "row",
          backgroundColor: hexToRgba(colors.placeholder, 0.16),
          borderRadius: 10,
          padding: 3,
          marginHorizontal: 12,
          marginVertical: 8,
          position: "relative",
        },
        window: {
          position: "absolute",
          top: 3,
          bottom: 3,
          borderRadius: 8,
          backgroundColor: hexToRgba(colors.placeholder, 0.5),
        },
        tabButton: { flex: 1, alignItems: "center", paddingVertical: 8, zIndex: 1 },
        tabText: { fontFamily: fonts.medium, fontSize: 13, color: colors.placeholder },
        tabTextActive: { color: colors.primary, fontFamily: fonts.bold },
        hidden: { display: "none" },
      }),
    [colors]
  );

  const [mainTab, setMainTab] = useState<MainTab>("films");
  const [visitedTabs, setVisitedTabs] = useState<Set<MainTab>>(() => new Set(["films"]));

  const switchTab = (tab: MainTab) => {
    setMainTab(tab);
    setVisitedTabs((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
  };

  const [barWidth, setBarWidth] = useState(0);
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const activeIndex = TABS.findIndex((tab) => tab.key === mainTab);
  const segmentWidth = barWidth > 0 ? (barWidth - 6) / TABS.length : 0;

  useEffect(() => {
    if (barWidth === 0) return;
    Animated.spring(indicatorAnim, {
      toValue: activeIndex * segmentWidth,
      useNativeDriver: true,
      friction: 8,
      tension: 80,
    }).start();
  }, [activeIndex, barWidth]);

  return (
    <View style={styles.container}>
      <View style={styles.tabBar} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
        {barWidth > 0 && (
          <Animated.View style={[styles.window, { width: segmentWidth, transform: [{ translateX: indicatorAnim }] }]} />
        )}
        {TABS.map((tab) => (
          <Pressable key={tab.key} style={styles.tabButton} onPress={() => switchTab(tab.key)}>
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
