import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, BackHandler, RefreshControl, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Pressable from "../components/common/TapSafePressable";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
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
import { createShare } from "../api/shareService";
import { useRecentShares } from "../context/RecentSharesContext";
import { useComposeTutorial } from "../context/ComposeTutorialContext";
import TutorialSpotlight from "../components/tutorial/TutorialSpotlight";
import TutorialInfoBox from "../components/tutorial/TutorialInfoBox";
import { fonts } from "../theme/typography";

const GRID_PADDING_BOTTOM = 110;
const UNDO_MS = 4000;
const POLL_MIN_ITEMS = 2;
const POLL_MAX_ITEMS = 3;

type Status = "loading" | "ready" | "error";

export interface CollectionConfig {
  cache: CollectionCache;
  /** Route prefix whose stack holds the title detail pages, e.g. "/watchlist". */
  basePath: string;
  sortGroups: SortGroupSpec[];
  showRatedFilter: boolean;
  /** Only the Watchlist (to-watch queue) sets this — "what should I watch
   * next?" polls only make sense against titles still queued, not already
   * watched. Adds a small poll-icon accessory to the toolbar when set. */
  allowPoll?: boolean;
  /** Which AD_UNIT_IDS entry this collection's rows carry — Watched List and
   * Watchlist each need their own, direct ask ("kart satırları arasında"). */
  adUnitId: string;
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
// profile's read-only Watched List and Watchlist pages
// (PublicCollectionScreen) are built from the same pieces.
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
  const { announce: announceNewShare } = useRecentShares();
  // "Poll" compose-tutorial walkthrough (Shares' "+" menu) — a single step,
  // no cross-screen handoff needed: starting it already lands here with
  // the poll button highlighted, and the poll-selection mode it opens
  // already carries its own instructions (the bar above), so the tutorial
  // itself ends the moment that button is tapped.
  const { tutorial: composeTutorial, endTutorial: endComposeTutorial } = useComposeTutorial();
  const showPollButtonTutorial = !!(composeTutorial?.id === "poll" && composeTutorial.step === "tapPollButton" && config.allowPoll);
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();

  const userId = user?._id ?? "";
  const [entries, setEntries] = useState<CollectionEntry[]>(() => (userId ? cache.getCached(userId) : null) ?? []);
  const [status, setStatus] = useState<Status>(() => (userId && cache.getCached(userId) ? "ready" : "loading"));
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [undoEntry, setUndoEntry] = useState<CollectionEntry | null>(null);
  // Poll-selection mode — direct ask, replacing the old separate
  // CreatePollModal (its own duplicate FlatList grid) with picking items
  // straight from this screen's own existing card grid: "var olan watchlist
  // kart diziliminden seçilsin... bir moda girmek gibi düşün."
  const [pollSelecting, setPollSelecting] = useState(false);
  const [pollSelected, setPollSelected] = useState<CollectionEntry[]>([]);
  const [creatingPoll, setCreatingPoll] = useState(false);

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
  const pollSelectingRef = useRef(pollSelecting);
  pollSelectingRef.current = pollSelecting;

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
      // edit/poll-selection mode first, the way a modal state should.
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        if (pollSelectingRef.current) {
          setPollSelecting(false);
          setPollSelected([]);
          return true;
        }
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

  // Same for poll-selection — nothing left to pick from.
  useEffect(() => {
    if (pollSelecting && entries.length === 0) {
      setPollSelecting(false);
      setPollSelected([]);
    }
  }, [pollSelecting, entries.length]);

  const toggleEdit = useCallback(() => setEditing((current) => !current), []);

  const openEntry = useCallback(
    (entry: CollectionEntry) => router.push(`${basePath}/content/${entry.type}/${entry.id}` as any),
    [router, basePath]
  );

  // ---- Poll selection -------------------------------------------------------

  const startPollSelecting = useCallback(() => {
    setEditing(false);
    setPollSelected([]);
    setPollSelecting(true);
    endComposeTutorial();
  }, [endComposeTutorial]);

  const exitPollSelecting = useCallback(() => {
    setPollSelecting(false);
    setPollSelected([]);
    setCreatingPoll(false);
  }, []);

