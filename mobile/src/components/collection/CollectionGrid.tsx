import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from "react";
import {
  Animated,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type RefreshControlProps,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { collectionKey, type CollectionEntry } from "../../utils/collectionQuery";
import CollectionPosterTile, { EXIT_MS, createTileStyles, type TileMotion } from "./CollectionPosterTile";
import { classifyChange, contentHeight, nextBand, rowHeightOf, tilePosition, type GridMetrics, type RowBand } from "./gridModel";

const entryKey = collectionKey;

const NO_KEYS: ReadonlySet<string> = new Set();
const REORDER_FADE_FROM = 0.35;
const REORDER_FADE_MS = 220;
const noop = () => {};

interface Ghost {
  entry: CollectionEntry;
  key: string;
  /** Its index in the list it was removed from, which fixes where it plays its exit. */
  index: number;
  expiresAt: number;
}

interface Tracked {
  entries: CollectionEntry[];
  keys: string[];
  motion: TileMotion;
  appearing: ReadonlySet<string>;
  ghosts: Ghost[];
  /** Bumped on every reorder, to trigger the fade. */
  reorders: number;
}

const initialTracked = (entries: CollectionEntry[]): Tracked => ({
  entries,
  keys: entries.map(entryKey),
  motion: "snap",
  appearing: NO_KEYS,
  ghosts: [],
  reorders: 0,
});

function track(previous: Tracked, entries: CollectionEntry[]): Tracked {
  const keys = entries.map(entryKey);
  const change = classifyChange(previous.keys, keys);
  if (change.kind === "reorder") {
    return { entries, keys, motion: "snap", appearing: NO_KEYS, ghosts: [], reorders: previous.reorders + 1 };
  }
  const now = Date.now();
  const present = new Set(keys);
  // A title put back by Undo while its exit is still playing stops being a ghost.
  let ghosts = previous.ghosts.filter((ghost) => ghost.expiresAt > now && !present.has(ghost.key));
  if (change.kind === "removal") {
    ghosts = ghosts.concat(
      change.removed.map((index) => ({
        entry: previous.entries[index],
        key: previous.keys[index],
        index,
        expiresAt: now + EXIT_MS,
      }))
    );
  }
  return {
    entries,
    keys,
    motion: change.kind === "same" ? previous.motion : "glide",
    appearing: change.kind === "insertion" ? new Set(change.added.map((index) => keys[index])) : NO_KEYS,
    ghosts,
    reorders: previous.reorders,
  };
}

interface Props {
  entries: CollectionEntry[];
  metrics: GridMetrics;
  paddingBottom: number;
  onOpen: (entry: CollectionEntry) => void;
  /**
   * Makes the grid editable. Without it the grid is strictly read-only: no
   * remove overlay is rendered and a tap can only open a title.
   */
  onRemove?: (entry: CollectionEntry) => void;
  editing?: boolean;
  /** Shared 0 -> 1 edit-mode value; only meaningful with onRemove. */
  editProgress?: Animated.Value;
  /** Must be memoized by the caller; a new element every render defeats this component's memo. */
  refreshControl?: ReactElement<RefreshControlProps>;
}

// The poster grid behind every collection view.
//
// A FlatList with numColumns groups items into row cells keyed by the items
// they contain. Removing one title shifts every later title into a different
// row, so every row below it gets a new key and remounts: every poster below
// reloads and fades in from blank. That was the "full page refresh" after a
// removal.
//
// Here every poster is absolutely positioned from its index and keyed by its
// title, all under one parent. A removal changes only indices: nothing
// remounts, and each poster glides to its new slot — wrapping up to the
// previous row included — as a native animation. The removed poster stays for
// its exit animation as a "ghost" at its old position while the others move
// in around it.
//
// Virtualization is by rows: only the rows within about a screen of the
// viewport are mounted, and the mounted band only moves every few rows.
function CollectionGrid({
  entries,
  metrics,
  paddingBottom,
  onOpen,
  onRemove,
  editing = false,
  editProgress,
  refreshControl,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { height: windowHeight } = useWindowDimensions();

  const editable = onRemove !== undefined;
  const idleProgress = useRef(new Animated.Value(0)).current;
  const progress = editProgress ?? idleProgress;
  const removeTile = onRemove ?? noop;

  // Derived from the previous entries during render — React's pattern for
  // state that depends on how a prop changed. Doing this in an effect instead
  // would commit one frame with the removed poster unmounted, and remount it
  // as a ghost after: the exact flash this component exists to avoid.
  const [tracked, setTracked] = useState(() => initialTracked(entries));
  let view = tracked;
  if (tracked.entries !== entries) {
    view = track(tracked, entries);
    setTracked(view);
  }

  // Drop ghosts once their exit has played.
  useEffect(() => {
    if (tracked.ghosts.length === 0) return;
    const soonest = Math.min(...tracked.ghosts.map((ghost) => ghost.expiresAt));
    const timer = setTimeout(() => {
      setTracked((current) => {
        const now = Date.now();
        const ghosts = current.ghosts.filter((ghost) => ghost.expiresAt > now);
        return ghosts.length === current.ghosts.length ? current : { ...current, ghosts };
      });
    }, Math.max(0, soonest - Date.now()) + 16);
    return () => clearTimeout(timer);
  }, [tracked.ghosts]);

  // ---- Virtualization -----------------------------------------------------

  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const viewportHeight = useRef(windowHeight);
  const overscanRows = Math.max(3, Math.ceil(windowHeight / rowHeightOf(metrics)));
  const [band, setBand] = useState<RowBand>(() => nextBand(null, 0, windowHeight, metrics, overscanRows));
  const bandRef = useRef(band);

  const updateBand = useCallback(
    (recompute: boolean) => {
      const current = bandRef.current;
      const next = nextBand(recompute ? null : current, scrollY.current, viewportHeight.current, metrics, overscanRows);
      if (next === current || (next.first === current.first && next.last === current.last)) return;
      bandRef.current = next;
      setBand(next);
    },
    [metrics, overscanRows]
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.current = event.nativeEvent.contentOffset.y;
      updateBand(false);
    },
    [updateBand]
  );

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      viewportHeight.current = event.nativeEvent.layout.height;
      updateBand(true);
    },
    [updateBand]
  );

  // Metrics change with the window width (rotation, split screen).
  useEffect(() => updateBand(true), [updateBand]);

  // ---- Reorders -------------------------------------------------------------

  // A new sort, filter or search result starts from the top, the way a new
  // result list reads, and swaps in behind a short fade instead of dozens of
  // posters flying across each other.
  const fade = useRef(new Animated.Value(1)).current;
  useLayoutEffect(() => {
    if (tracked.reorders === 0) return;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    scrollY.current = 0;
    updateBand(true);
    fade.setValue(REORDER_FADE_FROM);
    Animated.timing(fade, { toValue: 1, duration: REORDER_FADE_MS, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracked.reorders]);

  // ---- Tiles ----------------------------------------------------------------

  const tileStyles = useMemo(() => createTileStyles(colors), [colors]);
  const overlayScale = useMemo(() => progress.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }), [progress]);
  const removeLabel = t("Remove");
  const { columns, tileWidth, tileHeight } = metrics;
  const inBand = (index: number) => {
    const row = Math.floor(index / columns);
    return row >= band.first && row <= band.last;
  };

  const tiles: ReactElement[] = [];
  // Ghosts first, so posters gliding into their slot draw over the exit.
  for (const ghost of view.ghosts) {
    if (!inBand(ghost.index)) continue;
    const { x, y } = tilePosition(ghost.index, metrics);
    tiles.push(
      <CollectionPosterTile
        key={ghost.key}
        entry={ghost.entry}
        x={x}
        y={y}
        width={tileWidth}
        height={tileHeight}
        editing={editing}
        editable={editable}
        editProgress={progress}
        overlayScale={overlayScale}
        motion="snap"
        appearing={false}
        leaving
        onOpen={onOpen}
        onRemove={removeTile}
        styles={tileStyles}
        placeholderColor={colors.placeholder}
        removeLabel={removeLabel}
      />
    );
  }
  const lastIndex = Math.min(view.entries.length - 1, (band.last + 1) * columns - 1);
  for (let index = band.first * columns; index <= lastIndex; index++) {
    const entry = view.entries[index];
    const key = view.keys[index];
    const { x, y } = tilePosition(index, metrics);
    tiles.push(
      <CollectionPosterTile
        key={key}
        entry={entry}
        x={x}
        y={y}
        width={tileWidth}
        height={tileHeight}
        editing={editing}
        editable={editable}
        editProgress={progress}
        overlayScale={overlayScale}
        motion={view.motion}
        appearing={view.appearing.has(key)}
        leaving={false}
        onOpen={onOpen}
        onRemove={removeTile}
        styles={tileStyles}
        placeholderColor={colors.placeholder}
        removeLabel={removeLabel}
      />
    );
  }

  // The content keeps the height it had until ghosts finish, so removing from
  // the last row doesn't yank the scroll position mid-animation.
  let count = view.entries.length;
  for (const ghost of view.ghosts) count = Math.max(count, ghost.index + 1);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.fill}
      contentContainerStyle={{ height: contentHeight(count, metrics, paddingBottom) }}
      onScroll={onScroll}
      onLayout={onLayout}
      scrollEventThrottle={16}
      refreshControl={refreshControl}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>{tiles}</Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });

export default memo(CollectionGrid);
