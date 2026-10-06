import { memo, useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, StyleSheet, View, useWindowDimensions } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import CollectionSearchBar from "../components/collection/CollectionSearchBar";
import CollectionToolbar from "../components/collection/CollectionToolbar";
import CollectionFilterSheet from "../components/collection/CollectionFilterSheet";
import CollectionGrid from "../components/collection/CollectionGrid";
import { CollectionSkeleton, CollectionStateView } from "../components/collection/CollectionStates";
import { PUBLIC_WATCHED_SORT_GROUPS, WATCHLIST_SORT_GROUPS } from "../components/collection/filterLabels";
import { COLLECTION_GRID, useCollectionQuery, useGridMetrics } from "../components/collection/useCollectionQuery";
import {
  getCachedPublicCollection,
  isPublicCollectionFresh,
  loadPublicCollection,
  type PublicCollection,
  type PublicCollectionKind,
} from "../api/publicCollectionCache";
import type { CollectionEntry } from "../utils/collectionQuery";
import { useOwnerTitle } from "../hooks/useOwnerTitle";
import { AD_UNIT_IDS } from "../constants/adUnitIds";

// Same two placements as the viewer's own Watched List/Watchlist
// (CollectionGrid's adUnitId) — this is about the VIEWER's own tier, not
// whose collection they're looking at, same reasoning Profile's tabs
// already apply when viewing someone else's profile.
const AD_UNIT_ID_BY_KIND: Record<PublicCollectionKind, string> = {
  watched: AD_UNIT_IDS.WATCHED_LIST_BANNER,
  watchlist: AD_UNIT_IDS.WATCHLIST_BANNER,
};

const NO_ENTRIES: CollectionEntry[] = [];

// Header titles: with the owner's name once known, the plain name until then.
const TITLE: Record<PublicCollectionKind, { withOwner: string; plain: string }> = {
  watched: { withOwner: "@{{username}}'s Watched List", plain: "Watched List" },
  watchlist: { withOwner: "@{{username}}'s Watchlist", plain: "Watchlist" },
};
const GRID_PADDING_BOTTOM = 32;
// CollectionToolbar's height, held while loading so the grid doesn't drop by
// a row when the toolbar appears.
const TOOLBAR_HEIGHT = 36;

// i18n keys per list.
const COPY: Record<PublicCollectionKind, { search: string; empty: string; loadFailed: string }> = {
  watched: { search: "Search their watched list", empty: "Nothing watched yet.", loadFailed: "Failed to load watched list." },
  watchlist: { search: "Search their watchlist", empty: "Nothing on the watchlist yet.", loadFailed: "Failed to load watchlist." },
};

type Status = "loading" | "ready" | "error";

// Someone else's Watched List or Watchlist, as a full page in their profile's
// stack (/user/[id]/watched, /user/[id]/watchlist), opened from their
// profile's drawer. The signed-in user's own list pages (CollectionScreen)
// with the same search, filter menu and five-across poster grid.
//
// Read-only by construction, not by hiding: the grid gets no onRemove (so it
// renders no remove overlay and a tap can only open a title), the toolbar no
// onToggleEdit (so there is no Edit button), and nothing here imports anything
// that can change a list.
//
// The list comes from publicCollectionCache: a revisit renders it on the first
// frame (the drawer also warms it when it opens) and refreshes underneath, and
// search, filters and sorting run on the device.
function PublicCollectionScreen({ kind }: { kind: PublicCollectionKind }) {
  const { id: userId } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const copy = COPY[kind];
  useOwnerTitle(userId, TITLE[kind].withOwner, TITLE[kind].plain);

  const [collection, setCollection] = useState<PublicCollection | undefined>(() =>
    userId ? getCachedPublicCollection(userId, kind) : undefined
  );
  const [status, setStatus] = useState<Status>(() => (userId && getCachedPublicCollection(userId, kind) ? "ready" : "loading"));
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    (force: boolean): Promise<void> => {
      if (!userId) return Promise.resolve();
      const cached = getCachedPublicCollection(userId, kind);
      if (cached) {
        setCollection(cached);
        setStatus("ready");
        if (!force && isPublicCollectionFresh(cached)) return Promise.resolve();
      } else {
        setStatus("loading");
      }
      return loadPublicCollection(userId, kind)
        .then((next) => {
          setCollection(next);
          setStatus("ready");
        })
        .catch(() => {
          if (!getCachedPublicCollection(userId, kind)) setStatus("error");
        });
    },
    [userId, kind]
  );

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true).finally(() => setRefreshing(false));
  }, [load]);

  const retry = useCallback(() => {
    load(true);
  }, [load]);

  const entries = collection?.entries ?? NO_ENTRIES;
  const query = useCollectionQuery(entries);
  const metrics = useGridMetrics(screenWidth);

  const openTitle = useCallback(
    (entry: CollectionEntry) => router.push(`/user/${userId}/content/${entry.type}/${entry.id}` as never),
    [router, userId]
  );

  // Memoized so the grid's memo holds across this screen's own re-renders.
  const refreshControl = useMemo(
    () => <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />,
    [refreshing, onRefresh, colors.primary]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.base100 },
        top: { paddingHorizontal: COLLECTION_GRID.paddingX, paddingTop: 12, paddingBottom: 10, gap: 10 },
        toolbarPlaceholder: { alignSelf: "flex-start", height: TOOLBAR_HEIGHT },
      }),
    [colors]
  );

  let body: React.ReactNode;
  if (status === "loading") {
    body = <CollectionSkeleton metrics={metrics} />;
  } else if (status === "error") {
    body = (
      <CollectionStateView
        icon="cloud-offline-outline"
        title={t(copy.loadFailed)}
        text={t("Check your connection and try again.")}
        action={{ label: t("Retry"), onPress: retry }}
      />
    );
  } else if (entries.length === 0) {
    body = <CollectionStateView icon="film-outline" title={t(copy.empty)} />;
  } else if (query.visible.length === 0) {
    body = (
      <CollectionStateView
        icon="search-outline"
        title={t("No titles match your search.")}
        text={t("Try a different title or clear your filters.")}
        action={query.filterCount > 0 ? { label: t("Clear all"), onPress: query.clearFilters } : undefined}
      />
    );
  } else {
    body = (
      <CollectionGrid
        entries={query.gridEntries}
        metrics={metrics}
        paddingBottom={GRID_PADDING_BOTTOM}
        onOpen={openTitle}
        refreshControl={refreshControl}
        adUnitId={AD_UNIT_ID_BY_KIND[kind]}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <CollectionSearchBar
          placeholder={t(copy.search)}
          onChangeQuery={query.setQuery}
          onOpenFilters={query.openSheet}
          activeFilterCount={query.filterCount}
        />
        {status === "ready" && entries.length > 0 ? (
          <CollectionToolbar
            shown={query.visible.length}
            total={entries.length}
            narrowed={query.narrowed}
            filters={query.filters}
            onFilterAction={query.onFilterAction}
          />
        ) : status === "loading" ? (
          <ActivityIndicator size="small" color={colors.placeholder} style={styles.toolbarPlaceholder} />
        ) : null}
      </View>

      {body}

      <CollectionFilterSheet
        visible={query.sheetOpen}
        onClose={query.closeSheet}
        filters={query.filters}
        onAction={query.onFilterAction}
        resultCount={query.visible.length}
        sortGroups={kind === "watched" ? PUBLIC_WATCHED_SORT_GROUPS : WATCHLIST_SORT_GROUPS}
        showRatedFilter={kind === "watched"}
      />
    </View>
  );
}

export default memo(PublicCollectionScreen);
