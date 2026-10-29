import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Image, FlatList, ActivityIndicator, StyleSheet, useWindowDimensions } from "react-native";
import Pressable from "../common/TapSafePressable";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import { getMovies, getSeries } from "../../api/contentService";
import { addToWatchlistBulk } from "../../api/watchlistService";
import { useBadgeEarned } from "../../context/BadgeEarnedContext";
import type { ContentType } from "../../types";
import type { PickedTitle, TastePreference } from "./onboardingTypes";

const COLUMNS = 3;
const GRID_GAP = 10;
const PAGE_SIZE = 20;
const POSTER_BASE = "https://image.tmdb.org/t/p/w154";

interface GridItem {
  id: string;
  type: ContentType;
  title: string;
  posterPath?: string | null;
}

interface Props {
  preference: TastePreference;
  selectedGenreIds: number[];
  pickedTitles: PickedTitle[];
  onFinish: () => void;
}

// A tap anywhere on the tile toggles selection — direct bug report: reusing
// MiniContentCard here navigated to the content detail page on a poster
// tap, which makes no sense mid-onboarding (it's not a browsing screen,
// and there's nowhere sensible for "back" to return to). This is a
// dedicated, non-navigating tile instead of MiniContentCard specifically
// for that reason.
function SelectableTile({ item, width, selected, onToggle }: { item: GridItem; width: number; selected: boolean; onToggle: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { width },
        poster: {
          width: "100%",
          aspectRatio: 2 / 3,
          borderRadius: 4,
          backgroundColor: colors.base200,
          borderWidth: 1.5,
          borderColor: selected ? colors.primary : colors.border,
        },
        badge: {
          position: "absolute",
          top: 4,
          right: 4,
          width: 22,
          height: 22,
          borderRadius: 11,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: selected ? colors.primary : "rgba(0,0,0,0.55)",
        },
        title: { fontFamily: fonts.medium, fontSize: 11, color: colors.baseContent, marginTop: 4, textAlign: "center" },
      }),
    [colors, width, selected]
  );

  return (
    <Pressable style={styles.wrap} onPress={onToggle}>
      {item.posterPath ? (
        <Image source={{ uri: `${POSTER_BASE}${item.posterPath}` }} style={styles.poster} />
      ) : (
        <View style={styles.poster} />
      )}
      <View style={styles.badge}>
        <Ionicons name={selected ? "checkmark" : "add"} size={14} color="#fff" />
      </View>
    </Pressable>
  );
}

