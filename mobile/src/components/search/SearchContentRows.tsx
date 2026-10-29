import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { View, FlatList, ScrollView, ActivityIndicator, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { SkeletonSearchResultRow } from "../Skeleton";
import { getMovies, getSeries, type ContentFilters } from "../../api/contentService";
import { MOVIE_GENRE_OPTIONS, SERIES_GENRE_OPTIONS } from "../../constants/contentGenreIds";
import SearchContentRow from "./SearchContentRow";
import FilterBottomSheet from "./FilterBottomSheet";
import ContentFilterSheetContent from "./ContentFilterSheetContent";
import SuggestedForYouGrid from "./SuggestedForYouGrid";
import type { ContentType, Movie, Series } from "../../types";
import { useTheme } from "../../context/ThemeContext";

interface Props {
  contentType: ContentType;
  query: string;
  showFilters: boolean;
  onCloseFilters: () => void;
  // Reported whenever this tab's own hasActiveFilters flips — purely so the
  // search bar's filter icon can show a badge for whichever tab is active.
  onActiveFilterChange: (active: boolean) => void;
}

// Films/Series tabs of the Search page. Two direct asks reshaped this:
// nothing shows until the viewer actually searches or picks a filter (was:
// a full popularity-sorted grid, visible before any input at all — read as
// "browse", not "search"); and results render as one-per-row (poster+
// title+year), replacing the old dense 4-column poster grid, matching how
// Lists/Reviews already read as an actual list of distinct results rather
// than a wall of thumbnails.
export default function SearchContentRows({ contentType, query, showFilters, onCloseFilters, onActiveFilterChange }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        list: { paddingVertical: 4, paddingBottom: 24 },
        error: { color: colors.error, textAlign: "center", marginBottom: 8, marginHorizontal: 16 },
        empty: { textAlign: "center", color: colors.placeholder, marginTop: 60, marginHorizontal: 32, fontSize: 14, lineHeight: 20 },
        divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 16 + 52 + 12 },
      }),
    [colors]
  );

  const [items, setItems] = useState<(Movie | Series)[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const toggleYear = (year: string) =>
    setSelectedYears((prev) => (prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]));
  const toggleGenre = (id: number) =>
    setSelectedGenres((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  const hasActiveFilters = selectedYears.length > 0 || selectedGenres.length > 0;
  const clearFilters = () => {
    setSelectedYears([]);
    setSelectedGenres([]);
  };

  const onActiveFilterChangeRef = useRef(onActiveFilterChange);
  onActiveFilterChangeRef.current = onActiveFilterChange;
  useEffect(() => {
    onActiveFilterChangeRef.current(hasActiveFilters);
  }, [hasActiveFilters]);

  const filters: ContentFilters = { years: selectedYears, genres: selectedGenres };
  // A genre/year filter is itself a valid way to browse without typing a
  // title — only truly nothing-to-search-for (no query, no filter) shows
  // the empty state.
  const hasSearchCriteria = query.trim().length > 0 || hasActiveFilters;

  // Guards against out-of-order responses: typing/filtering fires a new
  // request before the previous one necessarily resolves (the SearchBar's
  // own debounce narrows this window but doesn't close it — network timing
  // isn't request-order-guaranteed). Every call to loadPage stamps the
  // request it started with; a response is only applied if it's still the
  // most recent one by the time it resolves, otherwise it's silently
  // dropped instead of clobbering newer, already-correct state. This also
  // covers the sharper version of the same bug: a slow loadMore(page 2)
  // resolving after a fresh criteria change has already reset back to page
  // 1 used to get appended onto the new list, mixing results from two
  // different searches together.
  const requestIdRef = useRef(0);

  const loadPage = useCallback(
    async (pageNum: number, append: boolean, requestId: number) => {
      try {
        const { items: fetched, pagination } =
          contentType === "movie"
            ? await getMovies(pageNum, 24, query || undefined, filters)
            : await getSeries(pageNum, 24, query || undefined, filters);
        if (requestIdRef.current !== requestId) return;
        setItems((prev) => (append ? [...prev, ...fetched] : fetched));
        setHasMore(pagination ? pageNum < pagination.pages : fetched.length > 0);
        setError(null);
      } catch (e: any) {
        if (requestIdRef.current !== requestId) return;
        setError(e?.response?.data?.message || t("Failed to load content."));
      }
    },
    [contentType, query, selectedYears, selectedGenres]
  );

  useEffect(() => {
    if (!hasSearchCriteria) {
      setItems([]);
      setHasLoadedOnce(false);
      return;
    }
    setLoading(true);
    setPage(1);
    const requestId = ++requestIdRef.current;
    loadPage(1, false, requestId).finally(() => {
      if (requestIdRef.current === requestId) {
        setLoading(false);
        setHasLoadedOnce(true);
      }
    });
  }, [loadPage, hasSearchCriteria]);

  const loadMore = async () => {
    if (loadingMore || !hasMore || loading) return;
    const requestId = ++requestIdRef.current;
    setLoadingMore(true);
    const nextPage = page + 1;
    await loadPage(nextPage, true, requestId);
    if (requestIdRef.current === requestId) setPage(nextPage);
    setLoadingMore(false);
  };

  const genreOptions = contentType === "movie" ? MOVIE_GENRE_OPTIONS : SERIES_GENRE_OPTIONS;

  const filterSheet = (
    <FilterBottomSheet
      visible={showFilters}
      onClose={onCloseFilters}
      onClear={clearFilters}
      hasActiveFilters={hasActiveFilters}
      title={contentType === "movie" ? t("Filter Movies") : t("Filter Series")}
    >
      <ContentFilterSheetContent
        genreOptions={genreOptions}
        selectedYears={selectedYears}
        onToggleYear={toggleYear}
        onToggleYears={setSelectedYears}
        selectedGenres={selectedGenres}
        onToggleGenre={toggleGenre}
      />
    </FilterBottomSheet>
  );

  if (!hasSearchCriteria) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.base100 }}>
        {/* Direct ask: this used to be an icon + "Search any movie you want
            to find it." hint, floating alone in an otherwise-blank screen,
            starting well down the page. Removed in favor of just the
            genre-weighted "Suggested for you" pick starting right at the
            top — see SuggestedForYouGrid.tsx. */}
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          <SuggestedForYouGrid contentType={contentType} />
        </ScrollView>
        {filterSheet}
      </View>
    );
  }

  if (loading && !hasLoadedOnce) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.base100 }}>
        {Array.from({ length: 6 }, (_, i) => <SkeletonSearchResultRow key={i} />)}
        {filterSheet}
      </View>
    );
  }

  return (
    <>
      <FlatList
        style={{ flex: 1, backgroundColor: colors.base100 }}
        data={items}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            {error && <Text style={styles.error}>{error}</Text>}
            {loading && <ActivityIndicator style={{ marginBottom: 12 }} color={colors.primary} />}
          </>
        }
        renderItem={({ item }) => (
          <SearchContentRow
            id={item._id}
            type={contentType}
            posterPath={item.poster_path}
            title={contentType === "movie" ? (item as Movie).title : (item as Series).name}
            dateString={contentType === "movie" ? (item as Movie).release_date : (item as Series).first_air_date}
            basePath="/search"
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={<Text style={styles.empty}>{t("No results found.")}</Text>}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null}
      />
      {filterSheet}
    </>
  );
}
