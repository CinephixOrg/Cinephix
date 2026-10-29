import { useEffect, useMemo, useRef } from "react";
import { View, Text, Image, Animated, Easing, StyleSheet } from "react-native";
import Pressable from "./common/TapSafePressable";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import StarRatingDisplay from "./StarRatingDisplay";
import type { ContentType } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w342";

// Same gold/silver/bronze podium colors as everywhere else this app shows
// a top-3 (PodiumStepCard.tsx, PodiumSkeletonSlot.tsx). Only used for the
// step fill now — the gradient-stroke poster frame and the circular rank
// badge were both removed per direct ask, same "daha sade ve profesyonel"
// redesign PodiumStepCard.tsx already got on the People Podium side.
const MEDAL_COLORS = { 1: "#FFC94A", 2: "#C7CBD1", 3: "#CD7F32" } as const;
// 1st place gets a visibly bigger poster/platform than 2nd and 3rd (which
// match each other) — the actual "podium" impression (1st standing taller)
// falls out of this size difference plus the parent row's bottom-alignment,
// no manual elevation offset needed.
const POSTER_WIDTH = { 1: 108, 2: 84, 3: 84 } as const;
const FRAME_RADIUS = 8;
// Same values as PodiumStepCard.tsx's own STEP_HEIGHT, reused identically
// (not independently tuned) so both podiums' steps read as one consistent
// visual language, direct ask.
const STEP_HEIGHT = { 1: 76, 2: 46, 3: 30 } as const;
const ENTRANCE_MS = 480;

// Which single metric this card shows — each of the podium's 5 lists now
// carries only its own stat (no cross-list enrichment, simplified back
// from an earlier version that showed favorite count *and* rating on
// every card regardless of list). "watched"/"reviewed" added alongside
// the podium's own 2 new categories.
type LeaderboardMetric =
  | { kind: "favorited"; favoriteCount: number }
  | { kind: "rated"; avgRating: number }
  | { kind: "recommended"; recommendCount: number }
  | { kind: "watched"; watchedCount: number }
  | { kind: "reviewed"; reviewCount: number };

interface Props {
  rank: 1 | 2 | 3;
  content: { id: string; title: string; poster_path?: string; type: ContentType };
  basePath: "/home" | "/search";
  metric: LeaderboardMetric;
  // Free-tier viewer gate — same technique as Media's own PeoplePodiumCard:
  // a real blur baked into the poster image itself (RN's native `Image`
  // `blurRadius`, not an overlay), plus a small lock badge on top. Title/
  // rank/metric stay fully visible either way — same "still the actual
  // tease" reasoning. Tapping a locked card routes to the subscription
  // page instead of Content Detail.
  locked?: boolean;
}

