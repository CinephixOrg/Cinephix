import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Image, FlatList, ActivityIndicator, RefreshControl, StyleSheet, useWindowDimensions } from "react-native";
import Pressable from "./common/TapSafePressable";
import { usePathname, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { getSimilarContent, type SimilarContentItem } from "../api/contentService";
import type { ContentType } from "../types";
import { useTheme } from "../context/ThemeContext";

const PAGE_LIMIT = 30;
const POSTER_BASE = "https://image.tmdb.org/t/p/w185";
const COLUMNS = 4;
const GRID_GAP = 8;

interface Props {
  contentType: ContentType;
  contentId: string;
}

// Content Detail's "Similar Movies/Series" rail's own See All page — same
// ranked-by-genre-overlap data as the rail (getSimilarContent), just
// paginated into a real grid instead of a horizontal scroll. 4-5 posters
// per row, direct ask — COLUMNS picks 4 on a normal phone width and lets
// each poster's own computed width grow a touch on a wider screen rather
// than hardcoding 5 (a fixed 5-across reads cramped on a narrow device).
export default function ContentSimilarSection({ contentType, contentId }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const { width: screenWidth } = useWindowDimensions();

  // Same computation ContentDetailScreen.tsx's own basePath uses — this
  // page is nested one level deeper (.../content/:type/:id/similar) under
  // the same per-stack route group, so the leading segment is identically
  // meaningful here.
  const basePath = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments[0] === "user" && segments[1]) return `/user/${segments[1]}`;
    return segments[0] ? `/${segments[0]}` : "/home";
  }, [pathname]);

  const posterWidth = (screenWidth - 16 * 2 - GRID_GAP * (COLUMNS - 1)) / COLUMNS;
  const posterHeight = posterWidth * 1.5;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.base100 },
        list: { padding: 16, gap: GRID_GAP },
        row: { gap: GRID_GAP },
        poster: { width: posterWidth, height: posterHeight, borderRadius: 8, backgroundColor: colors.base300, overflow: "hidden" },
        empty: { color: colors.placeholder, fontSize: 13, textAlign: "center", marginTop: 24 },
        skeletonWrap: { padding: 16, flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP },
        skeleton: { width: posterWidth, height: posterHeight, borderRadius: 8, backgroundColor: colors.base300 },
      }),
    [colors, posterWidth, posterHeight]
  );

  const [items, setItems] = useState<SimilarContentItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await getSimilarContent(contentType, contentId, 1, PAGE_LIMIT);
    setItems(res.items);
    setPage(1);
    setHasMore(res.hasMore);
  }, [contentType, contentId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await getSimilarContent(contentType, contentId, nextPage, PAGE_LIMIT);
      setItems((prev) => [...prev, ...res.items]);
      setPage(nextPage);
      setHasMore(res.hasMore);
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.skeletonWrap}>
          {Array.from({ length: 12 }, (_, i) => (
            <View key={i} style={styles.skeleton} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={items}
      keyExtractor={(item) => item.id}
      numColumns={COLUMNS}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      renderItem={({ item }) => (
        <Pressable style={styles.poster} onPress={() => router.push(`${basePath}/content/${item.type}/${item.id}` as any)}>
          {item.poster_path && <Image source={{ uri: `${POSTER_BASE}${item.poster_path}` }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
        </Pressable>
      )}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={<Text style={styles.empty}>{t("No similar titles found.")}</Text>}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null}
    />
  );
}
