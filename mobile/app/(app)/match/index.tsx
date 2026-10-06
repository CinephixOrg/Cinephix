import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, View, Text, ScrollView, RefreshControl, StyleSheet, useWindowDimensions } from "react-native";
import Pressable from "../../../src/components/common/TapSafePressable";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../../src/context/AuthContext";
import { getSyncCandidates, type MatchFilters } from "../../../src/api/matchService";
import { getCineGraph } from "../../../src/api/userService";
import MatchFilterStrip from "../../../src/components/match/MatchFilterStrip";
import { MATCH_GENRE_KEYS } from "../../../src/components/match/CineMatchGenreRing";
import MatchResultsCloud from "../../../src/components/match/MatchResultsCloud";
import SyncIntroCard from "../../../src/components/match/SyncIntroCard";
import SyncIntroStory from "../../../src/components/match/SyncIntroStory";
import UpgradeRibbon from "../../../src/components/UpgradeRibbon";
import type { CineGraphData, SyncCandidate } from "../../../src/types";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";
import { STORAGE_KEYS } from "../../../src/constants/apiRoutes";
import AdBanner from "../../../src/components/ads/AdBanner";
import { AD_UNIT_IDS } from "../../../src/constants/adUnitIds";


// Nothing selected by default — the previous round's live-apply/auto-
// refetch model is gone; the filter panel's own "Find Your Match" button is
// the only thing that ever triggers a search now.
const DEFAULT_FILTERS: MatchFilters = { type: "movie", genres: [], useCount: false, useAvgRating: false };

// No more MATCH_LOADING_MS floor timer here — a real bug that survived
// three rounds of animation tuning: this used to be a *second*, separately-
// guessed duration that had to be kept numerically equal to
// CineMatchGenreRing.tsx's own ROTATE_MS by hand for the page transition to
// feel synced with the ring actually finishing. They happened to both read
// 2400 for a while, which is exactly why this was easy to miss — but nothing
// enforced that, and the user's own "animasyon bitsin ve bekleme olmadan
// kaysın" report was that gap made visible again (this file's own timer
// firing on schedule while the ring — per a *separate* perceptual mismatch
// in that component's easing curve — visually looked done slightly earlier).
// Fixed at the source: the page transition below now waits on the ring's
// own real onSpinComplete callback instead of a guessed parallel duration,
// so there's exactly one source of truth for "is the loading animation
// actually done" and these two can't drift apart again.
// The page-to-page slide itself — an Instagram-post-swipe feel, so this is
// deliberately snappier than the slow, unhurried pacing (1300ms) used
// elsewhere in this feature for the loading ring's own moves.
const PAGE_SLIDE_MS = 320;

