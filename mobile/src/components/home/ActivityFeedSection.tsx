import { useCallback, useEffect, useState, useMemo } from "react";
import { View, Text, FlatList, ActivityIndicator, RefreshControl, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { getNetworkActivity } from "../../api/feedService";
import ActivityRow from "../ActivityRow";
import { SkeletonBox } from "../Skeleton";
import type { ActivityEvent } from "../../types";
import { useTheme } from "../../context/ThemeContext";

const PAGE_LIMIT = 20;

// Full, independently-paginated version of ActivitySection.tsx's Discover
// preview — same infinite-scroll shape ReviewsSection.tsx already uses
// (page/hasMore/loadMore via onEndReached), reused rather than reinvented.
export default function ActivityFeedSection() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.base100 },
        list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
        divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
        empty: { color: colors.placeholder, fontSize: 13, textAlign: "center", marginTop: 24 },
        error: { color: colors.error, textAlign: "center", marginBottom: 8 },
        skeletonWrap: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },
      }),
    [colors]
  );

  const [items, setItems] = useState<ActivityEvent[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getNetworkActivity(1, PAGE_LIMIT);
      setItems(res.items);
      setHasMore(res.hasMore);
      setPage(1);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to load home."));
    }
  }, [t]);

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
      const res = await getNetworkActivity(nextPage, PAGE_LIMIT);
      setItems((prev) => [...prev, ...res.items]);
      setHasMore(res.hasMore);
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  };

  const eventKey = (e: ActivityEvent) => `${e.type}-${e.actor._id}-${e.createdAt}-${e.content.id}`;

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.skeletonWrap}>
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonBox key={i} width="100%" height={60} borderRadius={8} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={items}
      keyExtractor={eventKey}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
      renderItem={({ item }) => <ActivityRow event={item} basePath="/home" />}
      ItemSeparatorComponent={() => <View style={styles.divider} />}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={<Text style={styles.empty}>{t("No activity yet.")}</Text>}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null}
    />
  );
}
