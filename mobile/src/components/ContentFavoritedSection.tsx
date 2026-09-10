import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, RefreshControl, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { getFavoritedBy, type FavoritedByItem } from "../api/contentService";
import ActivityRow from "./ActivityRow";
import { SkeletonActivityLogRow } from "./Skeleton";
import type { ActivityContent, ActivityEvent, ContentType } from "../types";
import { useTheme } from "../context/ThemeContext";

const PAGE_LIMIT = 20;

interface Props {
  contentType: ContentType;
  contentId: string;
}

// Content Detail's "Favorites" stat button target — everyone who has this
// favorited, same infinite-scroll shape as the other three stat-button
// pages. Used to render a simpler avatar+username row instead of
// ActivityRow's sentence-style card (favorites had no per-user timestamp
// at all) — reported as inconsistent with the other 3 pages, direct ask to
// match them. getFavoritedBy now enriches each item with `createdAt` where
// FavoriteEvent (the network Activity feed's own append-only favorite log)
// has a matching entry — ActivityRow.tsx quietly omits the time-ago label
// for the rest (favorited before that log existed), same idea
// ContentWatchedSection.tsx's own `watchlist_added` events use.
export default function ContentFavoritedSection({ contentType, contentId }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.base100 },
        list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
        empty: { color: colors.placeholder, fontSize: 13, textAlign: "center", marginTop: 24 },
        error: { color: colors.error, textAlign: "center", marginBottom: 8, marginTop: 8 },
        skeletonWrap: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },
      }),
    [colors]
  );

  const [items, setItems] = useState<FavoritedByItem[]>([]);
  const [content, setContent] = useState<ActivityContent | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getFavoritedBy(contentType, contentId, 1, PAGE_LIMIT);
      setContent(res.content);
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
          {[0, 1, 2, 3].map((i) => (
            <SkeletonActivityLogRow key={i} />
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
      renderItem={({ item }) => {
        if (!content) return null;
        const event: ActivityEvent = {
          type: "favorited",
          actor: { _id: item._id, username: item.username, profile_pic_url: item.profile_pic_url },
          content,
          createdAt: item.createdAt ?? undefined,
        };
        return <ActivityRow event={event} basePath="/home" />;
      }}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={<Text style={styles.empty}>{t("No users found.")}</Text>}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null}
    />
  );
}
