import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, View, Text, Pressable, ScrollView, RefreshControl, StyleSheet, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../src/context/AuthContext";
import { getSwipeQueue, type MatchFilters } from "../../../src/api/matchService";
import { getCineGraph } from "../../../src/api/userService";
import MatchFilterStrip from "../../../src/components/match/MatchFilterStrip";
import MatchResultsCloud from "../../../src/components/match/MatchResultsCloud";
import type { CineGraphData, SwipeCandidate } from "../../../src/types";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

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
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();

  const tier = user?.accountTier ?? "free";
  // Same tier boundary the rest of the app already uses for gated features
  // (ProfileAnalysesTab, analysis history) — the server independently
  // enforces both regardless of what the client sends.
  const canUseMatchFilters = tier === "pro" || tier === "premium" || tier === "dev";

  const [filters, setFilters] = useState<MatchFilters>(DEFAULT_FILTERS);
  const [cineGraph, setCineGraph] = useState<CineGraphData | null>(null);
  const [candidates, setCandidates] = useState<SwipeCandidate[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      setHasSearched(true);
      try {
        const result = await getSwipeQueue(nextFilters);
        setCandidates(Array.isArray(result.candidates) ? result.candidates : []);
      } catch (e: any) {
        setError(e?.response?.data?.message || t("Failed to load matches."));
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
      setMatchAnimating(false);
      goToPage(1);
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
          bottom: 16,
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.base200,
          alignItems: "center",
          justifyContent: "center",
        },
      }),
    [colors, screenWidth]
  );

  return (
    <View style={styles.container}>
      <View style={styles.pagesClip}>
        <Animated.View style={[styles.pagesRow, { transform: [{ translateX: pageTranslateX }] }]}>
          <View style={styles.page} pointerEvents={pageIndex === 0 ? "auto" : "none"}>
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
                  viewer={user}
                />
              )}

              {!hasSearched && (
                <View style={styles.center}>
                  <Text style={styles.centerText}>{t("Set your filters above, then tap Sync.")}</Text>
                </View>
              )}
            </ScrollView>
          </View>

          <View style={styles.page} pointerEvents={pageIndex === 1 ? "auto" : "none"}>
            <ScrollView>
              {error ? (
                <View style={styles.center}>
                  <Text style={styles.centerText}>{error}</Text>
                  <Pressable style={styles.primaryButton} onPress={handleMatchSubmit}>
                    <Text style={styles.primaryButtonText}>{t("Retry")}</Text>
                  </Pressable>
                </View>
              ) : candidates.length === 0 ? (
                <View style={styles.center}>
                  <Text style={styles.centerText}>{t("No matches found for these filters yet.")}</Text>
                </View>
              ) : (
                <View style={styles.cloudWrap}>
                  <MatchResultsCloud candidates={candidates.slice(0, 5)} filters={filters} />
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
