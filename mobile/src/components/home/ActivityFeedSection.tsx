import { useCallback, useEffect, useState, useMemo } from "react";
import { View, Text, FlatList, ActivityIndicator, RefreshControl, StyleSheet } from "react-native";
import Pressable from "../common/TapSafePressable";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { getNetworkActivity } from "../../api/feedService";
import ActivityRow from "../ActivityRow";
import { SkeletonBox } from "../Skeleton";
import type { ActivityEvent } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { useWithoutBlocked } from "../../hooks/useBlocked";

const activityActor = (event: ActivityEvent) => event.actor?._id;

const PAGE_LIMIT = 20;

// Every category getNetworkActivity actually generates (activityController.
// js's own event-type arrays) — "all" (default) is unfiltered.
const CATEGORIES = ["all", "rated", "reviewed", "favorited", "list_item_added", "towatch_added", "followed", "shared", "podium"] as const;
type Category = (typeof CATEGORIES)[number];

// Full, independently-paginated version of ActivitySection.tsx's Discover
// preview — same infinite-scroll shape ReviewsSection.tsx already uses
// (page/hasMore/loadMore via onEndReached), reused rather than reinvented.
// Gained a category filter, direct ask — top-right, listing every category
// right below it once tapped (getNetworkActivity's own new `category` param).
export default function ActivityFeedSection() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.base100 },
        list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
        divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
        empty: { color: colors.placeholder, fontSize: 13, textAlign: "center", marginTop: 24 },
        error: { color: colors.error, textAlign: "center", marginBottom: 8 },
        skeletonWrap: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },
        // Top-right filter button, direct ask ("sağ üste bir filtre
        // koyalım"). position:"relative" anchor for the dropdown below —
        // same reliable technique List Detail's own filter button uses,
        // not a native header button (those live outside this component's
        // own view tree, no reliable way to measure their position for a
        // dropdown anchored right below them — see ReviewWriteScreen.tsx's
        // own doc comment for the full story of that exact pitfall).
        filterBar: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 16, paddingTop: 12 },
        filterButtonWrap: { position: "relative" },
        filterButton: { flexDirection: "row", alignItems: "center", gap: 4 },
        filterButtonText: { fontFamily: "System", fontSize: 13, color: colors.baseContent },
        filterMenuBackdrop: { position: "absolute", top: -2000, left: -2000, right: -2000, bottom: -2000 },
        filterMenu: {
          position: "absolute",
          top: "100%",
          right: 0,
          marginTop: 6,
          backgroundColor: colors.base200,
          borderRadius: 10,
          overflow: "hidden",
          minWidth: 170,
          maxHeight: 320,
          elevation: 4,
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
        },
        filterMenuRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 11 },
        filterMenuRowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
        filterMenuRowText: { fontSize: 13, color: colors.baseContent },
        filterMenuRowTextActive: { color: colors.primary, fontWeight: "700" },
      }),
    [colors]
  );

  const [category, setCategory] = useState<Category>("all");
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [items, setItems] = useState<ActivityEvent[]>([]);
  const visibleItems = useWithoutBlocked(items, activityActor);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryLabel = (c: Category) =>
    ({
      all: t("All"),
      rated: t("Rated"),
      reviewed: t("Reviewed"),
      favorited: t("Favorited"),
      list_item_added: t("Added to Lists"),
      towatch_added: t("To Watch"),
      followed: t("Followed"),
      shared: t("Shared"),
      podium: t("Podium"),
    }[c]);

  const load = useCallback(async () => {
    try {
      const res = await getNetworkActivity(1, PAGE_LIMIT, category === "all" ? undefined : category);
      setItems(res.items);
      setHasMore(res.hasMore);
      setPage(1);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to load home."));
    }
  }, [t, category]);

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
      const res = await getNetworkActivity(nextPage, PAGE_LIMIT, category === "all" ? undefined : category);
      setItems((prev) => [...prev, ...res.items]);
      setHasMore(res.hasMore);
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  };

  // "content" in e narrows for the majority of types that carry a real
  // content id; the newer content-less types (followed/shared/podium) each
  // fall back to whatever *else* actually distinguishes one of them from
  // another instance of the same type — a bare `${type}-${actor}-${createdAt}`
  // isn't unique enough on its own for e.g. two "podium" entries for the
  // same actor in different categories, which otherwise share an identical
  // "now" timestamp (see activityController.js's own getFollowedPodiumEvents).
  const eventKey = (e: ActivityEvent) => {
    const distinguisher =
      "content" in e ? e.content.id : e.type === "followed" ? e.targetUser?._id ?? "" : e.type === "shared" ? e.shareType : `${e.category}-${e.rank}`;
    return `${e.type}-${e.actor._id}-${e.createdAt}-${distinguisher}`;
  };

  const filterBar = (
    <View style={styles.filterBar}>
      <View style={styles.filterButtonWrap}>
        <Pressable style={styles.filterButton} onPress={() => setFilterMenuVisible((v) => !v)} hitSlop={8}>
          <Ionicons name="filter" size={16} color={category !== "all" ? colors.primary : colors.baseContent} />
          <Text style={[styles.filterButtonText, category !== "all" && { color: colors.primary }]}>{categoryLabel(category)}</Text>
        </Pressable>
        {filterMenuVisible && (
          <>
            <Pressable style={styles.filterMenuBackdrop} onPress={() => setFilterMenuVisible(false)} />
            <FlatList
              style={styles.filterMenu}
              data={CATEGORIES}
              keyExtractor={(c) => c}
              ItemSeparatorComponent={() => <View style={styles.filterMenuRowDivider} />}
              renderItem={({ item: c }) => (
                <Pressable
                  style={styles.filterMenuRow}
                  onPress={() => {
                    setCategory(c);
                    setFilterMenuVisible(false);
                  }}
                >
                  <Text style={[styles.filterMenuRowText, category === c && styles.filterMenuRowTextActive]}>{categoryLabel(c)}</Text>
                  {category === c && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                </Pressable>
              )}
            />
          </>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {filterBar}
        <View style={styles.skeletonWrap}>
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonBox key={i} width="100%" height={60} borderRadius={8} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {filterBar}
      <FlatList
        style={styles.container}
        data={visibleItems}
        keyExtractor={eventKey}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
        renderItem={({ item }) => <ActivityRow event={item} basePath="/home" />}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={<Text style={styles.empty}>{t("No activity yet.")}</Text>}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null}
      />
    </View>
  );
}
