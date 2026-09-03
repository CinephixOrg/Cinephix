import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, RefreshControl, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { getListsForContent } from "../api/listService";
import DiscoverListCard from "./DiscoverListCard";
import { SkeletonListRow } from "./Skeleton";
import type { ContentType, DiscoverListItem } from "../types";
import { useTheme } from "../context/ThemeContext";

const PAGE_LIMIT = 20;

interface Props {
  contentType: ContentType;
  contentId: string;
  basePath: "/home" | "/search" | "/socials" | "/watchlist" | "/to-watch" | "/lists" | "/profile" | `/user/${string}`;
}

// Content Detail's "Lists" stat button target — every public list that
// contains this specific movie/series. Same infinite-scroll shape
// ReviewsSection.tsx/ActivityFeedSection.tsx already use, and the same
// `DiscoverListCard` this app already uses for vertical list-browsing
// (ListsSection.tsx/SearchListsSection.tsx) — reused, not redesigned, per
// direct ask ("aynı tasarım şeklinde burda sıralansın").
export default function ContentListsSection({ contentType, contentId, basePath }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.base100 },
        list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
        empty: { color: colors.placeholder, fontSize: 13, textAlign: "center", marginTop: 24 },
        error: { color: colors.error, textAlign: "center", marginBottom: 8 },
        skeletonWrap: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
      }),
    [colors]
  );

  const [items, setItems] = useState<DiscoverListItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getListsForContent(contentType, contentId, 1, PAGE_LIMIT);
      setItems(res.lists);
      setHasMore(res.hasMore);
      setPage(1);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to load home."));
    }
  }, [contentType, contentId, t]);

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
      const res = await getListsForContent(contentType, contentId, nextPage, PAGE_LIMIT);
      setItems((prev) => [...prev, ...res.lists]);
      setHasMore(res.hasMore);
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.skeletonWrap}>
          {[0, 1, 2].map((i) => (
            <SkeletonListRow key={i} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={items}
      keyExtractor={(list) => list._id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
      renderItem={({ item }) => (
        // A specific list's own detail page (lists/[id].tsx) isn't
        // duplicated to every tab the way content/[type]/[id].tsx is
        // (only home/search/profile/lists have it) — always opening
        // Home's copy here is a deliberate, small compromise rather than
        // a broken push from the tabs that don't have their own copy.
        <DiscoverListCard list={item} basePath={basePath} onPress={() => router.push(`/home/lists/${item._id}` as any)} />
      )}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={<Text style={styles.empty}>{t("No public lists to discover yet.")}</Text>}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null}
    />
  );
}
