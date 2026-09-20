import { useCallback, useEffect, useState, useMemo } from "react";
import { View, FlatList, ActivityIndicator, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { getPopularListsPaginated, type ListMode } from "../../api/listService";
import DiscoverListCard from "../DiscoverListCard";
import SlidingUnderlineTabs from "../SlidingUnderlineTabs";
import { SkeletonRail } from "../Skeleton";
import type { DiscoverListItem } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { useWithoutBlocked } from "../../hooks/useBlocked";

const listOwner = (list: DiscoverListItem) => list.owner?._id;

const PAGE_LIMIT = 20;

// Discover's Popular Lists "See all" page — same All/Friends/Liked filter
// (SlidingUnderlineTabs) as every other "See all" page in this app now
// uses, replacing the old fixed two-section (Friends/Popular, no
// pagination, a different card) version. Card is DiscoverListCard now (was
// SearchListCard, a real mismatch caught live — SearchListCard is Search's
// own result card: no tier ring/gradient username, a Shares-style Premium
// gold box border that's supposed to be post-only, owner row above the
// title rather than beside it. DiscoverListCard is what ListsSwiper.tsx's
// own home-page rail already uses; swapping to it here is what actually
// makes this page match that rail, direct ask).
export default function ListsSection() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.base100 },
        // DiscoverListCard has no side margin of its own (ListsSwiper.tsx's
        // own comment on it — its usual homes supply that from outside),
        // unlike SearchListCard's self-contained marginHorizontal — this
        // page's own ScrollView/FlatList padding is that outside source.
        list: { paddingVertical: 16, paddingBottom: 24, paddingHorizontal: 16 },
        error: { color: colors.error, textAlign: "center", marginBottom: 8 },
        empty: { color: colors.placeholder, fontSize: 13, textAlign: "center", marginTop: 24 },
        skeletonWrap: { paddingHorizontal: 16, paddingTop: 16 },
      }),
    [colors]
  );

  const [mode, setMode] = useState<ListMode>("all");
  const [lists, setLists] = useState<DiscoverListItem[]>([]);
  const visibleLists = useWithoutBlocked(lists, listOwner);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getPopularListsPaginated(1, PAGE_LIMIT, undefined, undefined, mode);
      setLists(res.items);
      setHasMore(res.hasMore);
      setPage(1);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to load home."));
    }
  }, [t, mode]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const loadMore = async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await getPopularListsPaginated(nextPage, PAGE_LIMIT, undefined, undefined, mode);
      setLists((prev) => [...prev, ...res.items]);
      setHasMore(res.hasMore);
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  };

  const emptyText =
    mode === "friends" ? t("No public lists from people you follow yet.") : mode === "liked" ? t("You haven't liked any lists yet.") : t("No popular lists yet.");

  return (
    <View style={styles.container}>
      <SlidingUnderlineTabs
        tabs={[
          { key: "all", label: t("All") },
          { key: "friends", label: t("Friends") },
          { key: "liked", label: t("Liked") },
        ]}
        activeKey={mode}
        onChange={(key) => setMode(key as ListMode)}
      />
      {loading ? (
        <View style={styles.skeletonWrap}>
          <SkeletonRail />
        </View>
      ) : (
        <FlatList
          style={styles.container}
          data={visibleLists}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
          renderItem={({ item }) => (
            <DiscoverListCard list={item} onPress={() => router.push(`/home/lists/${item._id}` as any)} basePath="/home" />
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null}
        />
      )}
    </View>
  );
}
