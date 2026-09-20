import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet, type LayoutChangeEvent } from "react-native";
import Pressable from "../../../src/components/common/TapSafePressable";
import { useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import ProfileDrawer from "../../../src/components/profile/ProfileDrawer";
import { useProfile } from "../../../src/context/ProfileContext";
import ProfileHeaderInstagram from "../../../src/components/profile/ProfileHeaderInstagram";
import ProfileCategoryTabs, { type Category } from "../../../src/components/profile/ProfileCategoryTabs";
import ProfileDrawerContent from "../../../src/components/profile/ProfileDrawerContent";
import { SkeletonProfileHeader } from "../../../src/components/Skeleton";
import { useTheme } from "../../../src/context/ThemeContext";

// The outer Profile/WatchedList/Lists/Watchlist tab bar and the category
// row's old Activity icon are both gone — this is a single screen now.
// Everything they used to hold (Activity, Watched List, Lists, Watchlist,
// Notifications, Settings) moved into the new slide-out drawer instead,
// opened via the hamburger icon this screen now supplies as its own
// headerRight (profile/_layout.tsx no longer sets one statically).
//
// Data itself comes from ProfileContext (app-wide, provided in app/_layout.tsx)
// instead of being fetched here — the context prefetches on login/app-boot and
// caches across tab switches, so this screen only shows its skeleton on a
// genuinely first-ever load, not every time the Profile tab regains focus.
export default function ProfileScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.base100 },
  scrollContent: { flexGrow: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.base100 },
  tabContent: { paddingTop: 4 },
  error: { color: colors.error, fontSize: 16 },
}), [colors]);
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { profile, cineGraph, favorites, shareCount, loaded, error, ensureLoaded, refresh } = useProfile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Deep-link support (e.g. official-account tip posts linking a word
  // straight to "your favorites"/"your CineGraph"/"your analysis") — same
  // `tab` param name and validation shape as app/user/[id]/index.tsx's own
  // public-profile equivalent.
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const VALID_CATEGORIES: Category[] = ["sharings", "favorites", "cinegraph", "analyses", "badges"];
  const initialCategory = VALID_CATEGORIES.includes(tab as Category) ? (tab as Category) : undefined;

  // Category lives here (not inside ProfileCategoryTabs) so the header's
  // Shares stat — a sibling rendered above it, not a descendant — can jump
  // straight to the Sharings tab. tabsY is the category row's own measured
  // offset inside the ScrollView, captured via onLayout, so the jump can
  // also smoothly scroll it into view rather than just swapping content
  // that might already be off-screen below the fold.
  // Deep-link tab seeding (initialCategory, above) was previously threaded
  // straight through as a child prop before category state moved up to this
  // component — restored here so a tip-post link into a specific tab still
  // works now that this screen owns the state instead of just passing a seed
  // down.
  const [category, setCategory] = useState<Category>(initialCategory || "sharings");
  const [tabsY, setTabsY] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // Deep-link seeding above only ever runs once, at this screen's own
  // first mount — a real gap for a bottom-tab screen like this one, which
  // typically stays mounted for the rest of the session: BadgeEarnedModal's
  // own "Tap to see your badge" does `router.navigate("/profile?tab=badges")`
  // on an ALREADY-mounted Profile, and without this, that new `tab` param
  // would land here silently ignored — the screen would just keep showing
  // whatever category was already selected instead of actually switching
  // to Badges. Deliberately compares against the currently-selected
  // category rather than unconditionally re-applying on every param
  // change, so tapping a different category tab by hand isn't fighting a
  // stale `tab` param still sitting in the URL.
  useEffect(() => {
    if (initialCategory && initialCategory !== category) {
      setCategory(initialCategory);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCategory]);

  // Lets AddFavoriteModal (opened from ProfileCategoryTabs' favorites edit
  // mode) hide itself while its own "view this result's detail page" tap
  // has us navigate away, without actually closing/resetting — RN's Modal
  // renders in its own native layer above the whole navigation stack, so a
  // still-"open" Modal would otherwise sit on top of and hide the newly
  // pushed Content Detail screen. Going back re-focuses this screen, which
  // re-shows the modal with whatever search state it already had.
  const [screenFocused, setScreenFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => setScreenFocused(false);
    }, [])
  );

  const handleSharesPress = () => {
    setCategory("sharings");
    scrollRef.current?.scrollTo({ y: tabsY, animated: true });
  };

  // This screen has no idea what "near bottom" means to whichever category
  // tab is actually mounted below it, so it doesn't decide anything itself
  // — it just calls whatever ProfileSharingsTab.tsx has registered into
  // this ref (only while that tab's own feed mode is actually active;
  // `null` the rest of the time, including every other category body,
  // which never touches this ref at all). A plain distance check on raw
  // scroll events (not a library) since this is the app's only outer
  // ScrollView that needs this, and scrollEventThrottle already caps how
  // often it can fire.
  const NEAR_BOTTOM_THRESHOLD = 600;
  const nearBottomRef = useRef<(() => void) | null>(null);
  const handleScroll = useCallback((e: { nativeEvent: { contentOffset: { y: number }; layoutMeasurement: { height: number }; contentSize: { height: number } } }) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - NEAR_BOTTOM_THRESHOLD) {
      nearBottomRef.current?.();
    }
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => setDrawerOpen((prev) => !prev)} hitSlop={8} style={{ marginRight: 12, padding: 4 }}>
          <Ionicons name="menu" size={24} color={colors.baseContent} />
        </Pressable>
      ),
    });
  }, [navigation, colors]);

  // ensureLoaded() is a no-op once data already exists (or a load is already
  // in flight) — refresh() on top of that is the "revalidate silently" half:
  // it re-fetches every time this tab regains focus, but since the screen
  // keeps rendering whatever's already cached while that happens, there's
  // nothing for the user to see change except the numbers updating in place.
  useFocusEffect(
    useCallback(() => {
      ensureLoaded();
      refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  if (!loaded) {
    if (error) {
      return (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      );
    }
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
        <SkeletonProfileHeader />
      </ScrollView>
    );
  }

  // loaded implies profile/favorites are non-null (refresh() only flips
  // loaded to true after both come back authorized) — but TypeScript can't
  // see that relationship across the context boundary, so this stays an
  // explicit guard rather than a non-null assertion below.
  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{t("Profile not found.")}</Text>
      </View>
    );
  }

  return (
    <ProfileDrawer
      open={drawerOpen}
      onOpen={() => setDrawerOpen(true)}
      onClose={() => setDrawerOpen(false)}
      renderDrawerContent={() => <ProfileDrawerContent onNavigate={() => setDrawerOpen(false)} />}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={200}
      >
        <ProfileHeaderInstagram profile={profile} shareCount={shareCount} onSharesPress={handleSharesPress} />
        <View style={styles.tabContent} onLayout={(e: LayoutChangeEvent) => setTabsY(e.nativeEvent.layout.y)}>
          <ProfileCategoryTabs
            favorites={favorites}
            cineGraph={cineGraph}
            category={category}
            onCategoryChange={setCategory}
            screenFocused={screenFocused}
            nearBottomRef={nearBottomRef}
          />
        </View>
      </ScrollView>
    </ProfileDrawer>
  );
}
