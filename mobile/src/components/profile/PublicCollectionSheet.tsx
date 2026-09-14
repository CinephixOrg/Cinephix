import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import SheetModal, { SHEET_BORDER_WIDTH, SheetHeader } from "../collection/SheetModal";
import CollectionSearchBar from "../collection/CollectionSearchBar";
import CollectionToolbar from "../collection/CollectionToolbar";
import CollectionFilterSheet from "../collection/CollectionFilterSheet";
import CollectionGrid from "../collection/CollectionGrid";
import { CollectionSkeleton, CollectionStateView } from "../collection/CollectionStates";
import { PUBLIC_WATCHED_SORT_GROUPS, WATCHLIST_SORT_GROUPS } from "../collection/filterLabels";
import { COLLECTION_GRID, useCollectionQuery, useGridMetrics } from "../collection/useCollectionQuery";
import {
  getCachedPublicCollection,
  isPublicCollectionFresh,
  loadPublicCollection,
  type PublicCollection,
  type PublicCollectionKind,
} from "../../api/publicCollectionCache";
import type { CollectionEntry } from "../../utils/collectionQuery";

const NO_ENTRIES: CollectionEntry[] = [];
const SHEET_HEIGHT = "92%";
// The toolbar row's height (CollectionToolbar's minHeight). Held open while
// loading so the grid doesn't drop by a row when the toolbar appears.
const TOOLBAR_HEIGHT = 36;

// i18n keys per list.
const COPY: Record<PublicCollectionKind, { title: string; search: string; empty: string; loadFailed: string }> = {
  watched: {
    title: "@{{username}}'s Watched List",
    search: "Search their watched list",
    empty: "Nothing watched yet.",
    loadFailed: "Failed to load watched list.",
  },
  watchlist: {
    title: "@{{username}}'s Watchlist",
    search: "Search their watchlist",
    empty: "Nothing on the watchlist yet.",
    loadFailed: "Failed to load watchlist.",
  },
};

type Status = "loading" | "ready" | "error";

interface Props {
  visible: boolean;
  onClose: () => void;
  userId: string;
  username: string;
  kind: PublicCollectionKind;
  /** Must be stable. */
  onOpenTitle: (entry: CollectionEntry) => void;
}

// Someone else's full Watched List or Watchlist, as a bottom sheet over their
// profile: the same search, filters and five-across poster grid as the
// signed-in user's own lists, strictly read-only.
//
// Read-only by construction, not by hiding: the grid gets no onRemove (so it
// renders no remove overlay and a tap can only open a title), the toolbar gets
// no onToggleEdit (so there is no Edit button), and nothing here imports
// anything that can change a list.
//
// The sheet keeps its search and filters while closed — PublicListsTab keeps
// it mounted after the first open — and the filter menu opens inside this
// sheet's window rather than as a second native modal on top of it.
function PublicCollectionSheet({ visible, onClose, userId, username, kind, onOpenTitle }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const copy = COPY[kind];

  const [collection, setCollection] = useState<PublicCollection | undefined>(() => getCachedPublicCollection(userId, kind));
  const [status, setStatus] = useState<Status>(() => (getCachedPublicCollection(userId, kind) ? "ready" : "loading"));
  const [refreshing, setRefreshing] = useState(false);

  // Shows whatever is cached immediately — the Lists tab prefetches both
  // lists, so that's usually everything — and refreshes underneath when the
  // copy is stale or `force` is set.
  const load = useCallback(
    (force: boolean) => {
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

  useEffect(() => {
    if (visible) load(false);
  }, [visible, load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true).finally(() => setRefreshing(false));
  }, [load]);

  const entries = collection?.entries ?? NO_ENTRIES;
  const query = useCollectionQuery(entries);
  // The sheet's border narrows it on both sides; the grid and its skeleton
  // are both laid out from this same inner width.
  const metrics = useGridMetrics(screenWidth - SHEET_BORDER_WIDTH * 2);
  const { sheetOpen, closeSheet } = query;

  // The filter menu shouldn't still be open the next time this sheet opens.
  useEffect(() => {
    if (!visible) closeSheet();
  }, [visible, closeSheet]);

  // Android back closes the filter menu first, then the sheet.
  const onRequestClose = useCallback(() => (sheetOpen ? closeSheet() : onClose()), [sheetOpen, closeSheet, onClose]);

  const refreshControl = useMemo(
    () => (
      <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
    ),
    [refreshing, onRefresh, colors.primary]
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
        action={{ label: t("Retry"), onPress: () => load(true) }}
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
        paddingBottom={insets.bottom + 24}
        onOpen={onOpenTitle}
        refreshControl={refreshControl}
      />
    );
  }

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      onRequestClose={onRequestClose}
      height={SHEET_HEIGHT}
      header={<SheetHeader title={t(copy.title, { username })} onClose={onClose} />}
      overlay={
        <CollectionFilterSheet
          inline
          visible={sheetOpen}
          onClose={closeSheet}
          filters={query.filters}
          onAction={query.onFilterAction}
          resultCount={query.visible.length}
          sortGroups={kind === "watched" ? PUBLIC_WATCHED_SORT_GROUPS : WATCHLIST_SORT_GROUPS}
          showRatedFilter={kind === "watched"}
        />
      }
    >
      <View style={styles.top}>
        <CollectionSearchBar
          placeholder={t(copy.search)}
          initialQuery={query.query}
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
      <View style={styles.body}>{body}</View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: COLLECTION_GRID.paddingX, paddingTop: 6, paddingBottom: 10, gap: 10 },
  toolbarPlaceholder: { alignSelf: "flex-start", height: TOOLBAR_HEIGHT },
  body: { flex: 1 },
});

export default memo(PublicCollectionSheet);
