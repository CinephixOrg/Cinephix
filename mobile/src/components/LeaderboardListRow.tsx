import { useMemo } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import Pressable from "./common/TapSafePressable";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import StarRatingDisplay from "./StarRatingDisplay";
import type { ContentType } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w342";
const POSTER_WIDTH = 36;

type LeaderboardMetric =
  | { kind: "favorited"; favoriteCount: number }
  | { kind: "rated"; avgRating: number }
  | { kind: "recommended"; recommendCount: number }
  | { kind: "watched"; watchedCount: number }
  | { kind: "reviewed"; reviewCount: number };

interface Props {
  rank: number;
  content: { id: string; title: string; poster_path?: string; type: ContentType };
  basePath: "/home" | "/search";
  metric: LeaderboardMetric;
}

// One row below the top-3 steps on the Content Podium's own dedicated
// page — ranks 4-15. A plain numbered rank badge (not a medal color —
// medals stay exclusive to the real top 3 above), small poster thumbnail,
// title, and the same per-kind metric rendering LeaderboardCard.tsx
// already uses (including its one special case: `rated` renders
// StarRatingDisplay, not an icon+count). Same shape as Media's own
// PodiumListRow.tsx, content instead of people — no `locked`/`highlight`
// here: a locked category shows its own teaser instead of any list at
// all, and there's no "your own rank" concept for a movie/series.
export default function LeaderboardListRow({ rank, content, basePath, metric }: Props) {
  const { colors } = useTheme();
  const router = useRouter();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
        rankBadge: { width: 26, alignItems: "center" },
        rankText: { fontFamily: fonts.bold, fontSize: 13, color: colors.placeholder },
        poster: { width: POSTER_WIDTH, aspectRatio: 2 / 3, borderRadius: 4, backgroundColor: colors.base200 },
        posterFallback: { alignItems: "center", justifyContent: "center" },
        posterFallbackText: { color: colors.placeholder, fontSize: 10 },
        body: { flex: 1, minWidth: 0 },
        title: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.baseContent },
        metricRow: { flexDirection: "row", alignItems: "center", gap: 4 },
        metricText: { fontSize: 12.5, fontFamily: fonts.bold, color: colors.placeholder },
      }),
    [colors]
  );

  return (
    <Pressable style={styles.row} onPress={() => router.push(`${basePath}/content/${content.type}/${content.id}` as any)}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>{rank}</Text>
      </View>
      {content.poster_path ? (
        <Image source={{ uri: `${POSTER_BASE}${content.poster_path}` }} style={styles.poster} />
      ) : (
        <View style={[styles.poster, styles.posterFallback]}>
          <Text style={styles.posterFallbackText}>—</Text>
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {content.title}
        </Text>
      </View>
      {metric.kind === "favorited" && (
        <View style={styles.metricRow}>
          <Ionicons name="star" size={13} color={colors.warning} />
          <Text style={styles.metricText}>{metric.favoriteCount}</Text>
        </View>
      )}
      {metric.kind === "rated" && (
        <View style={styles.metricRow}>
          <StarRatingDisplay value={metric.avgRating} size={11} />
        </View>
      )}
      {metric.kind === "recommended" && (
        <View style={styles.metricRow}>
          <Ionicons name="gift" size={13} color={colors.warning} />
          <Text style={styles.metricText}>{metric.recommendCount}</Text>
        </View>
      )}
      {metric.kind === "watched" && (
        <View style={styles.metricRow}>
          <Ionicons name="eye" size={13} color={colors.warning} />
          <Text style={styles.metricText}>{metric.watchedCount}</Text>
        </View>
      )}
      {metric.kind === "reviewed" && (
        <View style={styles.metricRow}>
          <Ionicons name="create" size={13} color={colors.warning} />
          <Text style={styles.metricText}>{metric.reviewCount}</Text>
        </View>
      )}
    </Pressable>
  );
}
