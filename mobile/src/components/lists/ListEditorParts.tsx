import { memo, useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import { SkeletonBox } from "../Skeleton";
import { draftKey, type DraftItem } from "../../utils/listDraft";

// The list editor's building blocks. Each is memoized and fed stable
// callbacks plus only its own slice of state, so typing in the title or
// search box re-renders none of the posters, and adding a title re-renders
// only the row or tile whose state changed.

const ROW_POSTER = "https://image.tmdb.org/t/p/w92";
const TILE_POSTER = "https://image.tmdb.org/t/p/w185";

type Colors = ReturnType<typeof useTheme>["colors"];

function Poster({ path, base, style, colors }: { path: string | null; base: string; style: object; colors: Colors }) {
  return path ? (
    <Image source={{ uri: `${base}${path}` }} style={[style, { backgroundColor: colors.base300 }]} />
  ) : (
    <View style={[style, styles.posterFallback, { backgroundColor: colors.base300 }]}>
      <Ionicons name="film-outline" size={18} color={colors.placeholder} />
    </View>
  );
}

/** A short spring on the icon: the add registered. */
function usePop(trigger: boolean) {
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!trigger) return;
    scale.setValue(0.6);
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
  }, [trigger, scale]);
  return scale;
}

// ---------------------------------------------------------------------------
// Search results
// ---------------------------------------------------------------------------

export const SearchResultRow = memo(function SearchResultRow({
  item,
  added,
  onToggle,
}: {
  item: DraftItem;
  added: boolean;
  /** Adds the title, or takes it back off when it's already added. */
  onToggle: (item: DraftItem) => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const pop = usePop(added);

  return (
    <Pressable
      onPress={() => onToggle(item)}
      accessibilityRole="button"
      accessibilityState={{ selected: added }}
      accessibilityLabel={`${item.title}${item.year ? `, ${item.year}` : ""}${added ? `, ${t("Added")}` : ""}`}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.base200 }]}
    >
      <Poster path={item.posterPath} base={ROW_POSTER} style={styles.rowPoster} colors={colors} />
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.baseContent }]} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={styles.rowMeta}>
          <Ionicons name={item.type === "movie" ? "film-outline" : "tv-outline"} size={12} color={colors.placeholder} />
          {item.year ? <Text style={[styles.rowYear, { color: colors.placeholder }]}>{item.year}</Text> : null}
        </View>
      </View>
      <Animated.View
        style={[
          styles.rowAction,
          added ? { backgroundColor: colors.primary } : { borderWidth: 1.5, borderColor: colors.border },
          { transform: [{ scale: pop }] },
        ]}
      >
        <Ionicons name={added ? "checkmark" : "add"} size={18} color={added ? colors.primaryContent : colors.baseContent} />
      </Animated.View>
    </Pressable>
  );
});

