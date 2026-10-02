import { useMemo } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import Pressable from "./common/TapSafePressable";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import StarRatingDisplay from "./StarRatingDisplay";
import type { ContentType } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w342";

// Same gold/silver/bronze podium colors — and the same hand-picked
// lighter "shine" highlight per medal — as MatchAvatarRing.tsx's own
// rank-1/2/3 medal badges (the Sync feature). Rank 1's gold happens to
// already match ShareCard.tsx's own TIER_GOLD/TIER_GOLD_HIGHLIGHT, which
// is what the gradient-stroke-+-glow "premium frame" technique was
// borrowed from in the first place (the user's own ask: "the gold frame
// on Premium posts — do that for the 1st place card too"); once extended
// to ranks 2/3 as well (same ask, silver/bronze versions), all three now
// share one consistent gradient-frame treatment instead of ranks 2/3
// keeping a flat border while only rank 1 got the fancier one.
const MEDAL_COLORS = { 1: "#FFC94A", 2: "#C7CBD1", 3: "#CD7F32" } as const;
const MEDAL_HIGHLIGHT_COLORS = { 1: "#FFF3C4", 2: "#F2F3F5", 3: "#F0C08A" } as const;
// 1st place gets a visibly bigger poster/platform than 2nd and 3rd (which
// match each other) — the actual "podium" impression (1st standing taller)
// falls out of this size difference plus the parent row's bottom-alignment,
// no manual elevation offset needed.
const POSTER_WIDTH = { 1: 108, 2: 84, 3: 84 } as const;
const FRAME_RADIUS = 8;
const STROKE_WIDTH = 3;
// An SVG stroke straddles its own path — half its width renders *outside*
// the path's nominal bounds. The old percentage-based inset (x="1"/
// width="98%") left less margin than that overflow needed, which read as
// a real, reported sliver of clipping on the poster's own right/bottom
// edge. Same fix as PodiumSkeletonSlot.tsx's own identical bug: the Svg
// canvas is now genuinely larger than the poster (STROKE_MARGIN px extra
// on every side), and the Rect is drawn at fixed pixel coordinates, not
// percentages, so the stroke's outer edge always lands inside that larger
// canvas by construction.
const STROKE_MARGIN = 4;

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

// Discover's podium card — poster framed with the gradient-stroke-+-glow
// "premium" treatment in this rank's own medal color (gold/silver/bronze,
// same technique for all three ranks — only rank 1 additionally gets the
// drop-shadow glow around the whole poster) with the rank badge in the
// corner → a platform "stand" line the same width as the poster underneath
// it → name → this card's one relevant metric.
export default function LeaderboardCard({ rank, content, basePath, metric, locked }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const medalColor = MEDAL_COLORS[rank];
  const highlightColor = MEDAL_HIGHLIGHT_COLORS[rank];
  const posterWidth = POSTER_WIDTH[rank];
  const isFirst = rank === 1;
  const gradientId = `podiumGradient-${rank}`;
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
        frameSvg: { position: "absolute", left: -STROKE_MARGIN, right: -STROKE_MARGIN, top: -STROKE_MARGIN, bottom: -STROKE_MARGIN, overflow: "visible" },
        posterFallback: { alignItems: "center", justifyContent: "center" },
        posterFallbackText: { color: colors.placeholder, fontSize: 11 },
        rankBadge: {
          position: "absolute",
          top: -6,
          left: -6,
          minWidth: 22,
          height: 22,
          paddingHorizontal: 5,
          borderRadius: 11,
          backgroundColor: medalColor,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 2,
          borderColor: colors.base100,
        },
        rankBadgeText: { color: "#3d2b00", fontSize: 11, fontFamily: fonts.bold },
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
        platformLine: { width: posterWidth, height: 5, borderRadius: 3, backgroundColor: medalColor, marginTop: 8 },
        title: { marginTop: 6, fontFamily: fonts.bold, fontSize: 12, color: colors.baseContent, textAlign: "center" },
        metricRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
        metricText: { fontSize: 11, fontFamily: fonts.bold, color: colors.placeholder },
      }),
    [colors, medalColor, posterWidth, isFirst]
  );

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push((locked ? "/match/subscription" : `${basePath}/content/${content.type}/${content.id}`) as any)}
    >
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
        <Svg style={styles.frameSvg} pointerEvents="none">
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={highlightColor} />
              <Stop offset="1" stopColor={medalColor} />
            </LinearGradient>
          </Defs>
          <Rect
            x={STROKE_MARGIN}
            y={STROKE_MARGIN}
            width={posterWidth}
            height={posterWidth * 1.5}
            rx={FRAME_RADIUS}
            stroke={`url(#${gradientId})`}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
        </Svg>
        <View style={styles.rankBadge}>
          <Text style={styles.rankBadgeText}>{rank}</Text>
        </View>
        {locked && (
          <View style={styles.lockBadge} pointerEvents="none">
            <Ionicons name="lock-closed" size={16} color={colors.placeholder} />
          </View>
        )}
      </View>

      <View style={styles.platformLine} />

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
    </Pressable>
  );
}
