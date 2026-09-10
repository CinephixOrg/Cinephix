import { useCallback, useEffect, useState, useMemo } from "react";
import { View, Text, FlatList, ActivityIndicator, RefreshControl, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { getReviewsFeed } from "../../api/reviewService";
import ReviewFeedCard from "../ReviewFeedCard";
import SlidingUnderlineTabs from "../SlidingUnderlineTabs";
import { SkeletonBox } from "../Skeleton";
import type { PopularReview } from "../../types";
import { useTheme } from "../../context/ThemeContext";

const PAGE_LIMIT = 15;
type ReviewMode = "all" | "friends" | "liked";

// Discover-style single feed with an All/Friends/Liked filter (same
// SlidingUnderlineTabs shape Content Detail's own Reviews filter and
// Discover's Popular Lists filter both use) — replaces the earlier merged-
// feed-with-inline-friend-tags version (ReviewFeedCard's own `fromFriend`
// prop, now removed) per direct ask. "All" is the original blended
// behavior (friends' reviews boosted, not exclusively shown); "Friends"
// and "Liked" are real hard filters (reviewController.js's getReviewsFeed,
// its own new `mode` param). Same infinite-scroll shape as
// SharesFeedSection.tsx's own feed (page/hasMore/loadMore via
// onEndReached).
export default function ReviewsSection() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.base100 },
    list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
    empty: { color: colors.placeholder, fontSize: 13, textAlign: "center", marginTop: 24 },
    error: { color: colors.error, textAlign: "center", marginBottom: 8 },
  }), [colors]);

  const [mode, setMode] = useState<ReviewMode>("all");
  const [items, setItems] = useState<PopularReview[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getReviewsFeed(1, PAGE_LIMIT, mode);
      setItems(res.items);
      setHasMore(res.hasMore);
      setPage(1);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to load home."));
    }
  }, [t, mode]);

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
      const res = await getReviewsFeed(nextPage, PAGE_LIMIT, mode);
      setItems((prev) => [...prev, ...res.items]);
      setHasMore(res.hasMore);
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  };

  const emptyText =
    mode === "friends"
      ? t("No friends have reviewed anything yet.")
      : mode === "liked"
      ? t("You haven't liked any reviews yet.")
      : t("No reviews yet. Be the first!");

  return (
    <View style={styles.container}>
      <SlidingUnderlineTabs
        tabs={[
          { key: "all", label: t("All") },
          { key: "friends", label: t("Friends") },
          { key: "liked", label: t("Liked") },
        ]}
        activeKey={mode}
        onChange={(key) => setMode(key as ReviewMode)}
      />
      {loading ? (
        <View style={styles.list}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBox key={i} width="100%" height={122} borderRadius={12} style={{ marginBottom: 12 }} />
          ))}
        </View>
      ) : (
        <FlatList
          style={styles.container}
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
          renderItem={({ item }) => <ReviewFeedCard review={item} basePath="/home" />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null}
        />
      )}
    </View>
  );
}
