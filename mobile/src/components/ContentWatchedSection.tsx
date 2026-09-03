import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, RefreshControl, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { getWatchedBy, type WatchedByItem } from "../api/contentService";
import ActivityRow from "./ActivityRow";
import { SkeletonActivityLogRow } from "./Skeleton";
import type { ActivityContent, ActivityEvent, ContentType } from "../types";
import { useTheme } from "../context/ThemeContext";

const PAGE_LIMIT = 20;

interface Props {
  contentType: ContentType;
  contentId: string;
}

// Content Detail's "Watched" stat button target — everyone who has this on
// their watched list, newest add first. Reuses ActivityRow.tsx as-is (the
// same card Discover's Activity section uses for its own `watchlist_added`
// rows) by wrapping each `{actor, createdAt}` pair from GET
// /content/:type/:id/watched-by together with the one shared `content`
// block into a real ActivityEvent, per direct ask ("aynı aktivite
// bölümündeki ... kart"). Same infinite-scroll shape as
// ContentListsSection.tsx/ContentReviewsSection.tsx.
export default function ContentWatchedSection({ contentType, contentId }: Props) {
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

  const [items, setItems] = useState<WatchedByItem[]>([]);
  const [content, setContent] = useState<ActivityContent | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getWatchedBy(contentType, contentId, 1, PAGE_LIMIT);
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
      const res = await getWatchedBy(contentType, contentId, nextPage, PAGE_LIMIT);
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
      keyExtractor={(item) => `${item.actor._id}-${item.createdAt}`}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
      renderItem={({ item }) => {
        if (!content) return null;
        const event: ActivityEvent = { type: "watchlist_added", actor: item.actor, content, createdAt: item.createdAt };
        return <ActivityRow event={event} basePath="/home" />;
      }}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={<Text style={styles.empty}>{t("No activity yet.")}</Text>}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null}
    />
  );
}