export const SearchResults = memo(function SearchResults({
  results,
  searching,
  addedKeys,
  onToggle,
}: {
  results: DraftItem[];
  searching: boolean;
  addedKeys: ReadonlySet<string>;
  onToggle: (item: DraftItem) => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (results.length === 0) {
    return (
      <View style={styles.resultsState}>
        {searching ? (
          <ActivityIndicator color={colors.placeholder} />
        ) : (
          <Text style={[styles.hint, { color: colors.placeholder }]}>{t("No results found.")}</Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.results}>
      {results.map((item) => {
        const key = draftKey(item);
        return <SearchResultRow key={key} item={item} added={addedKeys.has(key)} onToggle={onToggle} />;
      })}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

const SUGGESTION_WIDTH = 96;
const SUGGESTION_HEIGHT = SUGGESTION_WIDTH * 1.5;
const SKELETON_TILES = [0, 1, 2, 3, 4];

const SuggestionTile = memo(function SuggestionTile({ item, onAdd }: { item: DraftItem; onAdd: (item: DraftItem) => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={() => onAdd(item)}
      accessibilityRole="button"
      accessibilityLabel={`${t("Add")}, ${item.title}`}
      style={({ pressed }) => [styles.suggestion, pressed && styles.pressedTile]}
    >
      <Poster path={item.posterPath} base={TILE_POSTER} style={styles.suggestionPoster} colors={colors} />
      <View style={[styles.suggestionAdd, { backgroundColor: colors.primary, borderColor: colors.base100 }]}>
        <Ionicons name="add" size={16} color={colors.primaryContent} />
      </View>
      <Text style={[styles.suggestionTitle, { color: colors.baseContent }]} numberOfLines={1}>
        {item.title}
      </Text>
    </Pressable>
  );
});

export const SuggestionsRail = memo(function SuggestionsRail({
  suggestions,
  loading,
  onAdd,
}: {
  suggestions: DraftItem[];
  loading: boolean;
  onAdd: (item: DraftItem) => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  if (!loading && suggestions.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name="sparkles" size={15} color={colors.primary} />
        <Text style={[styles.sectionTitle, { color: colors.baseContent }]}>{t("Suggested for this list")}</Text>
      </View>
      <Text style={[styles.sectionSubtitle, { color: colors.placeholder }]}>{t("Picked from the titles you added last")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {suggestions.length === 0
          ? SKELETON_TILES.map((index) => (
              <View key={index} style={styles.suggestion}>
                <SkeletonBox width={SUGGESTION_WIDTH} height={SUGGESTION_HEIGHT} borderRadius={10} />
              </View>
            ))
          : suggestions.map((item) => <SuggestionTile key={draftKey(item)} item={item} onAdd={onAdd} />)}
      </ScrollView>
    </View>
  );
});

/** Until the list has enough titles: how many more it takes, as filling dots. */
export const SuggestionsHint = memo(function SuggestionsHint({ added, needed }: { added: number; needed: number }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={[styles.hintRow, { backgroundColor: colors.base200 }]}>
      <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
      <Text style={[styles.hintText, { color: colors.placeholder }]}>
        {t("Add {{count}} more titles to get suggestions", { count: needed - added })}
      </Text>
      <View style={styles.dots}>
        {Array.from({ length: needed }, (_, index) => (
          <View key={index} style={[styles.dot, { backgroundColor: index < added ? colors.primary : colors.border }]} />
        ))}
      </View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Added titles
// ---------------------------------------------------------------------------

const AddedTile = memo(function AddedTile({
  item,
  width,
  onRemove,
}: {
  item: DraftItem;
  width: number;
  onRemove: (key: string) => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const size = useMemo(() => ({ width, height: Math.round(width * 1.5) }), [width]);
  // Pops in when it arrives (from search or a suggestion).
  const presence = useRef(new Animated.Value(0.85)).current;
  useEffect(() => {
    Animated.timing(presence, { toValue: 1, duration: 220, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }).start();
  }, [presence]);

  return (
    <Animated.View style={[size, { transform: [{ scale: presence }] }]}>
      <Poster path={item.posterPath} base={TILE_POSTER} style={[styles.addedPoster, size]} colors={colors} />
      <Pressable
        onPress={() => onRemove(draftKey(item))}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`${t("Remove")}, ${item.title}`}
        style={styles.removeBadge}
      >
        <Ionicons name="close" size={14} color="#fff" />
      </Pressable>
    </Animated.View>
  );
});

export const ADDED_COLUMNS = 4;
export const ADDED_GAP = 10;

export const AddedGrid = memo(function AddedGrid({
  items,
  tileWidth,
  onRemove,
}: {
  items: DraftItem[];
  tileWidth: number;
  onRemove: (key: string) => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.baseContent }]}>{t("Added")}</Text>
        <View style={[styles.countPill, { backgroundColor: colors.base200 }]}>
          <Text style={[styles.countText, { color: colors.placeholder }]}>{items.length}</Text>
        </View>
      </View>
      {items.length === 0 ? (
        <View style={[styles.emptyAdded, { borderColor: colors.border }]}>
          <Ionicons name="albums-outline" size={26} color={colors.placeholder} />
          <Text style={[styles.hint, { color: colors.placeholder }]}>{t("Nothing added yet.")}</Text>
          <Text style={[styles.hintSmall, { color: colors.placeholder }]}>{t("Search above to add titles to this list.")}</Text>
        </View>
      ) : (
        <View style={[styles.grid, { gap: ADDED_GAP }]}>
          {items.map((item) => (
            <AddedTile key={draftKey(item)} item={item} width={tileWidth} onRemove={onRemove} />
          ))}
        </View>
      )}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------

export const VisibilityToggle = memo(function VisibilityToggle({
  isPublic,
  onChange,
}: {
  isPublic: boolean;
  onChange: (isPublic: boolean) => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const options = [
    { value: false, icon: "lock-closed" as const, label: t("Private") },
    { value: true, icon: "globe-outline" as const, label: t("Public") },
  ];
  return (
    <View style={[styles.segment, { backgroundColor: colors.base200, borderColor: colors.border }]}>
      {options.map((option) => {
        const active = option.value === isPublic;
        return (
          <Pressable
            key={option.label}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[styles.segmentOption, active && { backgroundColor: colors.primary }]}
          >
            <Ionicons name={option.icon} size={14} color={active ? colors.primaryContent : colors.placeholder} />
            <Text style={[styles.segmentText, { color: active ? colors.primaryContent : colors.baseContent }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  posterFallback: { alignItems: "center", justifyContent: "center" },

  results: { paddingHorizontal: 8, paddingTop: 4 },
  resultsState: { alignItems: "center", paddingVertical: 28 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 12 },
  rowPoster: { width: 40, height: 60, borderRadius: 6 },
  rowText: { flex: 1, gap: 4 },
  rowTitle: { fontFamily: fonts.bold, fontSize: 14 },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowYear: { fontFamily: fonts.medium, fontSize: 12 },
  rowAction: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },

  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { fontFamily: fonts.extrabold, fontSize: 16 },
  sectionSubtitle: { fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  rail: { gap: 12, paddingTop: 12, paddingRight: 16 },
  suggestion: { width: SUGGESTION_WIDTH },
  pressedTile: { transform: [{ scale: 0.95 }] },
  suggestionPoster: { width: SUGGESTION_WIDTH, height: SUGGESTION_HEIGHT, borderRadius: 10 },
  suggestionAdd: {
    position: "absolute",
    top: SUGGESTION_HEIGHT - 16,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionTitle: { fontFamily: fonts.medium, fontSize: 12, marginTop: 16 },

  hintRow: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 16, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14 },
  hintText: { flex: 1, fontFamily: fonts.medium, fontSize: 12 },
  dots: { flexDirection: "row", gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  hint: { fontFamily: fonts.medium, fontSize: 13, textAlign: "center" },
  hintSmall: { fontFamily: fonts.regular, fontSize: 12, textAlign: "center" },

  countPill: { minWidth: 24, height: 20, borderRadius: 10, paddingHorizontal: 7, alignItems: "center", justifyContent: "center" },
  countText: { fontFamily: fonts.bold, fontSize: 11 },
  emptyAdded: { marginTop: 12, paddingVertical: 28, borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", gap: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 12 },
  addedPoster: { borderRadius: 10 },
  removeBadge: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },

  segment: { flexDirection: "row", alignSelf: "flex-start", borderRadius: 12, borderWidth: 1, padding: 3, gap: 3 },
  segmentOption: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, height: 34, borderRadius: 9 },
  segmentText: { fontFamily: fonts.bold, fontSize: 13 },
});
