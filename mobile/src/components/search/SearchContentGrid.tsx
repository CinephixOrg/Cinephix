import { useCallback, useEffect, useState, useMemo } from "react";
import { View, FlatList, ActivityIndicator, Text, StyleSheet, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { getMovies, getSeries, type ContentFilters } from "../../api/contentService";
import { MOVIE_GENRE_OPTIONS, SERIES_GENRE_OPTIONS } from "../../constants/contentGenreIds";
import MiniContentCard from "../MiniContentCard";
import ContentFilterPanel from "../ContentFilterPanel";
import { SkeletonGrid, SkeletonPosterCard } from "../Skeleton";
import type { ContentType, Movie, Series } from "../../types";
import { useTheme } from "../../context/ThemeContext";

const GRID_COLUMNS = 4;
const GRID_GAP = 4;
const GRID_PADDING = 16;

interface Props {
  contentType: ContentType;
  query: string;
  showFilters: boolean;
}

// Films/Series tabs of the Search page — same underlying browse/search call
// (getMovies/getSeries, live-as-you-type against the title param, default
// sort already popularity-based server-side with no query, plus the same
// year/genre filters the old movies/series tabs had) as before, retargeted
// onto a denser grid (MiniContentCard, now with its title shown) than the
// old 2-column ContentCard layout.
export default function SearchContentGrid({ contentType, query, showFilters }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = (screenWidth - GRID_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
  const styles = useMemo(
    () =>
      StyleSheet.create({
        list: { paddingHorizontal: GRID_PADDING, paddingBottom: 24, paddingTop: 12 },
        error: { color: colors.error, textAlign: "center", marginBottom: 8 },
        empty: { textAlign: "center", color: colors.placeholder, marginTop: 40 },
      }),
    [colors]
  );

  const [items, setItems] = useState<(Movie | Series)[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  // Distinguishes the very first load (nothing on screen yet — worth a
  // full skeleton placeholder) from every later reload triggered by a
  // filter/query change (the grid + filter panel are already visible and
  // should stay put, not unmount into a full-page skeleton on every tap).
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const toggleYear = (year: string) =>
    setSelectedYears((prev) => (prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]));
  const toggleGenre = (id: number) =>
    setSelectedGenres((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));

  const filters: ContentFilters = { years: selectedYears, genres: selectedGenres };

  const loadPage = useCallback(
    async (pageNum: number, append: boolean) => {
      try {
        const { items: fetched, pagination } =
          contentType === "movie"
            ? await getMovies(pageNum, 24, query || undefined, filters)
            : await getSeries(pageNum, 24, query || undefined, filters);
        setItems((prev) => (append ? [...prev, ...fetched] : fetched));
        setHasMore(pagination ? pageNum < pagination.pages : fetched.length > 0);
        setError(null);
      } catch (e: any) {
        setError(e?.response?.data?.message || t("Failed to load content."));
      }
    },
    [contentType, query, selectedYears, selectedGenres]
  );

  useEffect(() => {
    setLoading(true);
    setPage(1);
    loadPage(1, false).finally(() => {
      setLoading(false);
      setHasLoadedOnce(true);
    });
  }, [loadPage]);

  const loadMore = async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    await loadPage(nextPage, true);
    setPage(nextPage);
    setLoadingMore(false);
  };

  if (loading && !hasLoadedOnce) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.base100 }}>
        <SkeletonGrid count={18} columns={3} renderItem={() => <SkeletonPosterCard />} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.base100 }}
      data={items}
      keyExtractor={(item) => item._id}
      numColumns={GRID_COLUMNS}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <>
          {error && <Text style={styles.error}>{error}</Text>}
          {showFilters && (
            <ContentFilterPanel
              genreOptions={contentType === "movie" ? MOVIE_GENRE_OPTIONS : SERIES_GENRE_OPTIONS}
              selectedYears={selectedYears}
              onToggleYear={toggleYear}
              selectedGenres={selectedGenres}
              onToggleGenre={toggleGenre}
            />
          )}
          {/* Filter/query change refetch — panel and existing cards stay
              mounted (no full-page skeleton), just a small in-place cue. */}
          {loading && <ActivityIndicator style={{ marginBottom: 12 }} color={colors.primary} />}
        </>
      }
      renderItem={({ item, index }) => (
        <MiniContentCard
          id={item._id}
          type={contentType}
          posterPath={item.poster_path}
          title={contentType === "movie" ? (item as Movie).title : (item as Series).name}
          basePath="/search"
          style={{
            width: cardWidth,
            marginBottom: 12,
            marginRight: (index + 1) % GRID_COLUMNS === 0 ? 0 : GRID_GAP,
          }}
        />
      )}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={<Text style={styles.empty}>{t("No results found.")}</Text>}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null}
    />
  );
}