// Discover's podium card — poster → title → this card's one relevant
// metric → a raised, rank-colored step with the rank number embedded in
// its own center (same "basamaklı gösterim" redesign PodiumStepCard.tsx
// already got on the People Podium side — see that file's own doc comment
// for the full reasoning). This is the one real consumer of this
// component (confirmed via grep — LeaderboardPodium.tsx only), so it's
// modified in place rather than forked into a separate file the way
// PeoplePodiumCard.tsx had to stay untouched for CommunityRailCard.tsx's
// sake.
export default function LeaderboardCard({ rank, content, basePath, metric, locked }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const medalColor = MEDAL_COLORS[rank];
  const posterWidth = POSTER_WIDTH[rank];
  const isFirst = rank === 1;

  // Entrance animation, same technique as PodiumStepCard.tsx — runs once
  // per mount, which naturally covers both the podium's first load AND
  // every category switch (each category's own `.map()` keys cards by
  // `content.id`, so a different category's cards are always a fresh
  // mount, never a reused instance).
  const growAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(growAnim, { toValue: 1, duration: ENTRANCE_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(fadeAnim, { toValue: 1, duration: ENTRANCE_MS, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const animatedStepHeight = growAnim.interpolate({ inputRange: [0, 1], outputRange: [0, STEP_HEIGHT[rank]] });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: { alignItems: "center", width: posterWidth },
        posterWrap: isFirst
          ? {
              position: "relative",
              shadowColor: MEDAL_COLORS[1],
              shadowOpacity: 0.45,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 3 },
              elevation: 6,
            }
          : { position: "relative" },
        poster: {
          width: posterWidth,
          aspectRatio: 2 / 3,
          borderRadius: FRAME_RADIUS,
          backgroundColor: colors.base200,
        },
        posterFallback: { alignItems: "center", justifyContent: "center" },
        posterFallbackText: { color: colors.placeholder, fontSize: 11 },
        // Centered on the (blurred) poster, same small circular treatment
        // as Media's own PeoplePodiumCard.tsx lockBadge / Sync's
        // MatchCloudBubble.tsx.
        lockBadge: {
          position: "absolute",
          top: "50%",
          left: "50%",
          marginTop: -14,
          marginLeft: -14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.base100,
          borderRadius: 999,
          padding: 6,
        },
        title: { marginTop: 8, fontFamily: fonts.bold, fontSize: 12, color: colors.baseContent, textAlign: "center" },
        metricRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
        metricText: { fontSize: 11, fontFamily: fonts.bold, color: colors.placeholder },
        // The actual raised step — same embedded-rank-number treatment as
        // PodiumStepCard.tsx's own `step`/`stepRankText`. No fixed
        // `height` — animatedStepHeight drives it instead.
        step: {
          width: posterWidth,
          overflow: "hidden",
          marginTop: 10,
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
          backgroundColor: medalColor,
          alignItems: "center",
          justifyContent: "center",
        },
        stepRankText: { fontFamily: fonts.bold, fontSize: 18, color: colors.base100 },
      }),
    [colors, medalColor, posterWidth, isFirst]
  );

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push((locked ? "/match/subscription" : `${basePath}/content/${content.type}/${content.id}`) as any)}
    >
      <Animated.View style={{ opacity: fadeAnim, alignItems: "center" }}>
        <View style={styles.posterWrap}>
          {content.poster_path ? (
            <Image
              source={{ uri: `${POSTER_BASE}${content.poster_path}` }}
              style={styles.poster}
              blurRadius={locked ? Math.max(8, posterWidth * 0.18) : undefined}
            />
          ) : (
            <View style={[styles.poster, styles.posterFallback]}>
              <Text style={styles.posterFallbackText}>—</Text>
            </View>
          )}
          {locked && (
            <View style={styles.lockBadge} pointerEvents="none">
              <Ionicons name="lock-closed" size={16} color={colors.placeholder} />
            </View>
          )}
        </View>

        <Text style={styles.title} numberOfLines={1}>
          {content.title}
        </Text>

        {metric.kind === "favorited" && (
          <View style={styles.metricRow}>
            <Ionicons name="star" size={12} color={colors.warning} />
            <Text style={styles.metricText}>{metric.favoriteCount}</Text>
          </View>
        )}
        {metric.kind === "rated" && (
          <View style={styles.metricRow}>
            <StarRatingDisplay value={metric.avgRating} size={10} />
          </View>
        )}
        {metric.kind === "recommended" && (
          <View style={styles.metricRow}>
            <Ionicons name="gift" size={12} color={colors.warning} />
            <Text style={styles.metricText}>{metric.recommendCount}</Text>
          </View>
        )}
        {metric.kind === "watched" && (
          <View style={styles.metricRow}>
            <Ionicons name="eye" size={12} color={colors.warning} />
            <Text style={styles.metricText}>{metric.watchedCount}</Text>
          </View>
        )}
        {metric.kind === "reviewed" && (
          <View style={styles.metricRow}>
            <Ionicons name="create" size={12} color={colors.warning} />
            <Text style={styles.metricText}>{metric.reviewCount}</Text>
          </View>
        )}

        <Animated.View style={[styles.step, { height: animatedStepHeight }]}>
          <Text style={styles.stepRankText}>{rank}</Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}
