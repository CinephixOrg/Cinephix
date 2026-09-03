import { useMemo } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
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

// Which single metric this card shows — each of the podium's 3 lists now
// carries only its own stat (no cross-list enrichment, simplified back
// from an earlier version that showed favorite count *and* rating on
// every card regardless of list).
type LeaderboardMetric =
  | { kind: "favorited"; favoriteCount: number }
  | { kind: "rated"; avgRating: number }
  | { kind: "recommended"; recommendCount: number };

interface Props {
  rank: 1 | 2 | 3;
  content: { id: string; title: string; poster_path?: string; type: ContentType };
  basePath: "/home" | "/search";
  metric: LeaderboardMetric;
}

// Discover's podium card — poster framed with the gradient-stroke-+-glow
// "premium" treatment in this rank's own medal color (gold/silver/bronze,
// same technique for all three ranks — only rank 1 additionally gets the
// drop-shadow glow around the whole poster) with the rank badge in the
// corner → a platform "stand" line the same width as the poster underneath
// it → name → this card's one relevant metric.
export default function LeaderboardCard({ rank, content, basePath, metric }: Props) {
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
        frameSvg: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
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
      onPress={() => router.push(`${basePath}/content/${content.type}/${content.id}` as any)}
    >
      <View style={styles.posterWrap}>
        {content.poster_path ? (
          <Image source={{ uri: `${POSTER_BASE}${content.poster_path}` }} style={styles.poster} />
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
          <Rect x="1" y="1" width="98%" height="98%" rx={FRAME_RADIUS - 1} stroke={`url(#${gradientId})`} strokeWidth={3} fill="none" />
        </Svg>
        <View style={styles.rankBadge}>
          <Text style={styles.rankBadgeText}>{rank}</Text>
        </View>
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
    </Pressable>
  );
}
