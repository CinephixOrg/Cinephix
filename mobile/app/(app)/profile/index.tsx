import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet, type LayoutChangeEvent } from "react-native";
import Pressable from "../../../src/components/common/TapSafePressable";
import GestureModal from "../../../src/components/common/GestureModal";
import * as SecureStore from "expo-secure-store";
import { useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import PodiumHeaderIcon from "../../../src/components/PodiumHeaderIcon";
import ProfileDrawer from "../../../src/components/profile/ProfileDrawer";
import { useProfile } from "../../../src/context/ProfileContext";
import ProfileHeaderInstagram from "../../../src/components/profile/ProfileHeaderInstagram";
import ProfileCategoryTabs, { type Category } from "../../../src/components/profile/ProfileCategoryTabs";
import ProfileDrawerContent from "../../../src/components/profile/ProfileDrawerContent";
import AnalyzeInfoModal from "../../../src/components/profile/AnalyzeInfoModal";
import AnalyzeIntroStory from "../../../src/components/profile/AnalyzeIntroStory";
import { useAnalyzeProfile } from "../../../src/hooks/useAnalyzeProfile";
import { STORAGE_KEYS } from "../../../src/constants/apiRoutes";
import PostComposeMenu from "../../../src/components/home/PostComposeMenu";
import { SkeletonProfileHeader } from "../../../src/components/Skeleton";
import { useTheme } from "../../../src/context/ThemeContext";
import { useComposeCategories } from "../../../src/hooks/useComposeCategories";
import { useComposeTutorial } from "../../../src/context/ComposeTutorialContext";
import TutorialSpotlight from "../../../src/components/tutorial/TutorialSpotlight";
import TutorialInfoBox from "../../../src/components/tutorial/TutorialInfoBox";
import { fonts } from "../../../src/theme/typography";

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
  // The header's own custom title: "Profile" + the ringing gradient
  // Analyze icon right beside it — direct ask, after the full-width
  // gradient button under the bio read as too heavy. headerTitleStyle
  // (profile/_layout.tsx) sets fontFamily/color app-wide; this just adds
  // the row layout and matches that same font size.
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  // Direct report: the icon read as misaligned next to the text — Android
  // pads a Text's own box above/below its visible glyphs by default
  // (includeFontPadding), so its box was taller than what's actually
  // drawn, throwing off `alignItems:"center"` against the icon's own
  // tightly-bounded box next to it. Same fix UpgradeRibbon.tsx's own text
  // already needed for an identical reason.
  headerTitleText: {
    fontFamily: fonts.bold,
    fontSize: 17,
    lineHeight: 20,
    includeFontPadding: false,
    textAlignVertical: "center",
    color: colors.baseContent,
  },
}), [colors]);
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { profile, cineGraph, favorites, shareCount, loaded, error, ensureLoaded, refresh } = useProfile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [analyzeInfoVisible, setAnalyzeInfoVisible] = useState(false);
  // First-ever tap on the header's Analyze icon gets a full-screen story
  // pitch (AnalyzeIntroStory) instead of jumping straight to the info box
  // — direct ask, same per-user SecureStore "seen" flag Sync's own intro
  // already established (see match/index.tsx's identical showIntro/
  // dismissIntro pair for the full reasoning, account-scoped for the same
  // reason). Defaults to false (not yet confirmed unseen) so a tap that
  // somehow lands before this check resolves just opens the info box —
  // same acceptable tradeoff Sync's own version already made.
  const [showAnalyzeIntro, setShowAnalyzeIntro] = useState(false);
  const [analyzeIntroVisible, setAnalyzeIntroVisible] = useState(false);
  useEffect(() => {
    if (!profile?._id) return;
    SecureStore.getItemAsync(`${STORAGE_KEYS.ANALYZE_INTRO_SEEN}_${profile._id}`)
      .then((seen) => setShowAnalyzeIntro(!seen))
      .catch(() => {});
  }, [profile?._id]);
  const openAnalyze = useCallback(() => {
    if (showAnalyzeIntro) setAnalyzeIntroVisible(true);
    else setAnalyzeInfoVisible(true);
  }, [showAnalyzeIntro]);
  // Shared with AnalyzeInfoModal's own confirm button (useAnalyzeProfile.ts)
  // — same cooldown/429 handling, one call site for "run it and go look."
  const { statusMessage, statusOpacity, runAnalysis } = useAnalyzeProfile();
  const hasAnalyzeAccess = profile?.accountTier === "plus" || profile?.accountTier === "premium" || profile?.accountTier === "dev";
  // Direct follow-up ask: the intro's own final-slide CTA now starts the
  // real analysis directly — no reason to land back on the info box one
  // more time just to press the same button there. Free tier (never
  // entitled to begin with) and a failed/cooldown attempt are the two
  // genuine exceptions that still need that box's own messaging.
  const finishAnalyzeIntro = useCallback(async () => {
    setShowAnalyzeIntro(false);
    if (profile?._id) SecureStore.setItemAsync(`${STORAGE_KEYS.ANALYZE_INTRO_SEEN}_${profile._id}`, "1").catch(() => {});
    if (!hasAnalyzeAccess) {
      setAnalyzeIntroVisible(false);
      setAnalyzeInfoVisible(true);
      return;
    }
    const ok = await runAnalysis();
    setAnalyzeIntroVisible(false);
    if (!ok) setAnalyzeInfoVisible(true);
  }, [profile?._id, hasAnalyzeAccess, runAnalysis]);
  // "Analyze" compose-tutorial walkthrough (Shares' "+" menu) — this
  // button is now step 1 (moved here from the removed Analyze tab's own
  // handleAnalyze button); step 2 lives in the new full-screen story
  // screen's own Share button instead of ProfileAnalysisModal's.
  const { tutorial: composeTutorial, endTutorial: endComposeTutorial } = useComposeTutorial();
  const showAnalyzeTutorial = composeTutorial?.id === "analyze" && composeTutorial.step === "tapAnalyze";
  // Same "+" compose-hub menu the Shares feed's own header carries — direct
  // ask, Profile should offer that same entry point too, not just Home.
  const [composeMenuVisible, setComposeMenuVisible] = useState(false);
  const composeCategories = useComposeCategories(() => setComposeMenuVisible(false));
  // Deep-link support (e.g. official-account tip posts linking a word
  // straight to "your favorites"/"your CineGraph") — same `tab` param name
  // and validation shape as app/user/[id]/index.tsx's own public-profile
  // equivalent. "analyses" is no longer a category — that tab is gone,
  // Analyze/My Analyses both moved out of this tab row entirely.
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const VALID_CATEGORIES: Category[] = ["sharings", "favorites", "cinegraph", "badges"];
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
      // "Profile" + the ringing gradient Analyze icon right beside it —
      // direct ask, after a full-width gradient button under the bio read
      // as too heavy. Same ring animation as Media's own PodiumHeaderIcon
      // (now generalized to take its own icon/colors), just a distinct
      // glyph so it doesn't read as the same feature as Sync (whose own
      // tab icon is "sparkles") or the podium's trophy.
      headerTitle: () => (
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitleText}>{t("Profile")}</Text>
          <TutorialSpotlight active={showAnalyzeTutorial} borderRadius={16}>
            <PodiumHeaderIcon name="color-wand" colors={[colors.primary, colors.secondary]} onPress={openAnalyze} />
          </TutorialSpotlight>
        </View>
      ),
      headerRight: () => (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable onPress={() => setComposeMenuVisible(true)} hitSlop={8} style={{ padding: 4 }}>
            <Ionicons name="add" size={24} color={colors.baseContent} />
          </Pressable>
          <Pressable onPress={() => setDrawerOpen((prev) => !prev)} hitSlop={8} style={{ marginRight: 12, padding: 4 }}>
            <Ionicons name="menu" size={24} color={colors.baseContent} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, colors, t, showAnalyzeTutorial, openAnalyze, styles.headerTitleRow, styles.headerTitleText]);

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
        <ProfileHeaderInstagram
          profile={profile}
          shareCount={shareCount}
          onSharesPress={handleSharesPress}
        />
        {showAnalyzeTutorial && <TutorialInfoBox text={t("Tap here to analyze your profile.")} onDismiss={endComposeTutorial} />}
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
      <PostComposeMenu visible={composeMenuVisible} onClose={() => setComposeMenuVisible(false)} categories={composeCategories} />
      <AnalyzeInfoModal visible={analyzeInfoVisible} onClose={() => setAnalyzeInfoVisible(false)} />
      {/* GestureModal, not react-native's own Modal — see common/
          GestureModal.tsx's own comment: a plain Modal has no gesture
          root, so AnalyzeIntroStory's tap-left/right zones (TapSafePressable)
          wouldn't respond to anything inside it otherwise. */}
      <GestureModal visible={analyzeIntroVisible} animationType="slide" onRequestClose={() => setAnalyzeIntroVisible(false)}>
        <AnalyzeIntroStory onFinish={finishAnalyzeIntro} statusMessage={statusMessage} statusOpacity={statusOpacity} />
      </GestureModal>
    </ProfileDrawer>
  );
}
