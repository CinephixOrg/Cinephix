import { useCallback, useEffect, useState, useMemo } from "react";
import { View, FlatList, ActivityIndicator, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { getSeries, type ContentFilters } from "../../../src/api/contentService";
import { SERIES_GENRE_OPTIONS } from "../../../src/constants/contentGenreIds";
import ContentCard from "../../../src/components/ContentCard";
import ContentFilterPanel from "../../../src/components/ContentFilterPanel";
import SearchBar from "../../../src/components/SearchBar";
import { SkeletonGrid, SkeletonPosterCard } from "../../../src/components/Skeleton";
import type { Series } from "../../../src/types";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

export default function SeriesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  row: { justifyContent: "space-between" },
  error: { color: colors.error, textAlign: "center", marginBottom: 8 },
  empty: { textAlign: "center", color: colors.placeholder, marginTop: 40 },
  filterToggle: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  filterToggleText: { fontFamily: fonts.medium, color: colors.baseContent, fontSize: 13 },
}), [colors]);
  const { t } = useTranslation();
  const [series, setSeries] = useState<Series[]>([]);
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [hasPoster, setHasPoster] = useState<"" | "yes" | "no">("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleYear = (year: string) =>
    setSelectedYears((prev) => (prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]));
  const toggleGenre = (id: number) =>
    setSelectedGenres((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));

  const loadPage = useCallback(
    async (pageNum: number, searchQuery: string, filters: ContentFilters, append: boolean) => {
      try {
        const { items, pagination } = await getSeries(pageNum, 18, searchQuery || undefined, filters);
        setSeries((prev) => (append ? [...prev, ...items] : items));
        setHasMore(pagination ? pageNum < pagination.pages : items.length > 0);
        setError(null);
      } catch (e: any) {
        setError(e?.response?.data?.message || t("Failed to load series."));
      }
    },
    []
  );

  useEffect(() => {
    setLoading(true);
    setPage(1);
    loadPage(1, query, { years: selectedYears, genres: selectedGenres, hasPoster: hasPoster || undefined }, false).finally(() =>
      setLoading(false)
    );
  }, [query, selectedYears, selectedGenres, hasPoster, loadPage]);

  const loadMore = async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    await loadPage(nextPage, query, { years: selectedYears, genres: selectedGenres, hasPoster: hasPoster || undefined }, true);
    setPage(nextPage);
    setLoadingMore(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.base100 }}>
      <SearchBar placeholder={t("Search series...")} onChangeQuery={setQuery} />

      <Pressable style={styles.filterToggle} onPress={() => setShowFilters((v) => !v)}>
        <Text style={styles.filterToggleText}>{t("⚙️ Filters")}</Text>
      </Pressable>

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
          ListHeaderComponent={
            showFilters ? (
              <ContentFilterPanel
                genreOptions={SERIES_GENRE_OPTIONS}
                selectedYears={selectedYears}
                onToggleYear={toggleYear}
                selectedGenres={selectedGenres}
                onToggleGenre={toggleGenre}
                hasPoster={hasPoster}
                onChangeHasPoster={setHasPoster}
              />
            ) : null
          }
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

