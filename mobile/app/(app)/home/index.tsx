import { useEffect, useRef, useState, useMemo } from "react";
import { View, Animated, StyleSheet, useWindowDimensions, type NativeSyntheticEvent, type NativeScrollEvent } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useNavigation } from "expo-router";
import { useTranslation } from "react-i18next";
import SharesFeedSection from "../../../src/components/home/SharesFeedSection";
import KesfetSection from "../../../src/components/home/KesfetSection";
import CapsuleTabSwitcher from "../../../src/components/CapsuleTabSwitcher";
import { useTheme } from "../../../src/context/ThemeContext";

type OuterTab = "shares" | "discover";
const TABS: OuterTab[] = ["shares", "discover"];

// Medya's shell: Paylaşımlar (new social feed) | Keşfet (the former entire
// Home tab, moved verbatim into KesfetSection.tsx). Same lazy-mount-then-
// display:none pattern KesfetSection's own inner tabs (and Search's/
// Socials' outer shells) already use — now living *inside* a real
// horizontal pagingEnabled ScrollView instead of two absolutely-stacked
// display:none Views, so switching works both by tapping the header pill
// (CapsuleTabSwitcher, unchanged, still just calls back with a key — it
// has no idea a swipe gesture exists) and by swiping the content itself.
// This is deliberately local to this one screen, not a change to
// CapsuleTabSwitcher.tsx itself — that component is shared by Profile's
// CineGraph movie/series toggle and Socials' Messages/Community toggle
// too, neither of which should gain swipe navigation just because Home
// did. Safe against the same-axis nested-scroll anti-pattern already
// established elsewhere this session: this pager scrolls horizontally,
// KesfetSection's own ScrollView and SharesFeedSection's own FlatList both
// scroll vertically — orthogonal axes, no conflict.
export default function HomeScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { width: screenWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  // Drives CapsuleTabSwitcher's window directly off the pager's own live
  // scroll offset (see its own dragOffsetX/pagerWidth doc comment) — the
  // pill now moves in the same frame as the finger, not just at settle.
  const scrollX = useRef(new Animated.Value(0)).current;
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.base100 },
        page: { width: screenWidth, flex: 1 },
      }),
    [colors, screenWidth]
  );

  const [outerTab, setOuterTab] = useState<OuterTab>("shares");
  const [visitedTabs, setVisitedTabs] = useState<Set<OuterTab>>(() => new Set(["shares"]));

  const markVisited = (tab: OuterTab) => setVisitedTabs((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));

  // Tap path (from the header pill) — updates state and imperatively
  // scrolls the pager to match, so both interaction paths always agree.
  const switchTab = (tab: OuterTab) => {
    setOuterTab(tab);
    markVisited(tab);
    scrollRef.current?.scrollTo({ x: TABS.indexOf(tab) * screenWidth, animated: true });
  };

  // Swipe path — used to wait for onMomentumScrollEnd (the gesture fully
  // settling) before syncing state. That made two things lag behind a
  // manual swipe: the header pill only flipped after the whole drag+
  // momentum finished (visibly behind the finger), and — worse — the
  // destination tab is lazy-mounted off `visitedTabs`, so on a first visit
  // to Keşfet its 5 parallel fetches didn't even start until the swipe had
  // *already* finished, unlike the tap path (switchTab) which starts them
  // immediately on press. Reading continuous onScroll instead and flipping
  // as soon as the halfway point to the next page is crossed fixes both:
  // with only 2 pages, `next` can flip at most once per swipe (not
  // continuous churn), it fires while the page is still mid-drag (so
  // Keşfet starts fetching *during* the gesture, arriving loaded instead of
  // blank), and the pill now tracks the crossover instead of the settle.
  // Deliberately does NOT call scrollTo here (unlike switchTab above) —
  // the ScrollView is already where it needs to be, this just syncs state
  // to match; calling scrollTo too would fight the gesture in progress.
  const handleScrollSync = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    const tab = TABS[index];
    if (tab && tab !== outerTab) {
      setOuterTab(tab);
      markVisited(tab);
    }
  };
  // Animated.event feeds scrollX continuously (drives the pill in real
  // time), its listener runs the same crossover logic as before (mounts/
  // syncs outerTab) — the two concerns are independent now: one is a purely
  // visual per-frame position, the other a discrete once-per-swipe flip.
  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
    useNativeDriver: false,
    listener: handleScrollSync,
  });

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <CapsuleTabSwitcher
          activeKey={outerTab}
          onChange={switchTab}
          dragOffsetX={scrollX}
          pagerWidth={screenWidth}
          options={[
            { key: "shares", label: t("Paylaşımlar"), icon: "grid-outline" },
            { key: "discover", label: t("Keşfet"), icon: "compass-outline" },
          ]}
        />
      ),
    });
  }, [navigation, outerTab, t, screenWidth]);

  return (
    <View style={styles.container}>
      {/* Imported from react-native-gesture-handler, not react-native: Discover
          is full of its own horizontal rails (Trending, Friends' Choice,
          LeaderboardPodium) nested inside this horizontal pager. Plain RN
          ScrollViews can't negotiate that same-axis nesting — this outer one
          would just eat every horizontal drag. Gesture-handler's ScrollView
          participates in its native pan-gesture resolution, so an inner rail
          that can still scroll wins the gesture; only at its edge does the
          drag bubble up to page-switch. Requires every intermediate
          ancestor/descendant scroller in this chain to also use
          gesture-handler's ScrollView/FlatList (KesfetSection, ContentRail,
          LeaderboardPodium) — mixing with plain RN ScrollView breaks it. */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.page}>{visitedTabs.has("shares") && <SharesFeedSection />}</View>
        <View style={styles.page}>{visitedTabs.has("discover") && <KesfetSection isActive={outerTab === "discover"} />}</View>
      </ScrollView>
    </View>
  );
}
