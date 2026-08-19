import { useMemo, useState, type ReactElement } from "react";
import { View, Text, Pressable, FlatList, StyleSheet, RefreshControl, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import MiniContentCard from "./MiniContentCard";
import { SkeletonGrid, SkeletonPosterCard } from "./Skeleton";
import type { ContentType, Movie, Series } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const GRID_COLUMNS = 4;
const GRID_GAP = 4;
const GRID_PADDING = 16;

export interface HydratedWatchItem {
  id: string;
  type: ContentType;
  content: Movie | Series;
  // undefined when this page never fetches ratings at all (Watchlist/to-watch);
  // null when ratings were fetched but this item has none.
  rating?: number | null;
}

type FilterKey =
  | "none"
  | "alpha_asc"
  | "alpha_desc"
  | "release_newest"
  | "release_oldest"
  | "rating_highest"
  | "rating_lowest"
  | "rated_only"
  | "not_rated_only";

interface Props {
  items: HydratedWatchItem[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  error: string | null;
  editMode: boolean;
  onToggleEditMode: () => void;
  onRemove: (id: string, type: ContentType) => void;
  basePath: "/watchlist" | "/to-watch" | "/profile";
  showRatingFilters: boolean;
  emptyText: string;
  // The caller's own outer tab row, when this grid is embedded inside
  // Profile instead of rendered at its own top-level route.
  headerExtra?: ReactElement | null;
}

function getTitle(item: HydratedWatchItem): string {
  return item.type === "movie" ? (item.content as Movie).title : (item.content as Series).name;
}
function getDate(item: HydratedWatchItem): string | undefined {
  return item.type === "movie" ? (item.content as Movie).release_date : (item.content as Series).first_air_date;
}

export default function WatchlistGrid({
  items,
  loading,
  refreshing,
  onRefresh,
  error,
  editMode,
  onToggleEditMode,
  onRemove,
  basePath,
  showRatingFilters,
  emptyText,
  headerExtra,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = (screenWidth - GRID_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        list: { paddingHorizontal: GRID_PADDING, paddingBottom: 24 },
        typeTabRow: {
          flexDirection: "row",
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          marginBottom: 4,
        },
        typeTabButton: { flex: 1, alignItems: "center", paddingVertical: 10 },
        typeTabButtonActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
        typeTabText: { fontFamily: fonts.medium, fontSize: 13, color: colors.placeholder },
        typeTabTextActive: { color: colors.primary, fontFamily: fonts.bold },
        actionRow: { flexDirection: "row", gap: 16, paddingVertical: 10 },
        actionButton: { flexDirection: "row", alignItems: "center", gap: 4 },
        actionText: { fontFamily: fonts.medium, fontSize: 13, color: colors.baseContent },
        panel: {
          backgroundColor: colors.base200,
          borderRadius: 12,
          marginBottom: 12,
          overflow: "hidden",
        },
        panelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
        panelRowText: { fontSize: 14, color: colors.baseContent },
        panelRowTextActive: { color: colors.primary, fontFamily: fonts.bold },
        panelDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
        error: { color: colors.error, textAlign: "center", marginBottom: 8 },
        empty: { textAlign: "center", color: colors.placeholder, marginTop: 40 },
      }),
    [colors]
  );

  const [typeTab, setTypeTab] = useState<ContentType>("movie");
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("none");

  const filterOptions = useMemo(() => {
    const base: { key: FilterKey; label: string }[] = [
      { key: "none", label: t("Default") },
      { key: "alpha_asc", label: t("Alphabetical (A-Z)") },
      { key: "alpha_desc", label: t("Alphabetical (Z-A)") },
      { key: "release_newest", label: t("Release Date (Newest First)") },
      { key: "release_oldest", label: t("Release Date (Oldest First)") },
    ];
    if (showRatingFilters) {
      base.push(
        { key: "rating_highest", label: t("Highest Rating") },
        { key: "rating_lowest", label: t("Lowest Rating") },
        { key: "rated_only", label: t("Rated") },
        { key: "not_rated_only", label: t("Not Rated") }
      );
    }
    return base;
  }, [showRatingFilters, t]);

  const visibleItems = useMemo(() => {
    let result = items.filter((i) => i.type === typeTab);

    if (activeFilter === "rated_only") {
      result = result.filter((i) => i.rating != null);
    } else if (activeFilter === "not_rated_only") {
      result = result.filter((i) => i.rating == null);
    }

    const withDates = () =>
      [...result].sort((a, b) => {
        const da = getDate(a);
        const db = getDate(b);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da.localeCompare(db);
      });

    switch (activeFilter) {
      case "alpha_asc":
        return [...result].sort((a, b) => getTitle(a).localeCompare(getTitle(b)));
      case "alpha_desc":
        return [...result].sort((a, b) => getTitle(b).localeCompare(getTitle(a)));
      case "release_newest":
        return withDates().reverse();
      case "release_oldest":
        return withDates();
      case "rating_highest":
        return [...result].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
      case "rating_lowest":
        return [...result].sort((a, b) => {
          if (a.rating == null && b.rating == null) return 0;
          if (a.rating == null) return 1;
          if (b.rating == null) return -1;
          return a.rating - b.rating;
        });
      default:
        return result;
    }
  }, [items, typeTab, activeFilter]);

  const header = (
    <>
      {headerExtra}
      <View style={styles.typeTabRow}>
        <Pressable
          style={[styles.typeTabButton, typeTab === "movie" && styles.typeTabButtonActive]}
          onPress={() => setTypeTab("movie")}
        >
          <Text style={[styles.typeTabText, typeTab === "movie" && styles.typeTabTextActive]}>{t("Movies")}</Text>
        </Pressable>
        <Pressable
          style={[styles.typeTabButton, typeTab === "series" && styles.typeTabButtonActive]}
          onPress={() => setTypeTab("series")}
        >
          <Text style={[styles.typeTabText, typeTab === "series" && styles.typeTabTextActive]}>{t("Series")}</Text>
        </Pressable>
      </View>

      <View style={styles.actionRow}>
        <Pressable style={styles.actionButton} onPress={onToggleEditMode}>
          <Ionicons name={editMode ? "pencil" : "pencil-outline"} size={16} color={editMode ? colors.primary : colors.baseContent} />
          <Text style={[styles.actionText, editMode && { color: colors.primary }]}>{t("Edit")}</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={() => setFilterOpen((v) => !v)}>
          <Ionicons name="options-outline" size={16} color={filterOpen ? colors.primary : colors.baseContent} />
          <Text style={[styles.actionText, filterOpen && { color: colors.primary }]}>{t("Filter")}</Text>
        </Pressable>
      </View>

      {filterOpen && (
        <View style={styles.panel}>
          {filterOptions.map((opt, i) => {
            const active = activeFilter === opt.key;
            return (
              <View key={opt.key}>
                <Pressable
                  style={styles.panelRow}
                  onPress={() => {
                    setActiveFilter(opt.key);
                    setFilterOpen(false);
                  }}
                >
                  <Text style={[styles.panelRowText, active && styles.panelRowTextActive]}>{opt.label}</Text>
                  {active && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </Pressable>
                {i < filterOptions.length - 1 && <View style={styles.panelDivider} />}
              </View>
            );
          })}
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.base100 }}>
        <View style={styles.list}>
          {header}
          <SkeletonGrid count={9} columns={3} renderItem={() => <SkeletonPosterCard />} />
        </View>
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.base100 }}
      data={visibleItems}
      keyExtractor={(item) => `${item.type}-${item.id}`}
      numColumns={GRID_COLUMNS}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
      }
      ListHeaderComponent={header}
      renderItem={({ item, index }) => (
        <MiniContentCard
          id={item.id}
          type={item.type}
          posterPath={item.content.poster_path}
          title={getTitle(item)}
          basePath={basePath}
          onRemove={editMode ? () => onRemove(item.id, item.type) : undefined}
          style={{
            width: cardWidth,
            marginBottom: 12,
            marginRight: (index + 1) % GRID_COLUMNS === 0 ? 0 : GRID_GAP,
          }}
        />
      )}
      ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
    />
  );
}
