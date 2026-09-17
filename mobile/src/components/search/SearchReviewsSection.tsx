import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { View, FlatList, ActivityIndicator, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { SkeletonListRow } from "../Skeleton";
import { getPopularReviews, type ReviewSort } from "../../api/reviewService";
import SearchReviewCard from "./SearchReviewCard";
import FilterBottomSheet from "./FilterBottomSheet";
import SortOptionsList from "./SortOptionsList";
import type { PopularReview } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

const DEFAULT_SORT: ReviewSort = "liked";
const PAGE_LIMIT = 15;
const RATING_OPTIONS = [
  { min: null as number | null, max: null as number | null, label: "Any" },
  { min: 8, max: 10, label: "8-10" },
  { min: 5, max: 7, label: "5-7" },
  { min: 1, max: 4, label: "1-4" },
];

interface Props {
  query: string;
  showFilters: boolean;
  onCloseFilters: () => void;
  onActiveFilterChange: (active: boolean) => void;
}

// Reviews tab of the Search page — matches ShareCard.tsx's own review-post
// box design (via the new SearchReviewCard, not the pre-existing
// ReviewFeedCard also used elsewhere) with the reviewer's profile and like
// count folded into the box, and a tap opening the same kind of in-place
// modal ShareCard uses for a long review instead of navigating away.
// Nothing shows until the viewer actually searches or picks a filter — was:
// a full popularity-sorted browse list, visible before any input at all.
// Was also a fixed 30-result ScrollView with no way to reach anything past
// that — switched to FlatList + real pagination (getPopularReviews now
// returns page/hasMore), matching Films/Series' own pattern.
export default function SearchReviewsSection({ query, showFilters, onCloseFilters, onActiveFilterChange }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        list: { paddingVertical: 4, paddingBottom: 24 },
        error: { color: colors.error, textAlign: "center", marginBottom: 8, marginHorizontal: 16 },
        empty: { textAlign: "center", color: colors.placeholder, marginTop: 60, marginHorizontal: 32, fontSize: 14, lineHeight: 20 },
        chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
        chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: colors.border },
        chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
        chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.baseContent },
        chipTextActive: { fontFamily: fonts.bold, color: colors.primaryContent },
        sectionLabel: {
          fontFamily: fonts.bold,
          fontSize: 12,
          color: colors.placeholder,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          marginBottom: 10,
        },
      }),
    [colors]
  );

  const [reviews, setReviews] = useState<PopularReview[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<ReviewSort>(DEFAULT_SORT);
  const [ratingRangeIndex, setRatingRangeIndex] = useState(0);
  const ratingRange = RATING_OPTIONS[ratingRangeIndex];

  const hasActiveFilters = sort !== DEFAULT_SORT || ratingRangeIndex !== 0;
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
        const result = await getPopularReviews(pageNum, PAGE_LIMIT, undefined, query || undefined, sort, ratingRange.min, ratingRange.max);
        if (requestIdRef.current !== requestId) return;
        setReviews((prev) => (append ? [...prev, ...result.items] : result.items));
        setHasMore(result.hasMore);
        setError(null);
      } catch (e: any) {
        if (requestIdRef.current !== requestId) return;
        setError(e?.response?.data?.message || t("Failed to load reviews."));
      }
    },
    [query, sort, ratingRange.min, ratingRange.max]
  );

  useEffect(() => {
    if (!hasSearchCriteria) {
      setReviews([]);
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
      onClear={() => {
        setSort(DEFAULT_SORT);
        setRatingRangeIndex(0);
      }}
      hasActiveFilters={hasActiveFilters}
      title={t("Filter Reviews")}
    >
      <View style={{ marginBottom: 22 }}>
        <Text style={styles.sectionLabel}>{t("Rating")}</Text>
        <View style={styles.chipsWrap}>
          {RATING_OPTIONS.map((option, i) => (
            <Pressable key={option.label} style={[styles.chip, ratingRangeIndex === i && styles.chipActive]} onPress={() => setRatingRangeIndex(i)}>
              <Text style={[styles.chipText, ratingRangeIndex === i && styles.chipTextActive]}>{t(option.label)}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <SortOptionsList
        label={t("Sort By")}
        value={sort}
        onChange={setSort}
        options={[
          { value: "liked", label: t("Most Liked") },
          { value: "rating", label: t("Highest Rated") },
          { value: "newest", label: t("Newest") },
        ]}
      />
    </FilterBottomSheet>
  );

  if (!hasSearchCriteria) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.base100, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="chatbox-ellipses-outline" size={40} color={colors.placeholder} />
        <Text style={styles.empty}>{t("Search any review you want to find it.")}</Text>
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
        data={reviews}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            {error && <Text style={styles.error}>{error}</Text>}
            {loading && <ActivityIndicator style={{ marginBottom: 12 }} color={colors.primary} />}
          </>
        }
        renderItem={({ item }) => <SearchReviewCard review={item} basePath="/search" />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={<Text style={styles.empty}>{t("No results found.")}</Text>}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null}
      />
      {filterSheet}
    </>
  );
}
