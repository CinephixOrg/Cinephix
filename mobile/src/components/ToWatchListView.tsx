import { useCallback, useState, type ReactElement } from "react";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { getToWatchList, removeFromToWatchList } from "../api/toWatchService";
import { getMovieById, getSeriesById } from "../api/contentService";
import WatchlistGrid, { type HydratedWatchItem } from "./WatchlistGrid";
import type { ContentType } from "../types";

interface Props {
  // Rendered above the grid, scrolling together with it — used to embed
  // the Profile screen's header + sub-tab row when this view is shown
  // inside Profile's Watchlist sub-tab instead of its own top-level route.
  ListHeaderComponent?: ReactElement | null;
  // See WatchedListView's identical prop — keeps content-detail back-nav
  // inside whichever tab's Stack the user is actually in.
  basePath?: "/to-watch" | "/profile";
}

// Shared between the top-level "to-watch" tab (app/(app)/to-watch/index.tsx —
// this app's "Watchlist" feature) and the Profile screen's Watchlist
// sub-tab — both just show the full to-watch queue. No rating merge here
// (unlike WatchedListView) — personal ratings aren't a meaningful concept
// for not-yet-watched items, so this page's WatchlistGrid gets no
// rating-based filter options.
export default function ToWatchListView({ ListHeaderComponent, basePath = "/to-watch" }: Props) {
  const { t } = useTranslation();
  const [items, setItems] = useState<HydratedWatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  const load = useCallback(async () => {
    try {
      const toWatchList = await getToWatchList();
      const hydrated = await Promise.all(
        toWatchList.map(async (w) => {
          const content = w.itemType === "movie" ? await getMovieById(w.itemId) : await getSeriesById(w.itemId);
          return { id: w.itemId, type: w.itemType, content };
        })
      );
      setItems(hydrated);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to load watchlist."));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleRemove = async (id: string, type: ContentType) => {
    try {
      await removeFromToWatchList(id, type);
      setItems((prev) => prev.filter((i) => !(i.id === id && i.type === type)));
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to remove item."));
    }
  };

  return (
    <WatchlistGrid
      items={items}
      loading={loading}
      refreshing={refreshing}
      onRefresh={onRefresh}
      error={error}
      editMode={editMode}
      onToggleEditMode={() => setEditMode((v) => !v)}
      onRemove={handleRemove}
      basePath={basePath}
      showRatingFilters={false}
      emptyText={t("Your watchlist is empty.")}
      headerExtra={ListHeaderComponent}
    />
  );
}
