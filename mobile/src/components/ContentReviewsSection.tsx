import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView, RefreshControl, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { getContentReviews, getFriendsReviews } from "../api/reviewService";
import ReviewCard from "./ReviewCard";
import { SkeletonBox } from "./Skeleton";
import type { Review } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const PAGE_LIMIT = 20;
type ReviewTab = "friends" | "popular";

interface Props {
  contentId: string;
}

// Content Detail's "Reviews" stat button target — every review written
// for this specific movie/series. Deliberately the exact same design
// already built inline on ContentDetailScreen itself (same Friends/
// Popular tab toggle, same ReviewCard rows, same popular-tab pagination
// via getContentReviews) rather than a new card design, per direct ask
// ("mevcut tasarımda olsun") — this is a standalone full-screen version of
// that same section, for when scrolling all the way down isn't what you
// want. The inline version on ContentDetailScreen itself is untouched.
export default function ContentReviewsSection({ contentId }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.base100 },
        list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
        tabBar: { flexDirection: "row", gap: 8, marginBottom: 12 },
        tabButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.base200 },
        tabButtonActive: { backgroundColor: colors.primary },
        tabText: { fontFamily: fonts.medium, fontSize: 13, color: colors.baseContent },
        tabTextActive: { color: colors.primaryContent },
        empty: { color: colors.placeholder, fontSize: 13, textAlign: "center", marginTop: 24 },
        loadMoreButton: { alignItems: "center", paddingVertical: 12 },
        loadMoreText: { fontFamily: fonts.medium, fontSize: 13, color: colors.primary },
        skeletonWrap: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
      }),
    [colors]
  );

  const [activeTab, setActiveTab] = useState<ReviewTab>("friends");
  const [friendsReviews, setFriendsReviews] = useState<Review[]>([]);
  const [popularReviews, setPopularReviews] = useState<Review[]>([]);
  const [popularPage, setPopularPage] = useState(1);
  const [popularHasMore, setPopularHasMore] = useState(true);
  const [popularLoadingMore, setPopularLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [friends, popular] = await Promise.all([
      getFriendsReviews(contentId),
      getContentReviews(contentId, { sort: "popular", page: 1, limit: PAGE_LIMIT }),
    ]);
    setFriendsReviews(friends);
    setPopularReviews(popular.items);
    setPopularPage(1);
    setPopularHasMore(popular.pagination ? 1 < popular.pagination.pages : popular.items.length > 0);
  }, [contentId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const loadMorePopular = async () => {
    if (popularLoadingMore || !popularHasMore) return;
    setPopularLoadingMore(true);
    try {
      const nextPage = popularPage + 1;
      const popular = await getContentReviews(contentId, { sort: "popular", page: nextPage, limit: PAGE_LIMIT });
      setPopularReviews((prev) => [...prev, ...popular.items]);
      setPopularPage(nextPage);
      setPopularHasMore(popular.pagination ? nextPage < popular.pagination.pages : popular.items.length > 0);
    } finally {
      setPopularLoadingMore(false);
    }
  };

  const activeReviews = activeTab === "friends" ? friendsReviews : popularReviews;

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.skeletonWrap}>
          {[0, 1, 2].map((i) => (
            <SkeletonBox key={i} width="100%" height={110} borderRadius={12} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.tabBar}>
        <Pressable style={[styles.tabButton, activeTab === "friends" && styles.tabButtonActive]} onPress={() => setActiveTab("friends")}>
          <Text style={[styles.tabText, activeTab === "friends" && styles.tabTextActive]}>{t("Friends")}</Text>
        </Pressable>
        <Pressable style={[styles.tabButton, activeTab === "popular" && styles.tabButtonActive]} onPress={() => setActiveTab("popular")}>
          <Text style={[styles.tabText, activeTab === "popular" && styles.tabTextActive]}>{t("Popular")}</Text>
        </Pressable>
      </View>

      {activeReviews.length === 0 ? (
        <Text style={styles.empty}>
          {activeTab === "friends" ? t("No friends have reviewed this yet.") : t("No reviews yet. Be the first!")}
        </Text>
      ) : (
        activeReviews.map((r) => <ReviewCard key={r._id} review={r} />)
      )}

      {activeTab === "popular" && popularHasMore && popularReviews.length > 0 && (
        <Pressable style={styles.loadMoreButton} onPress={loadMorePopular} disabled={popularLoadingMore}>
          {popularLoadingMore ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.loadMoreText}>{t("Load more")}</Text>}
        </Pressable>
      )}
    </ScrollView>
  );
}
