import { useCallback, useEffect, useState, useMemo } from "react";
import { View, Text, ScrollView, RefreshControl, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { getPopularThisWeek, getPopularWithFriends, getFeed } from "../../api/feedService";
import ContentRail from "../ContentRail";
import AddedByCard from "../AddedByCard";
import FeedItemRow from "../FeedItemRow";
import { SkeletonRail } from "../Skeleton";
import type { ContentType, FeedActivityItem, PopularThisWeekItem } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

interface Props {
  contentType: ContentType;
}

const FEED_PAGE_SIZE = 5;
const MAX_FEED_ITEMS = 15;

// Films and Series tabs are structurally identical (Popular This Week +
// Popular with Friends + Activity, just type-scoped) — one shared component
// parameterized by contentType, rather than two near-duplicate screens.
export default function ContentTypeSection({ contentType }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useMemo(() => StyleSheet.create({
    container: { paddingVertical: 16, flexGrow: 1 },
    railCard: { width: 120, marginRight: 12, marginBottom: 0 },
    error: { color: colors.error, textAlign: "center", marginBottom: 8, paddingHorizontal: 16 },
    feedSection: { marginBottom: 24, paddingHorizontal: 16 },
    feedTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.baseContent, marginBottom: 4 },
    feedDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    loadMoreButton: { alignItems: "center", paddingVertical: 14 },
    loadMoreText: { color: colors.primary, fontFamily: fonts.medium, fontSize: 13 },
    feedEmpty: { alignItems: "center", paddingVertical: 24 },
    feedEmptyTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent, marginBottom: 4 },
    feedEmptyText: { color: colors.placeholder, fontSize: 13, textAlign: "center", marginBottom: 12 },
    feedEmptyButton: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
    feedEmptyButtonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 13 },
  }), [colors]);

  const [popular, setPopular] = useState<PopularThisWeekItem[]>([]);
  const [withFriends, setWithFriends] = useState<PopularThisWeekItem[]>([]);
  const [feedItems, setFeedItems] = useState<FeedActivityItem[]>([]);
  const [feedPage, setFeedPage] = useState(1);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [popularRes, friendsRes, feedRes] = await Promise.all([
        getPopularThisWeek(20, contentType),
        getPopularWithFriends(20, contentType),
        getFeed(1, FEED_PAGE_SIZE, contentType),
      ]);
      setPopular(popularRes);
      setWithFriends(friendsRes);
      setFeedItems(feedRes.items);
      setFeedPage(feedRes.page);
      setFeedHasMore(feedRes.hasMore);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to load home."));
    }
  }, [contentType]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const effectiveFeedHasMore = feedHasMore && feedItems.length < MAX_FEED_ITEMS;

  const loadMoreFeed = async () => {
    if (feedLoadingMore || !effectiveFeedHasMore) return;
    setFeedLoadingMore(true);
    try {
      const nextPage = feedPage + 1;
      const feedRes = await getFeed(nextPage, FEED_PAGE_SIZE, contentType);
      setFeedItems((prev) => [...prev, ...feedRes.items]);
      setFeedPage(feedRes.page);
      setFeedHasMore(feedRes.hasMore);
    } finally {
      setFeedLoadingMore(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <ScrollView style={{ backgroundColor: colors.base100 }} contentContainerStyle={styles.container}>
        <SkeletonRail />
        <SkeletonRail />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.base100 }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {error && <Text style={styles.error}>{error}</Text>}

      <ContentRail
        title={t("Popular This Week")}
        data={popular}
        keyExtractor={(item) => `${item.content.type}-${item.content.id}`}
        emptyText={t("Nothing popular yet this week.")}
        renderItem={(item) => <AddedByCard item={item} />}
      />

      <ContentRail
        title={t("Popular with Friends")}
        data={withFriends}
        keyExtractor={(item) => `${item.content.type}-${item.content.id}`}
        emptyText={t("Nothing popular with friends yet this week.")}
        renderItem={(item) => <AddedByCard item={item} />}
      />

      <View style={styles.feedSection}>
        <Text style={styles.feedTitle}>{t("Activity")}</Text>
        {feedItems.length === 0 ? (
          <View style={styles.feedEmpty}>
            <Text style={styles.feedEmptyTitle}>{t("Your feed is empty")}</Text>
            <Text style={styles.feedEmptyText}>
              {t("Follow other cinephiles to see their ratings, reviews, and watchlist updates here.")}
            </Text>
            <Pressable style={styles.feedEmptyButton} onPress={() => router.push("/network")}>
              <Text style={styles.feedEmptyButtonText}>{t("Find people to follow")}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {feedItems.map((item, i) => (
              <View key={`${item.type}-${item.user._id}-${item.createdAt}-${i}`}>
                <FeedItemRow item={item} />
                {i < feedItems.length - 1 && <View style={styles.feedDivider} />}
              </View>
            ))}
            {effectiveFeedHasMore && (
              <Pressable style={styles.loadMoreButton} onPress={loadMoreFeed} disabled={feedLoadingMore}>
                {feedLoadingMore ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text style={styles.loadMoreText}>{t("Load more")}</Text>
                )}
              </Pressable>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}
