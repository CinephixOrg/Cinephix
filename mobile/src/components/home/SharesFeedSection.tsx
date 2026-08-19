import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator, Animated, Modal, StyleSheet, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { getShareFeed, toggleShareLike } from "../../api/shareService";
import ShareCard from "../ShareCard";
import OnlineFriendsBar from "./OnlineFriendsBar";
import type { Share } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

type SortMode = "recent" | "popular" | "network";
type TypeFilter = "all" | "analysis" | "review" | "recommendation";

const PAGE_LIMIT = 20;
const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: "recent", label: "Recent" },
  { key: "popular", label: "Popular" },
  { key: "network", label: "Network" },
];
const TYPE_OPTIONS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "analysis", label: "Analysis" },
  { key: "review", label: "Review" },
  { key: "recommendation", label: "Recommendation" },
];

// The new Medya feed. Filter bar redesigned as one compact row: a single
// sliding segmented control for Recent/Popular/Network (replaces what used
// to be two separate rows of bordered pills — 7 buttons total, which read
// as cluttered) plus a small icon button that opens the Analysis/Review/
// Recommendation type filter in a lightweight popover instead of a
// permanently-visible 4th row.
export default function SharesFeedSection() {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.base100 },
        filterBlock: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
        filterRow: { flexDirection: "row", alignItems: "center", gap: 10 },
        segmented: {
          flex: 1,
          flexDirection: "row",
          backgroundColor: colors.base200,
          borderRadius: 10,
          padding: 3,
          position: "relative",
        },
        segmentIndicator: {
          position: "absolute",
          top: 3,
          bottom: 3,
          left: 3,
          borderRadius: 8,
          backgroundColor: colors.primary,
        },
        segment: { flex: 1, paddingVertical: 8, alignItems: "center", zIndex: 1 },
        segmentText: { fontFamily: fonts.medium, fontSize: 12, color: colors.placeholder },
        segmentTextActive: { color: colors.primaryContent, fontFamily: fonts.bold },
        typeButton: {
          width: 38,
          height: 38,
          borderRadius: 10,
          backgroundColor: colors.base200,
          alignItems: "center",
          justifyContent: "center",
        },
        typeButtonActive: { backgroundColor: colors.primary },
        typeBadgeDot: {
          position: "absolute",
          top: 5,
          right: 5,
          width: 7,
          height: 7,
          borderRadius: 3.5,
          backgroundColor: colors.error,
        },
        list: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 12 },
        empty: { textAlign: "center", color: colors.placeholder, marginTop: 40 },
        error: { color: colors.error, textAlign: "center", marginTop: 8 },
        popoverOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
        popoverCard: {
          position: "absolute",
          top: 110,
          right: 16,
          backgroundColor: colors.base200,
          borderRadius: 12,
          overflow: "hidden",
          minWidth: 180,
          elevation: 5,
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
        },
        popoverRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
        popoverRowText: { fontSize: 14, color: colors.baseContent },
        popoverRowTextActive: { color: colors.primary, fontFamily: fonts.bold },
        popoverDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
      }),
    [colors]
  );

  const [sort, setSort] = useState<SortMode>("recent");
  const [type, setType] = useState<TypeFilter>("all");
  const [typeMenuVisible, setTypeMenuVisible] = useState(false);
  const [items, setItems] = useState<Share[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [segmentedWidth, setSegmentedWidth] = useState(0);
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const sortIndex = SORT_OPTIONS.findIndex((o) => o.key === sort);

  useEffect(() => {
    if (segmentedWidth === 0) return;
    const segmentWidth = (segmentedWidth - 6) / SORT_OPTIONS.length;
    Animated.spring(indicatorAnim, {
      toValue: sortIndex * segmentWidth,
      useNativeDriver: true,
      friction: 8,
      tension: 80,
    }).start();
  }, [sortIndex, segmentedWidth]);

  const load = useCallback(async () => {
    try {
      const res = await getShareFeed(sort, type === "all" ? undefined : type, 1, PAGE_LIMIT);
      setItems(res.items);
      setHasMore(res.hasMore);
      setPage(1);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to load content."));
    }
  }, [sort, type]);

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
      const res = await getShareFeed(sort, type === "all" ? undefined : type, nextPage, PAGE_LIMIT);
      setItems((prev) => [...prev, ...res.items]);
      setHasMore(res.hasMore);
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleToggleLike = async (shareId: string) => {
    const prev = items;
    setItems((cur) =>
      cur.map((s) => (s._id !== shareId ? s : { ...s, liked: !s.liked, likeCount: s.liked ? Math.max(0, s.likeCount - 1) : s.likeCount + 1 }))
    );
    try {
      await toggleShareLike(shareId);
    } catch {
      setItems(prev);
    }
  };

  const segmentWidth = segmentedWidth > 0 ? (segmentedWidth - 6) / SORT_OPTIONS.length : 0;

  const header = (
    <View style={styles.filterBlock}>
      <View style={styles.filterRow}>
        <View style={styles.segmented} onLayout={(e) => setSegmentedWidth(e.nativeEvent.layout.width)}>
          {segmentedWidth > 0 && (
            <Animated.View
              style={[
                styles.segmentIndicator,
                { width: segmentWidth, transform: [{ translateX: indicatorAnim }] },
              ]}
            />
          )}
          {SORT_OPTIONS.map((opt) => (
            <Pressable key={opt.key} style={styles.segment} onPress={() => setSort(opt.key)}>
              <Text style={[styles.segmentText, sort === opt.key && styles.segmentTextActive]}>{t(opt.label)}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[styles.typeButton, type !== "all" && styles.typeButtonActive]}
          onPress={() => setTypeMenuVisible(true)}
        >
          <Ionicons name="options-outline" size={18} color={type !== "all" ? colors.primaryContent : colors.baseContent} />
          {type !== "all" && <View style={styles.typeBadgeDot} />}
        </Pressable>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {loading ? (
        <View style={styles.container}>
          <OnlineFriendsBar />
          {header}
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
        </View>
      ) : (
        <FlatList
          style={styles.container}
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
          ListHeaderComponent={
            <>
              <OnlineFriendsBar />
              {header}
            </>
          }
          renderItem={({ item }) => (
            <ShareCard share={item} basePath="/home" onToggleLike={() => handleToggleLike(item._id)} />
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={<Text style={styles.empty}>{t("No shares yet.")}</Text>}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null}
        />
      )}

      <Modal visible={typeMenuVisible} transparent animationType="fade" onRequestClose={() => setTypeMenuVisible(false)}>
        <Pressable style={styles.popoverOverlay} onPress={() => setTypeMenuVisible(false)}>
          <View style={styles.popoverCard}>
            {TYPE_OPTIONS.map((opt, i) => {
              const active = type === opt.key;
              return (
                <View key={opt.key}>
                  <Pressable
                    style={styles.popoverRow}
                    onPress={() => {
                      setType(opt.key);
                      setTypeMenuVisible(false);
                    }}
                  >
                    <Text style={[styles.popoverRowText, active && styles.popoverRowTextActive]}>{t(opt.label)}</Text>
                    {active && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                  </Pressable>
                  {i < TYPE_OPTIONS.length - 1 && <View style={styles.popoverDivider} />}
                </View>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
