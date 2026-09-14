import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, BackHandler, RefreshControl, StyleSheet, View, useWindowDimensions } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useProfile } from "../context/ProfileContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import type { CollectionCache } from "../api/collectionCache";
import type { CollectionEntry } from "../utils/collectionQuery";
import CollectionSearchBar from "../components/collection/CollectionSearchBar";
import CollectionToolbar from "../components/collection/CollectionToolbar";
import CollectionFilterSheet from "../components/collection/CollectionFilterSheet";
import CollectionGrid from "../components/collection/CollectionGrid";
import CollectionUndoBar from "../components/collection/CollectionUndoBar";
import { CollectionSkeleton, CollectionStateView } from "../components/collection/CollectionStates";
import { COLLECTION_GRID, useCollectionQuery, useGridMetrics } from "../components/collection/useCollectionQuery";
import type { SortGroupSpec } from "../components/collection/filterLabels";

const GRID_PADDING_BOTTOM = 110;
const UNDO_MS = 4000;

type Status = "loading" | "ready" | "error";

export interface CollectionConfig {
  cache: CollectionCache;
  /** Route prefix whose stack holds the title detail pages, e.g. "/watchlist". */
  basePath: string;
  sortGroups: SortGroupSpec[];
  showRatedFilter: boolean;
  /** i18n keys. */
  strings: {
    searchPlaceholder: string;
    removed: string;
    loadFailed: string;
    emptyTitle: string;
    emptyText: string;
  };
}

interface Props {
  /** Must be a stable, module-level object. */
  config: CollectionConfig;
  /** Called with the loaded list whenever it changes. Must be stable. */
  onEntriesChange?: (entries: CollectionEntry[]) => void;
}

const sameEntry = (a: CollectionEntry, b: CollectionEntry) => a.id === b.id && a.type === b.type;

