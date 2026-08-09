import { useCallback, useEffect, useState } from "react";
import {
  View,
  FlatList,
  ActivityIndicator,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { getWatchlist } from "../../../src/api/watchlistService";
import { getMovieById, getSeriesById } from "../../../src/api/contentService";
import ContentCard from "../../../src/components/ContentCard";
import { SkeletonGrid, SkeletonPosterCard } from "../../../src/components/Skeleton";
import type { ContentType, Movie, Series } from "../../../src/types";
import { colors } from "../../../src/theme/colors";

interface HydratedItem {
  id: string;
  type: ContentType;
  content: Movie | Series;
}

export default function WatchlistScreen() {
  const { t } = useTranslation();
  const [items, setItems] = useState<HydratedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const watchlist = await getWatchlist();
      const hydrated = await Promise.all(
        watchlist.map(async (w) => {
          const content =
            w.itemType === "movie" ? await getMovieById(w.itemId) : await getSeriesById(w.itemId);
          return { id: w.itemId, type: w.itemType, content };
        })
      );
      setItems(hydrated);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to load watchlist."));
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
      <ScrollView style={{ backgroundColor: colors.base100 }} contentContainerStyle={styles.list}>
        <SkeletonGrid count={6} columns={2} renderItem={() => <SkeletonPosterCard />} />
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.base100 }}>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={items}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        renderItem={({ item }) => (
          <ContentCard
            id={item.id}
            type={item.type}
            title={item.type === "movie" ? (item.content as Movie).title : (item.content as Series).name}
            posterPath={item.content.poster_path}
            year={(item.type === "movie"
              ? (item.content as Movie).release_date
              : (item.content as Series).first_air_date
            )?.slice(0, 4)}
            voteAverage={item.content.vote_average}
            basePath="/watchlist"
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>{t("Your watchlist is empty.")}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1 },
  row: { justifyContent: "space-between" },
  error: { color: colors.error, textAlign: "center", marginTop: 8 },
  empty: { textAlign: "center", color: colors.placeholder, marginTop: 40 },
});
