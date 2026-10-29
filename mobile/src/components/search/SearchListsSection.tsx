import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { View, FlatList, ScrollView, ActivityIndicator, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { SkeletonListRow } from "../Skeleton";
import { getPopularListsPaginated, type ListSort } from "../../api/listService";
import SearchListCard from "./SearchListCard";
import FilterBottomSheet from "./FilterBottomSheet";
import SortOptionsList from "./SortOptionsList";
import SuggestedListsSection from "./SuggestedListsSection";
import type { DiscoverListItem } from "../../types";
import { useTheme } from "../../context/ThemeContext";

const DEFAULT_SORT: ListSort = "liked";
const PAGE_LIMIT = 20;

interface Props {
  query: string;
  showFilters: boolean;
  onCloseFilters: () => void;
  onActiveFilterChange: (active: boolean) => void;
}

// Lists tab of the Search page — matches ShareCard.tsx's own list-post box
// design (via the new SearchListCard, not the pre-existing DiscoverListCard
// also used elsewhere) with the owner's profile and like/view counts folded
// into the box. Nothing shows until the viewer actually searches or picks a
// sort — was: a full popularity-sorted browse list, visible before any
// input at all. Was also a fixed 30-result ScrollView with no way to reach
// anything past that — switched to FlatList + real pagination
// (getPopularListsPaginated), matching Films/Series' own pattern.
export default function SearchListsSection({ query, showFilters, onCloseFilters, onActiveFilterChange }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        list: { paddingVertical: 4, paddingBottom: 24 },
        error: { color: colors.error, textAlign: "center", marginBottom: 8, marginHorizontal: 16 },
        empty: { textAlign: "center", color: colors.placeholder, marginTop: 60, marginHorizontal: 32, fontSize: 14, lineHeight: 20 },
      }),
    [colors]
  );

  const [lists, setLists] = useState<DiscoverListItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<ListSort>(DEFAULT_SORT);

  const hasActiveFilters = sort !== DEFAULT_SORT;
  const onActiveFilterChangeRef = useRef(onActiveFilterChange);
  onActiveFilterChangeRef.current = onActiveFilterChange;
  useEffect(() => {
    onActiveFilterChangeRef.current(hasActiveFilters);
  }, [hasActiveFilters]);

  const hasSearchCriteria = query.trim().length > 0 || hasActiveFilters;

  // Same out-of-order-response guard as SearchContentRows.tsx — see its own
  // comment for the full reasoning.
  const requestIdRef = useRef(0);

  const loadPage = useCallback(
    async (pageNum: number, append: boolean, requestId: number) => {
      try {
        const result = await getPopularListsPaginated(pageNum, PAGE_LIMIT, query || undefined, sort);
        if (requestIdRef.current !== requestId) return;
        setLists((prev) => (append ? [...prev, ...result.items] : result.items));
        setHasMore(result.hasMore);
        setError(null);
      } catch (e: any) {
        if (requestIdRef.current !== requestId) return;
        setError(e?.response?.data?.message || t("Failed to load lists."));
      }
    },
    [query, sort]
  );

  useEffect(() => {
    if (!hasSearchCriteria) {
      setLists([]);
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

  const filterSheet = (
    <FilterBottomSheet
      visible={showFilters}
      onClose={onCloseFilters}
      onClear={() => setSort(DEFAULT_SORT)}
      hasActiveFilters={hasActiveFilters}
      title={t("Sort Lists")}
    >
      <SortOptionsList
        label={t("Sort By")}
        value={sort}
        onChange={setSort}
        options={[
          { value: "liked", label: t("Most Liked") },
          { value: "items", label: t("Most Items") },
          { value: "newest", label: t("Newest") },
        ]}
      />
    </FilterBottomSheet>
  );

  if (!hasSearchCriteria) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.base100 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          <SuggestedListsSection />
        </ScrollView>
        {filterSheet}
      </View>
    );
  }

  if (loading && !hasLoadedOnce) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.base100, paddingHorizontal: 16, paddingTop: 4 }}>
        {Array.from({ length: 5 }, (_, i) => <SkeletonListRow key={i} />)}
        {filterSheet}
      </View>
    );
  }

  return (
    <>
      <FlatList
        style={{ flex: 1, backgroundColor: colors.base100 }}
        data={lists}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            {error && <Text style={styles.error}>{error}</Text>}
            {loading && <ActivityIndicator style={{ marginBottom: 12 }} color={colors.primary} />}
          </>
        }
        renderItem={({ item }) => (
          <SearchListCard list={item} onPress={() => router.push(`/search/lists/${item._id}` as any)} basePath="/search" />
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={<Text style={styles.empty}>{t("No results found.")}</Text>}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null}
      />
      {filterSheet}
    </>
  );
}