// The signed-in user's Watched List and Watchlist: one implementation,
// configured per list, so the two pages can't drift apart. The public
// profile's read-only list sheets (PublicCollectionSheet) are built from the
// same pieces.
//
// Everything a query needs is already in memory: the list comes from its
// collection cache (instant on revisit, refreshed underneath) and search,
// filters and sorting run on the device through useCollectionQuery. So
// typing, filtering and sorting never wait on the network.
function CollectionScreen({ config, onEntriesChange }: Props) {
  const { cache, basePath, sortGroups, showRatedFilter, strings } = config;
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { refresh: refreshProfile } = useProfile();
  const { showToast } = useToast();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();

  const userId = user?._id ?? "";
  const [entries, setEntries] = useState<CollectionEntry[]>(() => (userId ? cache.getCached(userId) : null) ?? []);
  const [status, setStatus] = useState<Status>(() => (userId && cache.getCached(userId) ? "ready" : "loading"));
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [undoEntry, setUndoEntry] = useState<CollectionEntry | null>(null);

  useEffect(() => cache.subscribe(setEntries), [cache]);

  useEffect(() => {
    if (status === "ready") onEntriesChange?.(entries);
  }, [status, entries, onEntriesChange]);

  // ---- Loading ------------------------------------------------------------

  // showToast is recreated on every ToastProvider render. A callback that
  // depended on it would re-run the focus effect below whenever a toast
  // appeared anywhere — and that effect's cleanup commits a pending removal,
  // cutting its undo window short. Reading these through refs keeps every
  // callback below stable.
  const toastRef = useRef(showToast);
  toastRef.current = showToast;
  const tRef = useRef(t);
  tRef.current = t;
  const refreshProfileRef = useRef(refreshProfile);
  refreshProfileRef.current = refreshProfile;

  const load = useCallback(() => {
    if (!userId) return Promise.resolve();
    return cache
      .load(userId)
      .then(() => setStatus("ready"))
      .catch(() => {
        // A failed refresh over a list that's already on screen isn't worth
        // replacing that list with an error; a failed first load is.
        if (cache.getCached(userId)) toastRef.current(tRef.current(strings.loadFailed));
        else setStatus("error");
      });
  }, [cache, userId, strings.loadFailed]);

  // ---- Removal with undo --------------------------------------------------

  const pendingRef = useRef<{ entry: CollectionEntry; timer: ReturnType<typeof setTimeout> } | null>(null);

  const commit = useCallback(
    (entry: CollectionEntry) => {
      cache
        .commitRemoval(entry)
        // The profile's counts are built from these lists — and on the
        // Watched List, from the rating the server dropped along with it.
        .then(() => refreshProfileRef.current({ force: true }))
        .catch((e: any) => toastRef.current(e?.response?.data?.message || tRef.current("Failed to remove item.")));
    },
    [cache]
  );

  const flushPending = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    setUndoEntry(null);
    commit(pending.entry);
  }, [commit]);

  // The poster leaves the grid on this very call: hide() updates the cache
  // synchronously, and the grid glides the rest into place. The delete itself
  // waits out the undo window.
  const handleRemove = useCallback(
    (entry: CollectionEntry) => {
      // A second tap on a poster already on its way out.
      if (pendingRef.current && sameEntry(pendingRef.current.entry, entry)) return;
      // One pending removal at a time: a second removal commits the first
      // rather than silently extending its undo window.
      flushPending();
      cache.hide(entry);
      const timer = setTimeout(() => {
        if (pendingRef.current?.entry !== entry) return;
        pendingRef.current = null;
        setUndoEntry(null);
        commit(entry);
      }, UNDO_MS);
      pendingRef.current = { entry, timer };
      setUndoEntry(entry);
    },
    [cache, flushPending, commit]
  );

  const handleUndo = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    setUndoEntry(null);
    cache.restore(pending.entry);
  }, [cache]);

  // ---- Focus --------------------------------------------------------------

  const editingRef = useRef(editing);
  editingRef.current = editing;

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      if (!cache.getCached(userId)) {
        setStatus("loading");
        load();
      } else if (!cache.isFresh()) {
        load();
      }

      // This screen is the root of a hidden tab, and the tab navigator's
      // default back behaviour would drop the user on Home. Its only entry
      // point is the Profile drawer, so back goes there — or just leaves
      // edit mode first, the way a modal state should.
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        if (editingRef.current) {
          setEditing(false);
          return true;
        }
        router.navigate("/profile");
        return true;
      });

      return () => {
        subscription.remove();
        // Leaving with a removal still in its undo window commits it now,
        // rather than letting a timer fire against an unmounted screen.
        flushPending();
      };
    }, [cache, userId, load, router, flushPending])
  );

  useEffect(() => () => flushPending(), [flushPending]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }, [load]);

  // ---- Query --------------------------------------------------------------

  const query = useCollectionQuery(entries);

  // ---- Edit mode ----------------------------------------------------------

  const editProgress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(editProgress, { toValue: editing ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [editing, editProgress]);

  // Nothing left to edit — leave edit mode rather than showing a lone "Done".
  useEffect(() => {
    if (editing && entries.length === 0) setEditing(false);
  }, [editing, entries.length]);

  const toggleEdit = useCallback(() => setEditing((current) => !current), []);

  const openEntry = useCallback(
    (entry: CollectionEntry) => router.push(`${basePath}/content/${entry.type}/${entry.id}` as any),
    [router, basePath]
  );

  // ---- Layout -------------------------------------------------------------

  const metrics = useGridMetrics(screenWidth);

  // Memoized so the grid's memo holds across this screen's own re-renders.
  const refreshControl = useMemo(
    () => (
      <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
    ),
    [refreshing, onRefresh, colors.primary]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.base100 },
        top: { paddingHorizontal: COLLECTION_GRID.paddingX, paddingTop: 12, paddingBottom: 10, gap: 10 },
        loadingIndicator: { alignSelf: "flex-start", height: 36 },
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
        title={t(strings.loadFailed)}
        text={t("Check your connection and try again.")}
        action={{
          label: t("Retry"),
          onPress: () => {
            setStatus("loading");
            load();
          },
        }}
      />
    );
  } else if (entries.length === 0) {
    body = <CollectionStateView icon="film-outline" title={t(strings.emptyTitle)} text={t(strings.emptyText)} />;
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
        editing={editing}
        editProgress={editProgress}
        onOpen={openEntry}
        onRemove={handleRemove}
        refreshControl={refreshControl}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <CollectionSearchBar
          placeholder={t(strings.searchPlaceholder)}
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
            editing={editing}
            canEdit={query.visible.length > 0}
            onToggleEdit={toggleEdit}
          />
        ) : status === "loading" ? (
          <ActivityIndicator size="small" color={colors.placeholder} style={styles.loadingIndicator} />
        ) : null}
      </View>

      {body}

      <CollectionUndoBar entry={undoEntry} message={t(strings.removed)} durationMs={UNDO_MS} onUndo={handleUndo} />

      <CollectionFilterSheet
        visible={query.sheetOpen}
        onClose={query.closeSheet}
        filters={query.filters}
        onAction={query.onFilterAction}
        resultCount={query.visible.length}
        sortGroups={sortGroups}
        showRatedFilter={showRatedFilter}
      />
    </View>
  );
}

export default memo(CollectionScreen);
