import { useCallback, useEffect, useState } from "react";
import { View, FlatList, ActivityIndicator, Text, StyleSheet } from "react-native";
import { getMovies } from "../../../src/api/contentService";
import ContentCard from "../../../src/components/ContentCard";
import SearchBar from "../../../src/components/SearchBar";
import type { Movie } from "../../../src/types";
import { colors } from "../../../src/theme/colors";

export default function MoviesScreen() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (pageNum: number, searchQuery: string, append: boolean) => {
    try {
      const { items, pagination } = await getMovies(pageNum, 18, searchQuery || undefined);
      setMovies((prev) => (append ? [...prev, ...items] : items));
      setHasMore(pagination ? pageNum < pagination.pages : items.length > 0);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load movies.");
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
      <SearchBar placeholder="Search movies" onChangeQuery={setQuery} />

      {error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={movies}
          keyExtractor={(item) => item._id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ContentCard
              id={item._id}
              type="movie"
              title={item.title}
              posterPath={item.poster_path}
              year={item.release_date?.slice(0, 4)}
              voteAverage={item.vote_average}
              basePath="/movies"
            />
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={<Text style={styles.empty}>No movies found.</Text>}
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
