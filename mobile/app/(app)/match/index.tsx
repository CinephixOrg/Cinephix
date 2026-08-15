import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../src/context/AuthContext";
import { useFollowGraph } from "../../../src/context/FollowGraphContext";
import { getSwipeQueue, swipeMatch, type MatchFilters } from "../../../src/api/matchService";
import SwipeCardStack, { type SwipeCardStackHandle } from "../../../src/components/match/SwipeCardStack";
import MatchFiltersModal from "../../../src/components/match/MatchFiltersModal";
import RejectedMatchesModal from "../../../src/components/match/RejectedMatchesModal";
import type { SwipeCandidate, SwipeDecision } from "../../../src/types";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

const DEFAULT_FILTERS: MatchFilters = { type: "movie", genres: [], useCount: true, useAvgRating: true };

export default function MatchScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const followGraph = useFollowGraph();
  const stackRef = useRef<SwipeCardStackHandle>(null);

  const tier = user?.accountTier ?? "free";
  // Same tier boundary the rest of the app already uses for gated features
  // (ProfileAnalysesTab, analysis history) — Free never sees the filter/
  // rejected-list entry points; the server independently enforces both too.
  const canUseMatchFilters = tier === "pro" || tier === "premium" || tier === "dev";
  const canViewRejected = canUseMatchFilters;

  const [filters, setFilters] = useState<MatchFilters>(DEFAULT_FILTERS);
  const [candidates, setCandidates] = useState<SwipeCandidate[]>([]);
  const [queueVersion, setQueueVersion] = useState(0);
  const [topCandidate, setTopCandidate] = useState<SwipeCandidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swipesPerDay, setSwipesPerDay] = useState<number | null>(null);
  const [swipesUsedToday, setSwipesUsedToday] = useState(0);
  const [filtersModalVisible, setFiltersModalVisible] = useState(false);
  const [rejectedModalVisible, setRejectedModalVisible] = useState(false);

  const loadQueue = useCallback(async (nextFilters: MatchFilters) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getSwipeQueue(nextFilters);
      setCandidates(result.candidates);
      setSwipesPerDay(result.swipesPerDay);
      setSwipesUsedToday(result.swipesUsedToday);
      setQueueVersion((v) => v + 1);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to load matches."));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadQueue(DEFAULT_FILTERS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const limitReached = swipesPerDay !== null && swipesUsedToday >= swipesPerDay;

  const handleSwipe = async (candidate: SwipeCandidate, decision: SwipeDecision) => {
    try {
      const result = await swipeMatch(
        candidate.user._id,
        candidate.contentType,
        decision,
        candidate.matchPercentage
      );
      setSwipesUsedToday((prev) => Math.max(prev + 1, (swipesPerDay ?? 0) - result.swipesRemainingToday));
      // A swipe-accept follows the target the exact same way the regular
      // Follow button does, but goes through /match/swipe instead of
      // /users/follow — the shared FollowGraphContext never heard about it,
      // which is why the Following list kept showing a stale "Follow"
      // button. Feed it the same way useFollowState's follow() does.
      if (result.followType) {
        followGraph.applyFollow(candidate.user._id, result.followType);
      }
    } catch (e: any) {
      // Backend is the source of truth for the limit — if it says 429, trust
      // that over our local optimistic count (another session may have used
      // swipes concurrently). The card already animated away either way;
      // this only affects whether further swipes are allowed.
      if (e?.response?.status === 429 && swipesPerDay !== null) {
        setSwipesUsedToday(swipesPerDay);
      }
    }
  };

  const handleEmpty = () => {
    if (!limitReached) loadQueue(filters);
  };

  const handleApplyFilters = (next: MatchFilters) => {
    setFilters(next);
    loadQueue(next);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.base100 },
        headerRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingHorizontal: 20,
          paddingTop: 12,
        },
        headerIcons: { flexDirection: "row", gap: 10 },
        iconButton: {
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: colors.base200,
          alignItems: "center",
          justifyContent: "center",
        },
        subtitle: { color: colors.placeholder, fontSize: 13, marginTop: 4, paddingHorizontal: 20 },
        counterText: { color: colors.placeholder, fontSize: 12, paddingHorizontal: 20, marginTop: 10 },
        stackArea: { flex: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
        actionRow: {
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: 24,
          paddingVertical: 18,
        },
        actionButton: {
          width: 58,
          height: 58,
          borderRadius: 29,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.base200,
          borderWidth: 1,
          borderColor: colors.border,
        },
        profileButton: { width: 46, height: 46, borderRadius: 23 },
        center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
        centerText: { color: colors.placeholder, fontSize: 15, textAlign: "center", marginBottom: 16 },
        primaryButton: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 22, paddingVertical: 12 },
        primaryButtonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 14 },
      }),
    [colors]
  );

  const showStack = !loading && !error && !limitReached;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerIcons}>
          {canViewRejected && (
            <Pressable
              style={styles.iconButton}
              onPress={() => setRejectedModalVisible(true)}
              accessibilityLabel={t("Rejected")}
            >
              <Ionicons name="archive-outline" size={19} color={colors.baseContent} />
            </Pressable>
          )}
          {canUseMatchFilters && (
            <Pressable
              style={styles.iconButton}
              onPress={() => setFiltersModalVisible(true)}
              accessibilityLabel={t("Filters")}
            >
              <Ionicons name="options-outline" size={20} color={colors.baseContent} />
            </Pressable>
          )}
        </View>
      </View>
      <Text style={styles.subtitle}>{t("Swipe right to follow, left to pass.")}</Text>
      {swipesPerDay !== null && (
        <Text style={styles.counterText}>
          {t("{{remaining}} of {{total}} swipes left today", {
            remaining: Math.max(0, swipesPerDay - swipesUsedToday),
            total: swipesPerDay,
          })}
        </Text>
      )}

      <View style={styles.stackArea}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.centerText}>{error}</Text>
            <Pressable style={styles.primaryButton} onPress={() => loadQueue(filters)}>
              <Text style={styles.primaryButtonText}>{t("Retry")}</Text>
            </Pressable>
          </View>
        ) : limitReached ? (
          <View style={styles.center}>
            <Text style={styles.centerText}>
              {t("You've used all your swipes for today. Come back tomorrow!")}
            </Text>
            {tier === "free" && (
              <Pressable style={styles.primaryButton} onPress={() => router.push("/profile/settings")}>
                <Text style={styles.primaryButtonText}>{t("Upgrade for more swipes")}</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <SwipeCardStack
            key={queueVersion}
            ref={stackRef}
            candidates={candidates}
            onSwipe={handleSwipe}
            onEmpty={handleEmpty}
            onTopCandidateChange={setTopCandidate}
            disabled={limitReached}
          />
        )}
      </View>

      {showStack && candidates.length > 0 && (
        <View style={styles.actionRow}>
          <Pressable
            style={styles.actionButton}
            onPress={() => stackRef.current?.swipeLeft()}
            accessibilityLabel={t("Pass")}
          >
            <Ionicons name="close" size={28} color={colors.error} />
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.profileButton]}
            onPress={() => topCandidate && router.push(`/user/${topCandidate.user._id}`)}
            disabled={!topCandidate}
            accessibilityLabel={t("View Profile")}
          >
            <Ionicons name="person-outline" size={20} color={colors.baseContent} />
          </Pressable>
          <Pressable
            style={styles.actionButton}
            onPress={() => stackRef.current?.swipeRight()}
            accessibilityLabel={t("Follow")}
          >
            <Ionicons name="heart" size={26} color={colors.success} />
          </Pressable>
        </View>
      )}

      <MatchFiltersModal
        visible={filtersModalVisible}
        onClose={() => setFiltersModalVisible(false)}
        filters={filters}
        onApply={handleApplyFilters}
      />
      <RejectedMatchesModal visible={rejectedModalVisible} onClose={() => setRejectedModalVisible(false)} />
    </View>
  );
}