// Step 5 — the single write action for the whole wizard. Grid is popular
// titles filtered by Step 3's genre picks (empty selection just falls back
// to a plain popularity-sorted catalog, same degrade-gracefully shape
// getRecommendations already uses for hasPersonalization:false); anything
// carried over from Step 4's search picks is pinned at the top,
// pre-selected. Infinite-scroll (direct ask for "more examples" — a fixed
// one-shot fetch read as too thin) rather than a bigger single page, so
// the first screen still loads fast. One tap on "Add" calls the bulk
// endpoint once for everything checked, writing to both the Watched List
// and Favorites.
export default function OnboardingSuggestionGridStep({ preference, selectedGenreIds, pickedTitles, onFinish }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { reportEarnedBadges } = useBadgeEarned();
  const { width } = useWindowDimensions();

  const [catalogItems, setCatalogItems] = useState<GridItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    () => new Set(pickedTitles.map((p) => `${p.type}-${p.id}`))
  );
  const [submitting, setSubmitting] = useState(false);

  const pageRef = useRef(1);
  const movieHasMoreRef = useRef(true);
  const seriesHasMoreRef = useRef(true);
  const loadingRef = useRef(false);

  const wantMovies = preference !== "series";
  const wantSeries = preference !== "movies";

  const loadPage = useCallback(
    async (page: number) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      try {
        const [movieRes, seriesRes] = await Promise.all([
          wantMovies && movieHasMoreRef.current
            ? getMovies(page, PAGE_SIZE, undefined, { genres: selectedGenreIds })
            : Promise.resolve({ items: [], pagination: undefined }),
          wantSeries && seriesHasMoreRef.current
            ? getSeries(page, PAGE_SIZE, undefined, { genres: selectedGenreIds })
            : Promise.resolve({ items: [], pagination: undefined }),
        ]);
        movieHasMoreRef.current = wantMovies && !!movieRes.pagination && page < movieRes.pagination.pages;
        seriesHasMoreRef.current = wantSeries && !!seriesRes.pagination && page < seriesRes.pagination.pages;

        const movies: GridItem[] = movieRes.items.map((m) => ({ id: m._id, type: "movie", title: m.title, posterPath: m.poster_path }));
        const seriesItems: GridItem[] = seriesRes.items.map((s) => ({ id: s._id, type: "series", title: s.name, posterPath: s.poster_path }));
        const interleaved: GridItem[] = [];
        const max = Math.max(movies.length, seriesItems.length);
        for (let i = 0; i < max; i++) {
          if (movies[i]) interleaved.push(movies[i]);
          if (seriesItems[i]) interleaved.push(seriesItems[i]);
        }
        setCatalogItems((prev) => (page === 1 ? interleaved : [...prev, ...interleaved]));
        pageRef.current = page;
      } catch {
        if (page === 1) setCatalogItems([]);
      } finally {
        loadingRef.current = false;
      }
    },
    [wantMovies, wantSeries, selectedGenreIds]
  );

  useEffect(() => {
    setLoading(true);
    pageRef.current = 1;
    movieHasMoreRef.current = true;
    seriesHasMoreRef.current = true;
    loadPage(1).finally(() => setLoading(false));
  }, [loadPage]);

  const handleEndReached = () => {
    if (loading || loadingMore || loadingRef.current) return;
    if (!movieHasMoreRef.current && !seriesHasMoreRef.current) return;
    setLoadingMore(true);
    loadPage(pageRef.current + 1).finally(() => setLoadingMore(false));
  };

  // Picked-titles-first, deduped against the catalog fetch (a favorite
  // search result can easily also show up in the popular-by-genre list).
  const gridItems = useMemo<GridItem[]>(() => {
    const pinned: GridItem[] = pickedTitles.map((p) => ({ id: p.id, type: p.type, title: p.title, posterPath: p.posterPath }));
    const pinnedKeys = new Set(pinned.map((p) => `${p.type}-${p.id}`));
    return [...pinned, ...catalogItems.filter((c) => !pinnedKeys.has(`${c.type}-${c.id}`))];
  }, [pickedTitles, catalogItems]);

  const toggle = (item: GridItem) => {
    const key = `${item.type}-${item.id}`;
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedCount = selectedKeys.size;

  const handleSubmit = async () => {
    if (selectedCount === 0) {
      onFinish();
      return;
    }
    setSubmitting(true);
    try {
      const items = gridItems
        .filter((g) => selectedKeys.has(`${g.type}-${g.id}`))
        .map((g) => ({ itemId: g.id, itemType: g.type }));
      const { newlyEarnedBadges } = await addToWatchlistBulk(items);
      reportEarnedBadges(newlyEarnedBadges);
      onFinish();
    } catch {
      setSubmitting(false);
    }
  };

  const tileWidth = (width - 40 - GRID_GAP * (COLUMNS - 1)) / COLUMNS;
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1 },
        header: { paddingHorizontal: 20, paddingTop: 16 },
        title: { fontSize: 24, fontFamily: fonts.bold, textAlign: "center", color: colors.primary },
        subtitle: { textAlign: "center", color: colors.placeholder, marginTop: 6, marginBottom: 16 },
        grid: { paddingHorizontal: 20, paddingBottom: 100 },
        row: { gap: GRID_GAP, marginBottom: 14 },
        footer: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: 16,
          backgroundColor: colors.base100,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        button: { backgroundColor: colors.primary, borderRadius: 8, padding: 14, alignItems: "center" },
        buttonDisabled: { opacity: 0.6 },
        buttonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 16 },
        footerLoading: { paddingVertical: 16 },
      }),
    [colors]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("Popular in your genres")}</Text>
        <Text style={styles.subtitle}>{t("Tap anything you've already seen.")}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={gridItems}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          numColumns={COLUMNS}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          onEndReachedThreshold={0.4}
          onEndReached={handleEndReached}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={styles.footerLoading} /> : null}
          renderItem={({ item }) => (
            <SelectableTile
              item={item}
              width={tileWidth}
              selected={selectedKeys.has(`${item.type}-${item.id}`)}
              onToggle={() => toggle(item)}
            />
          )}
        />
      )}

      <View style={styles.footer}>
        <Pressable style={[styles.button, submitting && styles.buttonDisabled]} onPress={handleSubmit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color={colors.primaryContent} />
          ) : (
            <Text style={styles.buttonText}>
              {selectedCount > 0 ? t("Add {{count}} to Watched List & Favorites", { count: selectedCount }) : t("Finish")}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
