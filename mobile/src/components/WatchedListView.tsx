import { useCallback, useState, type ReactElement } from "react";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { getWatchlist, removeFromWatchlist } from "../api/watchlistService";
import { getMovieById, getSeriesById } from "../api/contentService";
import { getUserRatings } from "../api/ratingService";
import WatchlistGrid, { type HydratedWatchItem } from "./WatchlistGrid";
import type { ContentType } from "../types";

interface Props {
  // Rendered above the grid, scrolling together with it — used to embed
  // the Profile screen's header + sub-tab row when this view is shown
  // inside Profile's WatchedList sub-tab instead of its own top-level route.
  ListHeaderComponent?: ReactElement | null;
  // Which nested Stack a card push should land in — "/watchlist" (its own
  // top-level route) or "/profile" when embedded there, so content-detail
  // back-navigation stays inside whichever tab's Stack the user is actually
  // in, per this app's established per-tab-Stack navigation design.
  basePath?: "/watchlist" | "/profile";
}

// Shared between the top-level "watchlist" tab (app/(app)/watchlist/index.tsx,
// confusingly named — this app's "Watched List" feature) and the Profile
// screen's WatchedList sub-tab — both just show the full watched list. This
// component owns the data (fetch, rating-merge, remove); WatchlistGrid owns
// the shared Movies/Series + edit + filter UI.
export default function WatchedListView({ ListHeaderComponent, basePath = "/watchlist" }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [items, setItems] = useState<HydratedWatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  const load = useCallback(async () => {
    try {
      const [watchlist, ratings] = await Promise.all([
        getWatchlist(),
        user ? getUserRatings(user._id).catch(() => []) : Promise.resolve([]),
      ]);
      const ratingMap = new Map(ratings.map((r) => [r.contentId, r.value]));
      const hydrated = await Promise.all(
        watchlist.map(async (w) => {
          const content = w.itemType === "movie" ? await getMovieById(w.itemId) : await getSeriesById(w.itemId);
          return { id: w.itemId, type: w.itemType, content, rating: ratingMap.get(w.itemId) ?? null };
        })
      );
      setItems(hydrated);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to load watched list."));
    }
  }, [user?._id]);

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
      await removeFromWatchlist(id, type);
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
      showRatingFilters
      emptyText={t("Your watched list is empty.")}
      headerExtra={ListHeaderComponent}
    />
  );
}
