import { useCallback, useEffect, useState } from "react";
import { View, FlatList, ActivityIndicator, Text, ScrollView, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { getSeries } from "../../../src/api/contentService";
import ContentCard from "../../../src/components/ContentCard";
import SearchBar from "../../../src/components/SearchBar";
import { SkeletonGrid, SkeletonPosterCard } from "../../../src/components/Skeleton";
import type { Series } from "../../../src/types";
import { colors } from "../../../src/theme/colors";

export default function SeriesScreen() {
  const { t } = useTranslation();
  const [series, setSeries] = useState<Series[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (pageNum: number, searchQuery: string, append: boolean) => {
    try {
      const { items, pagination } = await getSeries(pageNum, 18, searchQuery || undefined);
      setSeries((prev) => (append ? [...prev, ...items] : items));
      setHasMore(pagination ? pageNum < pagination.pages : items.length > 0);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to load series."));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    loadPage(1, query, false).finally(() => setLoading(false));
  }, [query, loadPage]);

  const loadMore = async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    await loadPage(nextPage, query, true);
    setPage(nextPage);
    setLoadingMore(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.base100 }}>
      <SearchBar placeholder={t("Search series...")} onChangeQuery={setQuery} />

      {error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <ScrollView contentContainerStyle={styles.list}>
          <SkeletonGrid count={6} columns={2} renderItem={() => <SkeletonPosterCard />} />
        </ScrollView>
      ) : (
        <FlatList
          data={series}
          keyExtractor={(item) => item._id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ContentCard
              id={item._id}
              type="series"
              title={item.name}
              posterPath={item.poster_path}
              year={item.first_air_date?.slice(0, 4)}
              voteAverage={item.vote_average}
              basePath="/series"
            />
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={<Text style={styles.empty}>{t("No series found.")}</Text>}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  row: { justifyContent: "space-between" },
  error: { color: colors.error, textAlign: "center", marginBottom: 8 },
  empty: { textAlign: "center", color: colors.placeholder, marginTop: 40 },
});