  const togglePollSelect = useCallback((entry: CollectionEntry) => {
    setPollSelected((prev) => {
      if (prev.some((s) => s.id === entry.id && s.type === entry.type)) {
        return prev.filter((s) => !(s.id === entry.id && s.type === entry.type));
      }
      if (prev.length >= POLL_MAX_ITEMS) return prev;
      return [...prev, entry];
    });
  }, []);

  const handleCreatePoll = useCallback(async () => {
    if (pollSelected.length < POLL_MIN_ITEMS) return;
    setCreatingPoll(true);
    try {
      const share = await createShare({
        type: "poll",
        items: pollSelected.map((s) => ({ contentId: s.id, contentType: s.type })),
      });
      announceNewShare(share);
      showToast(t("Shared to Media"));
      exitPollSelecting();
    } catch (e: any) {
      showToast(e?.response?.data?.message || t("Something went wrong. Please try again."));
      setCreatingPoll(false);
    }
  }, [pollSelected, announceNewShare, showToast, t, exitPollSelecting]);

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
        pollButton: {
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.base200,
          borderWidth: 1,
          borderColor: colors.border,
        },
        // Replaces the normal CollectionSearchBar/CollectionToolbar row
        // while picking poll items — direct ask, selection happens straight
        // on this screen's own grid now, not a separate modal screen.
        pollSelectBar: {
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: COLLECTION_GRID.paddingX,
          paddingTop: 12,
          paddingBottom: 10,
        },
        pollSelectText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.baseContent },
        pollCreateButton: {
          backgroundColor: colors.primary,
          borderRadius: 10,
          paddingVertical: 8,
          paddingHorizontal: 14,
        },
        pollCreateButtonDisabled: { opacity: 0.5 },
        pollCreateButtonText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primaryContent },
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
        adUnitId={config.adUnitId}
        selectionMode={pollSelecting}
        selected={pollSelected}
        selectionMax={POLL_MAX_ITEMS}
        onToggleSelect={togglePollSelect}
      />
    );
  }

  return (
    <View style={styles.screen}>
      {pollSelecting ? (
        // Replaces the normal search/toolbar row entirely while picking
        // poll items — a distinct, unmistakable "mode," same idea as edit
        // mode's own Done/count row, direct ask ("bir moda girmek gibi
        // düşün"). Search/filter stay off here: narrowing the list while
        // indices are being tapped risked exactly the kind of confusion
        // CollectionGrid.tsx's own design doc already flags for this grid.
        <View style={styles.pollSelectBar}>
          <Pressable onPress={exitPollSelecting} hitSlop={8} accessibilityLabel={t("Cancel")}>
            <Ionicons name="close" size={22} color={colors.baseContent} />
          </Pressable>
          <Text style={styles.pollSelectText}>{t("Pick 2 or 3 titles from your Watchlist")}</Text>
          <Pressable
            style={[styles.pollCreateButton, pollSelected.length < POLL_MIN_ITEMS && styles.pollCreateButtonDisabled]}
            onPress={handleCreatePoll}
            disabled={pollSelected.length < POLL_MIN_ITEMS || creatingPoll}
          >
            {creatingPoll ? (
              <ActivityIndicator color={colors.primaryContent} size="small" />
            ) : (
              <Text style={styles.pollCreateButtonText}>
                {t("Create Poll ({{count}}/{{max}})", { count: pollSelected.length, max: POLL_MAX_ITEMS })}
              </Text>
            )}
          </Pressable>
        </View>
      ) : (
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
              accessory={
                config.allowPoll && !editing ? (
                  <TutorialSpotlight active={showPollButtonTutorial} borderRadius={20}>
                    <Pressable
                      style={styles.pollButton}
                      onPress={startPollSelecting}
                      disabled={entries.length < 2}
                      accessibilityLabel={t("Create Poll")}
                    >
                      <Ionicons name="stats-chart-outline" size={16} color={entries.length < 2 ? colors.placeholder : colors.baseContent} />
                    </Pressable>
                  </TutorialSpotlight>
                ) : undefined
              }
              editing={editing}
              canEdit={query.visible.length > 0}
              onToggleEdit={toggleEdit}
            />
          ) : status === "loading" ? (
            <ActivityIndicator size="small" color={colors.placeholder} style={styles.loadingIndicator} />
          ) : null}
          {showPollButtonTutorial && (
            <TutorialInfoBox text={t("Tap here to create a poll from your Watchlist.")} onDismiss={endComposeTutorial} />
          )}
        </View>
      )}

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
