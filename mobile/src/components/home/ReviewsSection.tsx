import { useCallback, useEffect, useState, useMemo } from "react";
import { View, Text, FlatList, ActivityIndicator, RefreshControl, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { getReviewsFeed } from "../../api/reviewService";
import ReviewFeedCard from "../ReviewFeedCard";
import { SkeletonBox } from "../Skeleton";
import type { PopularReview } from "../../types";
import { useTheme } from "../../context/ThemeContext";

const PAGE_LIMIT = 15;

// Discover-style single feed: no inner Movie/Series sub-tab (redundant
// right after the outer Films/Series/Reviews/Lists bar — each card already
// shows its own poster/title, so the type is obvious without filtering).
// One server-merged, paginated feed (see reviewController.js's
// getReviewsFeed) instead of two separately-headed "Popular"/"Friends"
// blocks — friends' reviews surface first, tagged inline via
// ReviewFeedCard's `fromFriend` prop rather than living in their own
// section. Same infinite-scroll shape as SharesFeedSection.tsx's own feed
// (page/hasMore/loadMore via onEndReached), replacing the earlier
// fixed-size (15+15, no pagination) version.
export default function ReviewsSection() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.base100 },
    list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
    empty: { color: colors.placeholder, fontSize: 13, textAlign: "center", marginTop: 24 },
    error: { color: colors.error, textAlign: "center", marginBottom: 8 },
  }), [colors]);

  const [items, setItems] = useState<PopularReview[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getReviewsFeed(1, PAGE_LIMIT);
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
      const res = await getReviewsFeed(nextPage, PAGE_LIMIT);
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
        <View style={styles.list}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBox key={i} width="100%" height={122} borderRadius={12} style={{ marginBottom: 12 }} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={items}
      keyExtractor={(item) => item._id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
      renderItem={({ item }) => <ReviewFeedCard review={item} basePath="/home" fromFriend={item.fromFriend} />}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={<Text style={styles.empty}>{t("No reviews yet. Be the first!")}</Text>}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null}
    />
  );
}
