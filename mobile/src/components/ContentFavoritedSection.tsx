import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator, RefreshControl, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { getFavoritedBy, type FavoritedByItem } from "../api/contentService";
import UserAvatar from "./UserAvatar";
import { SkeletonRow } from "./Skeleton";
import type { ContentType } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const PAGE_LIMIT = 20;

interface Props {
  contentType: ContentType;
  contentId: string;
}

// Content Detail's "Favorites" stat button target — everyone who has this
// favorited, same infinite-scroll shape as the other three stat-button
// pages. Deliberately a simpler row than ActivityRow (just avatar +
// username, tap → profile): favorites carry no per-user timestamp at all
// (favoriteMovies/favoriteSeries are still plain ObjectId arrays, unlike
// watchlist — see getWatchedBy's own doc comment), so there's no "when"
// to show, just "who" — a real, different card, not a design choice to
// reuse ActivityRow's shape without the data it needs.
export default function ContentFavoritedSection({ contentType, contentId }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.base100 },
        list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
        row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
        username: { fontFamily: fonts.medium, fontSize: 14, color: colors.baseContent },
        empty: { color: colors.placeholder, fontSize: 13, textAlign: "center", marginTop: 24 },
        error: { color: colors.error, textAlign: "center", marginBottom: 8, marginTop: 8 },
        skeletonWrap: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },
      }),
    [colors]
  );

  const [items, setItems] = useState<FavoritedByItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getFavoritedBy(contentType, contentId, 1, PAGE_LIMIT);
      setItems(res.items);
      setHasMore(res.hasMore);
      setPage(1);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to load home."));
    }
  }, [contentType, contentId, t]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await getFavoritedBy(contentType, contentId, nextPage, PAGE_LIMIT);
      setItems((prev) => [...prev, ...res.items]);
      setHasMore(res.hasMore);
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.skeletonWrap}>
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={items}
      keyExtractor={(u) => u._id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
      renderItem={({ item }) => (
        <Pressable style={styles.row} onPress={() => router.push(`/user/${item._id}` as any)}>
          <UserAvatar userId={item._id} username={item.username} profilePicUrl={item.profile_pic_url} size={40} />
          <Text style={styles.username} numberOfLines={1}>
            {item.username}
          </Text>
        </Pressable>
      )}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={<Text style={styles.empty}>{t("No users found.")}</Text>}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null}
    />
  );
}
