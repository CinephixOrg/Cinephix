import { useCallback, useState } from "react";
import { ScrollView, RefreshControl, Text, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { getPopularThisWeek, getRecommendations } from "../../../src/api/feedService";
import { discoverLists } from "../../../src/api/listService";
import ContentCard from "../../../src/components/ContentCard";
import ContentRail from "../../../src/components/ContentRail";
import DiscoverListCard from "../../../src/components/DiscoverListCard";
import { SkeletonRail } from "../../../src/components/Skeleton";
import type { DiscoverListItem, PopularThisWeekItem, RecommendationItem } from "../../../src/types";
import { colors } from "../../../src/theme/colors";

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [popular, setPopular] = useState<PopularThisWeekItem[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [hasPersonalization, setHasPersonalization] = useState(false);
  const [lists, setLists] = useState<DiscoverListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [popularRes, recRes, listsRes] = await Promise.all([
        getPopularThisWeek(),
        getRecommendations(),
        discoverLists(),
      ]);
      setPopular(popularRes);
      setRecommendations(recRes.recommendations);
      setHasPersonalization(recRes.hasPersonalization);
      setLists(listsRes);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to load home."));
    }
  }, []);

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 16, flexGrow: 1 },
  railCard: { width: 120, marginRight: 12, marginBottom: 0 },
  error: { color: colors.error, textAlign: "center", marginBottom: 8, paddingHorizontal: 16 },
});
