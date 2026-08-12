import { useCallback, useState, useMemo } from "react";
import { View, ScrollView, RefreshControl, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { getPopularThisWeek, getRecommendations, getFeed, getTopPicks } from "../../../src/api/feedService";
import { discoverLists } from "../../../src/api/listService";
import { getSuggestions } from "../../../src/api/userService";
import { getPopularReviews } from "../../../src/api/reviewService";
import ContentCard from "../../../src/components/ContentCard";
import ContentRail from "../../../src/components/ContentRail";
import DiscoverListCard from "../../../src/components/DiscoverListCard";
import SuggestedUserCard from "../../../src/components/SuggestedUserCard";
import PopularReviewCard from "../../../src/components/PopularReviewCard";
import TopPickCard from "../../../src/components/TopPickCard";
import FeedItemRow from "../../../src/components/FeedItemRow";
import { SkeletonRail } from "../../../src/components/Skeleton";
import type {
  DiscoverListItem,
  FeedActivityItem,
  PopularReview,
  PopularThisWeekItem,
  RecommendationItem,
  SuggestedUser,
  TopPick,
} from "../../../src/types";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

export default function HomeScreen() {
  const { colors } = useTheme();
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
  feedEmptyButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  feedEmptyButtonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 13 },
}), [colors]);
  const { t } = useTranslation();
  const router = useRouter();

  const [popular, setPopular] = useState<PopularThisWeekItem[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [hasPersonalization, setHasPersonalization] = useState(false);
  const [lists, setLists] = useState<DiscoverListItem[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [popularReviews, setPopularReviews] = useState<PopularReview[]>([]);
  const [topPicks, setTopPicks] = useState<TopPick[]>([]);
  const [feedItems, setFeedItems] = useState<FeedActivityItem[]>([]);
  const [feedPage, setFeedPage] = useState(1);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [popularRes, recRes, listsRes, suggestionsRes, popularReviewsRes, topPicksRes, feedRes] =
        await Promise.all([
          getPopularThisWeek(),
          getRecommendations(),
          discoverLists(),
          getSuggestions(10),
          getPopularReviews(10),
          getTopPicks(10),
          getFeed(1, 20),
        ]);
      setPopular(popularRes);
      setRecommendations(recRes.recommendations);
      setHasPersonalization(recRes.hasPersonalization);
      setLists(listsRes);
      setSuggestions(suggestionsRes);
      setPopularReviews(popularReviewsRes);
      setTopPicks(topPicksRes);
      setFeedItems(feedRes.items);
      setFeedPage(feedRes.page);
      setFeedHasMore(feedRes.hasMore);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to load home."));
    }
  }, []);

  const loadMoreFeed = async () => {
    if (feedLoadingMore || !feedHasMore) return;
    setFeedLoadingMore(true);
    try {
      const nextPage = feedPage + 1;
      const feedRes = await getFeed(nextPage, 20);
      setFeedItems((prev) => [...prev, ...feedRes.items]);
      setFeedPage(feedRes.page);
      setFeedHasMore(feedRes.hasMore);
    } finally {
      setFeedLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

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
        <SkeletonRail />
        <SkeletonRail />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.base100 }}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {error && <Text style={styles.error}>{error}</Text>}

      {topPicks.length > 0 && (
        <ContentRail
          title={t("Top Picks")}
          data={topPicks}
          keyExtractor={(item) => `${item.content.type}-${item.content.id}`}
          emptyText=""
          renderItem={(item) => <TopPickCard pick={item} />}
        />
      )}

      <ContentRail
        title={t("Popular This Week")}
        data={popular}
        keyExtractor={(item) => `${item.content.type}-${item.content.id}`}
        emptyText={t("Nothing popular yet this week.")}
        renderItem={(item) => (
          <ContentCard
            id={item.content.id}
            type={item.content.type}
            title={item.content.title}
            posterPath={item.content.poster_path}
            basePath="/home"
            style={styles.railCard}
          />
        )}
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
            {feedHasMore && (
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

      <ContentRail
        title={hasPersonalization ? t("For You") : t("Popular Right Now")}
        subtitle={hasPersonalization ? t("Based on your genre preferences") : undefined}
        data={recommendations}
        keyExtractor={(item) => `${item.contentType}-${item._id}`}
        emptyText={t("No recommendations yet.")}
        renderItem={(item) => (
          <ContentCard
            id={item._id}
            type={item.contentType}
            title={(item.contentType === "movie" ? item.title : item.name) || ""}
            posterPath={item.poster_path}
            year={(item.contentType === "movie" ? item.release_date : item.first_air_date)?.slice(0, 4)}
            voteAverage={item.vote_average}
            basePath="/home"
            style={styles.railCard}
          />
        )}
      />

      <ContentRail
        title={t("Discover Lists")}
        data={lists}
        keyExtractor={(item) => item._id}
        emptyText={t("No public lists to discover yet.")}
        renderItem={(item) => (
          <DiscoverListCard list={item} onPress={() => router.push(`/home/lists/${item._id}`)} />
        )}
      />

      {popularReviews.length > 0 && (
        <ContentRail
          title={t("Popular Reviews")}
          data={popularReviews}
          keyExtractor={(item) => item._id}
          emptyText=""
          renderItem={(item) => <PopularReviewCard review={item} />}
        />
      )}

      <ContentRail
        title={t("Suggested Users")}
        data={suggestions}
        keyExtractor={(item) => item._id}
        emptyText={t("No suggestions yet.")}
        renderItem={(item) => <SuggestedUserCard user={item} />}
      />
    </ScrollView>
  );
}