export default function MatchScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();

  const tier = user?.accountTier ?? "free";
  // Same tier boundary the rest of the app already uses for gated features
  // (ProfileAnalysesTab, analysis history) — the server independently
  // enforces both regardless of what the client sends.
  const canUseMatchFilters = tier === "plus" || tier === "premium" || tier === "dev";
  // Separate from canUseMatchFilters (type/genre) — the useCount/
  // useAvgRating weighting toggles stay Premium-only.
  const canUseAdvancedMatchFilters = tier === "premium" || tier === "dev";

  // Defaults to false (skip it) rather than a tri-state "still checking" —
  // SecureStore's read is async with no sync fallback on native, and
  // blocking the whole page behind it would delay the common case (a
  // return visit, where this stays false) for every single visit just to
  // avoid a one-time, one-frame flash on someone's very first-ever visit.
  //
  // Keyed per-user (not just STORAGE_KEYS.SYNC_INTRO_SEEN on its own) —
  // real bug, reported live: SecureStore is device-local storage with no
  // account scoping of its own, so testing with a second account on the
  // same device/emulator inherited the FIRST account's already-dismissed
  // state, hiding the intro for an account that had genuinely never seen
  // it. Re-runs if the signed-in user changes (account switch without a
  // full app reload) rather than only once on mount.
  //
  // "_" joins the two, not ":" — SecureStore only accepts letters, digits,
  // ".", "-" and "_" in a key, and rejects anything else with a thrown error.
  const [showIntro, setShowIntro] = useState(false);
  useEffect(() => {
    if (!user?._id) return;
    SecureStore.getItemAsync(`${STORAGE_KEYS.SYNC_INTRO_SEEN}_${user._id}`)
      .then((seen) => setShowIntro(!seen))
      .catch(() => {});
  }, [user?._id]);
  const dismissIntro = useCallback(() => {
    setShowIntro(false);
    if (user?._id) SecureStore.setItemAsync(`${STORAGE_KEYS.SYNC_INTRO_SEEN}_${user._id}`, "1").catch(() => {});
  }, [user?._id]);

  const [filters, setFilters] = useState<MatchFilters>(DEFAULT_FILTERS);

  // Free/Plus can't toggle useCount/useAvgRating at all (MatchFilterStrip's
  // own advancedLocked treatment) — the server forces both true regardless
  // of what's sent (getSyncCandidates, canUseAdvancedMatchFilters), but
  // DEFAULT_FILTERS itself starts both false (a deliberate "nothing
  // selected until Sync is pressed" choice for the *interactive*,
  // Premium-only case). Left as false for a locked toggle, hasSignal (this
  // file's own hasAnyCriterion, mirrored inside MatchFilterStrip) could
  // never become true — Plus genuinely could not press Sync at all, a real
  // reported bug. Forced true here to match what the server will actually
  // use, and to show "Apply All Filters" as already checked (matching what
  // the locked switches themselves imply) rather than looking unset.
  useEffect(() => {
    if (canUseAdvancedMatchFilters) return;
    setFilters((prev) => (prev.useCount && prev.useAvgRating ? prev : { ...prev, useCount: true, useAvgRating: true }));
  }, [canUseAdvancedMatchFilters]);

  // Same reasoning, for genres — Free can't toggle genre selection either
  // (MatchFilterStrip's own `locked` treatment), and the server ignores
  // whatever's sent there anyway (forced to DEFAULT_MATCH_FILTERS.genres,
  // i.e. no restriction — every genre, in effect). Forced to the *full*
  // genre list here (not left empty) so "Apply All Genres" shows checked
  // too, consistent with the useCount/useAvgRating fix above. Re-applies on
  // a type switch too, so Movies<->Series while locked refills with that
  // type's own genre keys instead of leaving the other type's stale ones.
  useEffect(() => {
    if (canUseMatchFilters) return;
    const allGenres = MATCH_GENRE_KEYS[filters.type];
    setFilters((prev) => {
      const alreadyAll = allGenres.length === prev.genres.length && allGenres.every((g) => prev.genres.includes(g));
      return alreadyAll ? prev : { ...prev, genres: allGenres };
    });
  }, [canUseMatchFilters, filters.type]);

  const [cineGraph, setCineGraph] = useState<CineGraphData | null>(null);
  const [candidates, setCandidates] = useState<SyncCandidate[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Distinct from a generic error — retrying does nothing until tomorrow (or
  // an upgrade), so the results page shows an "Upgrade" CTA instead of the
  // usual "Retry" button for this one specific case.
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  // Drives the ring's collapse/spin animation and gates the page slide —
  // stays true until both the request resolves AND the ring's own spin
  // animation reports itself actually finished (see queueReadyRef/
  // spinDoneRef/tryFinishMatch below), whichever is later, so the
  // animation never gets cut short.
  const [matchAnimating, setMatchAnimating] = useState(false);
  // Two independent completion signals for the same in-flight match
  // request — refs, not state, since neither needs to trigger its own
  // re-render, only to be read inside the other's callback. Reset at the
  // start of every new request so a fast re-press can't accidentally
  // trigger on the *previous* request's already-true flags.
  const queueReadyRef = useRef(false);
  const spinDoneRef = useRef(false);

  // Two fixed-width "pages" (filters/CineGraph, then results) side by side
  // in one row, slid horizontally via transform — an Instagram-post-swipe
  // style transition, replacing the previous round's auto-scroll-down
  // reveal entirely. Both pages stay mounted the whole time (just shifted
  // off-screen), so MatchFilterStrip's own state/animations are never lost
  // switching between them.
  const [pageIndex, setPageIndex] = useState<0 | 1>(0);
  const pageTranslateX = useRef(new Animated.Value(0)).current;
  const goToPage = useCallback(
    (index: 0 | 1) => {
      setPageIndex(index);
      Animated.timing(pageTranslateX, {
        toValue: index === 0 ? 0 : -screenWidth,
        duration: PAGE_SLIDE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [screenWidth]
  );

  const loadQueue = useCallback(
    async (nextFilters: MatchFilters) => {
      setError(null);
      setQuotaExceeded(false);
      setHasSearched(true);
      try {
        const result = await getSyncCandidates(nextFilters);
        setCandidates(Array.isArray(result.candidates) ? result.candidates : []);
      } catch (e: any) {
        if (e?.response?.status === 429 && e?.response?.data?.errors?.limit != null) {
          setQuotaExceeded(true);
          setError(t("You've used all {{limit}} sync searches for today. Come back tomorrow, or upgrade for more.", { limit: e.response.data.errors.limit }));
        } else {
          setError(e?.response?.data?.message || t("Failed to load matches."));
        }
      } finally {
        setRefreshing(false);
      }
    },
    [t]
  );

  // The ring's own genre picker shows the viewer's own CineGraph — fetched
  // once, independent of any search (it's what the filter panel renders,
  // not the result of one).
  useEffect(() => {
    if (!user) return;
    getCineGraph(user._id).then(setCineGraph).catch(() => {});
  }, [user]);

  const onRefresh = () => {
    if (!hasSearched) return;
    setRefreshing(true);
    loadQueue(filters);
  };

  // Only actually transitions once *both* refs are true — called from both
  // completion sites below, each a no-op until the other one has also
  // fired. Whichever finishes last is the one that actually triggers the
  // transition, same "wait for both, whichever is later" semantics as
  // before, just driven by two real events instead of a guessed duration.
  const tryFinishMatch = useCallback(() => {
    if (queueReadyRef.current && spinDoneRef.current) {
      // Deferred one frame: `setCandidates` (loadQueue, above) was
      // dispatched from a promise continuation just before this runs, and
      // isn't guaranteed to have actually committed/painted yet — goToPage's
      // slide is native-driven and starts immediately, independent of
      // React's own render timing, so without this the transition could
      // begin while page 1 was still showing its *previous* render (the "no
      // results yet" empty state, with its own "Adjust Filters" button) for
      // the first frame or two — a real, reported flash of that button right
      // as the results screen opens. requestAnimationFrame gives React's
      // scheduler a chance to flush that pending update first.
      requestAnimationFrame(() => {
        setMatchAnimating(false);
        goToPage(1);
      });
    }
  }, [goToPage]);

  const handleSpinComplete = useCallback(() => {
    spinDoneRef.current = true;
    tryFinishMatch();
  }, [tryFinishMatch]);

  const handleMatchSubmit = useCallback(() => {
    // If this is a retry from the results page, slide back to the filter
    // page first so the loading ring's own animation is actually visible —
    // otherwise it'd be spinning off-screen behind the results the user is
    // still looking at.
    if (pageIndex !== 0) goToPage(0);
    setMatchAnimating(true);
    queueReadyRef.current = false;
    spinDoneRef.current = false;
    loadQueue(filters).finally(() => {
      queueReadyRef.current = true;
      tryFinishMatch();
    });
  }, [filters, loadQueue, pageIndex, goToPage, tryFinishMatch]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.base100 },
        pagesClip: { flex: 1, overflow: "hidden" },
        pagesRow: { flex: 1, flexDirection: "row", width: screenWidth * 2 },
        page: { width: screenWidth, flex: 1 },
        center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, minHeight: 300 },
        centerText: { color: colors.placeholder, fontSize: 15, textAlign: "center", marginBottom: 16 },
        primaryButton: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 22, paddingVertical: 12 },
        primaryButtonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 14 },
        cloudWrap: { paddingTop: 28, paddingBottom: 32 },
        pageBackButton: {
          position: "absolute",
          left: 16,
          top: insets.top + 12,
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.base200,
          alignItems: "center",
          justifyContent: "center",
        },
      }),
    [colors, screenWidth, insets.top]
  );

  // Free/Plus only — the one direct entry point to the subscription page
  // from this screen now; every locked control inside MatchFilterStrip
  // shows a toast instead of navigating away on tap (reported as jarring),
  // so there needs to be an obvious, deliberate way to actually get to the
  // plans page. A diagonal corner ribbon now (UpgradeRibbon), direct ask —
  // "ön planda olmalı... bant gibi" — replacing the plain pill badge this
  // used to be; MatchFilterStrip positions it into the filter card's own
  // top-right corner (upgradeButton prop).
  const upgradeButtonEl = tier === "free" || tier === "plus" ? <UpgradeRibbon onPress={() => router.push("/match/subscription" as any)} /> : null;

  return (
    <View style={styles.container}>
      <View style={styles.pagesClip}>
        <Animated.View style={[styles.pagesRow, { transform: [{ translateX: pageTranslateX }] }]}>
          <View style={styles.page} pointerEvents={pageIndex === 0 ? "auto" : "none"}>
            {showIntro ? (
              // A full-screen story takeover now, not a card inside the
              // normal scroll flow — direct ask, redesigned a second time
              // ("kart tasarımından çıkartılıp tüm sayfaya yayılabilir").
              // AdBanner lives inside SyncIntroStory itself now, under its
              // own final slide's CTA, not as a separate sibling here.
              <SyncIntroStory onFinish={dismissIntro} />
            ) : (
              <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
              >
                {user && (
                  <MatchFilterStrip
                    filters={filters}
                    onChange={setFilters}
                    onSubmit={handleMatchSubmit}
                    loading={matchAnimating}
                    onSpinComplete={handleSpinComplete}
                    cineGraph={cineGraph}
                    locked={!canUseMatchFilters}
                    advancedLocked={!canUseAdvancedMatchFilters}
                    viewer={user}
                    upgradeButton={upgradeButtonEl}
                  />
                )}

                {/* Return visits (showIntro already false, since the
                    one-time story above was already dismissed): the same
                    Sync pitch card that a first-time visitor sees blocking
                    the whole page instead lives here, in the space below
                    the filters/Sync button — permanently, direct ask
                    ("hep orda durmalı"). Previously gated on
                    `!hasSearched`, which is real per-session state (never
                    resets while this screen stays mounted), so running one
                    sync and paging back from the results made this vanish
                    for the rest of the session instead of staying put. */}
                <SyncIntroCard onStart={() => {}} showButton={false} />
                {/* Direct ask: at the very bottom of this filters page. */}
                <AdBanner unitId={AD_UNIT_IDS.SYNC_FILTERS_BANNER} />
              </ScrollView>
            )}
          </View>

          <View style={styles.page} pointerEvents={pageIndex === 1 ? "auto" : "none"}>
            <ScrollView>
              {error ? (
                <View style={styles.center}>
                  <Text style={styles.centerText}>{error}</Text>
                  {quotaExceeded ? (
                    <Pressable style={styles.primaryButton} onPress={() => router.push("/match/subscription" as any)}>
                      <Text style={styles.primaryButtonText}>{t("Upgrade")}</Text>
                    </Pressable>
                  ) : (
                    <Pressable style={styles.primaryButton} onPress={handleMatchSubmit}>
                      <Text style={styles.primaryButtonText}>{t("Retry")}</Text>
                    </Pressable>
                  )}
                </View>
              ) : candidates.length === 0 ? (
                <View style={styles.center}>
                  <Text style={styles.centerText}>{t("No matches found for these filters yet.")}</Text>
                  {/* Same action the small pageBackButton (top-left,
                      easy to miss) already offers, surfaced as an actual
                      button here — unlike the `error` branch above, this
                      state previously had no visible next step at all. */}
                  <Pressable style={styles.primaryButton} onPress={() => goToPage(0)}>
                    <Text style={styles.primaryButtonText}>{t("Adjust Filters")}</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.cloudWrap}>
                  <MatchResultsCloud candidates={candidates.slice(0, 5)} filters={filters} />
                  {/* Direct ask: under the analysis cards deck. */}
                  <AdBanner unitId={AD_UNIT_IDS.SYNC_RESULTS_BANNER} />
                </View>
              )}
            </ScrollView>

            <Pressable style={styles.pageBackButton} onPress={() => goToPage(0)} accessibilityLabel={t("Back")} hitSlop={8}>
              <Ionicons name="arrow-back" size={20} color={colors.baseContent} />
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
