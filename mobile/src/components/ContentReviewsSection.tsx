import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, FlatList, RefreshControl, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { getContentReviews, getFriendsReviews } from "../api/reviewService";
import { useAuth } from "../context/AuthContext";
import { useMyReview } from "../hooks/useMyReview";
import SlidingUnderlineTabs from "./SlidingUnderlineTabs";
import ReviewCard from "./ReviewCard";
import { SkeletonBox } from "./Skeleton";
import type { Review } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const PAGE_LIMIT = 20;
export type ReviewMode = "popular" | "friends" | "you" | "liked";

interface Props {
  contentId: string;
  // Set only when arriving here via a tap on one of Content Detail's own
  // 3-review preview cards (ContentDetailScreen.tsx) — lands on that same
  // filter mode instead of always defaulting to Popular, and once that
  // mode's data has loaded, scrolls straight to the tapped review instead
  // of leaving the viewer to hunt for it from the top.
  initialMode?: ReviewMode;
  scrollToReviewId?: string;
}

// Content Detail's "Reviews" stat button target — every review written for
// this specific movie/series. Same 4-way filter shape Search's own main
// tab bar uses (SlidingUnderlineTabs) — Popular/Friends/You/Liked, up from
// the previous 2-way Friends/Popular toggle, direct ask. "You" is just
// this viewer's own review for this title (useMyReview — never more than
// one, addOrUpdateReview is an upsert); "Liked" is every review here this
// viewer has liked (getContentReviews's own new "liked_by_me" sort).
export default function ContentReviewsSection({ contentId, initialMode, scrollToReviewId }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const listRef = useRef<FlatList<Review>>(null);
  const scrolledRef = useRef(false);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.base100 },
        list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
        empty: { color: colors.placeholder, fontSize: 13, textAlign: "center", marginTop: 24 },
        loadMoreButton: { alignItems: "center", paddingVertical: 12 },
        loadMoreText: { fontFamily: fonts.medium, fontSize: 13, color: colors.primary },
        skeletonWrap: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
      }),
    [colors]
  );

  const [mode, setMode] = useState<ReviewMode>(initialMode ?? "popular");
  const [friendsReviews, setFriendsReviews] = useState<Review[]>([]);
  const [popularReviews, setPopularReviews] = useState<Review[]>([]);
  const [popularPage, setPopularPage] = useState(1);
  const [popularHasMore, setPopularHasMore] = useState(true);
  const [popularLoadingMore, setPopularLoadingMore] = useState(false);
  const [likedReviews, setLikedReviews] = useState<Review[]>([]);
  const [likedPage, setLikedPage] = useState(1);
  const [likedHasMore, setLikedHasMore] = useState(true);
  const [likedLoadingMore, setLikedLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { myReview, myReviewLoading, refetchMyReview } = useMyReview(contentId, user?._id);

  const load = useCallback(async () => {
    const [friends, popular, liked] = await Promise.all([
      user ? getFriendsReviews(contentId) : Promise.resolve([]),
      getContentReviews(contentId, { sort: "popular", page: 1, limit: PAGE_LIMIT }),
      user ? getContentReviews(contentId, { sort: "liked_by_me", page: 1, limit: PAGE_LIMIT }) : Promise.resolve({ items: [], pagination: undefined }),
    ]);
    setFriendsReviews(friends);
    setPopularReviews(popular.items);
    setPopularPage(1);
    setPopularHasMore(popular.pagination ? 1 < popular.pagination.pages : popular.items.length > 0);
    setLikedReviews(liked.items);
    setLikedPage(1);
    setLikedHasMore(liked.pagination ? 1 < liked.pagination.pages : liked.items.length > 0);
  }, [contentId, user]);

  useEffect(() => {
    setLoading(true);
    Promise.all([load(), refetchMyReview()]).finally(() => setLoading(false));
  }, [load, refetchMyReview]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), refetchMyReview()]);
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

  const loadMoreLiked = async () => {
    if (likedLoadingMore || !likedHasMore) return;
    setLikedLoadingMore(true);
    try {
      const nextPage = likedPage + 1;
      const liked = await getContentReviews(contentId, { sort: "liked_by_me", page: nextPage, limit: PAGE_LIMIT });
      setLikedReviews((prev) => [...prev, ...liked.items]);
      setLikedPage(nextPage);
      setLikedHasMore(liked.pagination ? nextPage < liked.pagination.pages : liked.items.length > 0);
    } finally {
      setLikedLoadingMore(false);
    }
  };

  const activeReviews =
    mode === "friends" ? friendsReviews : mode === "you" ? (myReview ? [myReview] : []) : mode === "liked" ? likedReviews : popularReviews;

  // One-shot: scrolls to the tapped preview review once its mode's data has
  // actually arrived, then never again (a later refresh/load-more shouldn't
  // keep yanking the list back down).
  useEffect(() => {
    if (!scrollToReviewId || scrolledRef.current || loading) return;
    const index = activeReviews.findIndex((r) => r._id === scrollToReviewId);
    if (index === -1) return;
    scrolledRef.current = true;
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.2 });
    });
  }, [scrollToReviewId, loading, activeReviews]);

  const emptyText =
    mode === "friends"
      ? t("No friends have reviewed this yet.")
      : mode === "you"
      ? t("You haven't reviewed this yet.")
      : mode === "liked"
      ? t("You haven't liked any reviews for this yet.")
      : t("No reviews yet. Be the first!");

  if (loading || myReviewLoading) {
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
    <View style={styles.container}>
      <SlidingUnderlineTabs
        tabs={[
          { key: "popular", label: t("Popular") },
          { key: "friends", label: t("Friends") },
          { key: "you", label: t("You") },
          { key: "liked", label: t("Liked") },
        ]}
        activeKey={mode}
        onChange={(key) => setMode(key as ReviewMode)}
      />
      <FlatList
        ref={listRef}
        style={styles.container}
        contentContainerStyle={styles.list}
        data={activeReviews}
        keyExtractor={(r) => r._id}
        renderItem={({ item }) => <ReviewCard review={item} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        onScrollToIndexFailed={(info) => {
          // FlatList without getItemLayout (review card heights vary) can
          // fail to jump straight to a far-off index on the first attempt —
          // retry once its own estimate settles, standard FlatList pattern.
          setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.2 }), 100);
        }}
        ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
        ListFooterComponent={
          mode === "popular" && popularHasMore && popularReviews.length > 0 ? (
            <Pressable style={styles.loadMoreButton} onPress={loadMorePopular} disabled={popularLoadingMore}>
              {popularLoadingMore ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.loadMoreText}>{t("Load more")}</Text>}
            </Pressable>
          ) : mode === "liked" && likedHasMore && likedReviews.length > 0 ? (
            <Pressable style={styles.loadMoreButton} onPress={loadMoreLiked} disabled={likedLoadingMore}>
              {likedLoadingMore ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.loadMoreText}>{t("Load more")}</Text>}
            </Pressable>
          ) : null
        }
      />
    </View>
  );
}
