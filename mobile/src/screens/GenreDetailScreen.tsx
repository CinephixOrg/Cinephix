import { useCallback, useMemo, useState } from "react";
import { View, Text, Image, FlatList, StyleSheet } from "react-native";
import Pressable from "../components/common/TapSafePressable";
import { useLocalSearchParams, useNavigation, useRouter, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { getGenreDetail } from "../api/userService";
import StarRatingDisplay from "../components/StarRatingDisplay";
import { SkeletonRow } from "../components/Skeleton";
import type { GenreDetailData } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w185";

// Rendered by two routes: /profile/genre/... (your own) and
// /user/[id]/genre/... (someone else's). The `id` param is present only on
// the latter, and that's what tells the two apart — everything below keys
// off it rather than assuming "me".
export default function GenreDetailScreen() {
  const { type, genre, id } = useLocalSearchParams<{ type: "movie" | "series"; genre: string; id?: string }>();
  // Whose genre breakdown this is. Hardcoding "me" here meant opening a
  // genre from someone else's CineGraph showed YOUR titles under their name.
  const targetUserId = id || "me";
  // Content pushed from this screen has to stay inside whichever stack this
  // screen belongs to, or its own back button lands somewhere else entirely.
  const basePath = id ? `/user/${id}` : "/profile";
  const navigation = useNavigation();
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.base100 },
        statRow: { flexDirection: "row", gap: 10, padding: 16 },
        statCard: {
          flex: 1,
          backgroundColor: colors.base200,
          borderRadius: 12,
          padding: 14,
          alignItems: "flex-start",
        },
        statLabel: { fontSize: 11, color: colors.placeholder, marginBottom: 6 },
        statValueRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
        statValue: { fontFamily: fonts.bold, fontSize: 22, color: colors.baseContent },
        statUnit: { fontSize: 12, color: colors.placeholder },
        starsRow: { marginTop: 6 },
        list: { paddingHorizontal: 16, paddingBottom: 24 },
        row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
        poster: { width: 40, height: 58, borderRadius: 6, backgroundColor: colors.base200 },
        // minWidth: 0 overrides Yoga's default content-based minimum size —
        // without it, a long unbroken title can force this flex:1 column
        // wider than the space actually available, pushing the rating slot
        // past the row's right edge instead of letting the title truncate.
        rowInfo: { flex: 1, minWidth: 0 },
        rowTitle: { fontFamily: fonts.medium, fontSize: 14, color: colors.baseContent },
        rowYear: { fontSize: 12, color: colors.placeholder, marginTop: 2 },
        ratingSlot: { flexShrink: 0 },
        unrated: { fontSize: 12, color: colors.placeholder, fontStyle: "italic" },
        empty: { textAlign: "center", color: colors.placeholder, marginTop: 40 },
      }),
    [colors]
  );

  const [data, setData] = useState<GenreDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ title: genre });
      let cancelled = false;
      setLoading(true);
      getGenreDetail(targetUserId, type, genre)
        .then((res) => {
          if (!cancelled) setData(res);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [type, genre, targetUserId])
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.list}>
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonRow key={i} lines={2} />
          ))}
        </View>
      </View>
    );
  }

  const avgStars = data?.avgRating != null ? data.avgRating : null;

  return (
    <View style={styles.container}>
      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t("Watched")}</Text>
          <View style={styles.statValueRow}>
            <Text style={styles.statValue}>{data?.count ?? 0}</Text>
            <Text style={styles.statUnit}>{type === "movie" ? t("Movies") : t("Series")}</Text>
          </View>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t("Average Rating")}</Text>
          {avgStars != null ? (
            <>
              <View style={styles.statValueRow}>
                <Text style={styles.statValue}>{(avgStars / 2).toFixed(1)}</Text>
                <Text style={styles.statUnit}>/ 5</Text>
              </View>
              <View style={styles.starsRow}>
                <StarRatingDisplay value={avgStars} size={14} />
              </View>
            </>
          ) : (
            <Text style={styles.statValue}>—</Text>
          )}
        </View>
      </View>

      <FlatList
        data={data?.items ?? []}
        keyExtractor={(item) => item.contentId}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => router.push(`${basePath}/content/${type}/${item.contentId}` as any)}
          >
            {item.posterPath ? (
              <Image source={{ uri: `${POSTER_BASE}${item.posterPath}` }} style={styles.poster} />
            ) : (
              <View style={styles.poster} />
            )}
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.title}
              </Text>
              {item.year ? <Text style={styles.rowYear}>{item.year}</Text> : null}
            </View>
            <View style={styles.ratingSlot}>
              {item.rating != null ? (
                <StarRatingDisplay value={item.rating} size={13} />
              ) : (
                <Text style={styles.unrated}>{t("Not rated")}</Text>
              )}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{t("No results found.")}</Text>}
      />
    </View>
  );
}
