import { memo, useMemo, useRef, type ReactElement } from "react";
import { Animated, ScrollView, StyleSheet, useWindowDimensions, type RefreshControlProps } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { collectionKey, type CollectionEntry } from "../../utils/collectionQuery";
import CollectionPosterTile, { EXIT_MS, createTileStyles } from "./CollectionPosterTile";
import { AD_ROW_INTERVAL, adRowY, contentHeight, contentHeightWithAds, tilePosition, tilePositionWithAds, type GridMetrics } from "./gridModel";
import { useReorderFade, useRowBand, useTrackedItems } from "./gridHooks";
import AdBanner from "../ads/AdBanner";

const noop = () => {};
// A fixed reserved height, not measured — this grid absolutely-positions
// every tile from pure index math (see gridModel.ts's own doc comment), so
// an ad row needs a known height up front rather than an organic-flow
// `onLayout`. LARGE_ANCHORED_ADAPTIVE_BANNER's real rendered height varies
// a little by device width; this is a generous estimate (banner + the
// "Upgrade to remove ads" link once a real ad has loaded) rather than an
// exact measurement, same tradeoff this whole grid already makes for tile
// sizing.
const AD_ROW_HEIGHT = 100;

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
  /** Which AD_UNIT_IDS entry this collection's rows carry — Watched List and
   * Watchlist each need their own (see CollectionConfig.adUnitId). Omitted
   * entirely (ListDetailScreen's own per-list grid, not part of this ad
   * spec) skips ad rows altogether rather than defaulting to one. */
  adUnitId?: string;
  /** Poll-selection mode (Watchlist only — CollectionScreen.tsx's own poll
   * flow, replacing the old separate CreatePollModal grid). Mutually
   * exclusive with `editing` in practice. A tap toggles selection instead of
   * opening/removing; capped at `selectionMax` (3, the poll's own limit). */
  selectionMode?: boolean;
  selected?: CollectionEntry[];
  selectionMax?: number;
  onToggleSelect?: (entry: CollectionEntry) => void;
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
// in around it. Virtualization is by rows (gridHooks.ts).
function CollectionGrid({
  entries,
  metrics,
  paddingBottom,
  onOpen,
  onRemove,
  editing = false,
  editProgress,
  refreshControl,
  adUnitId,
  selectionMode = false,
  selected = [],
  selectionMax = 3,
  onToggleSelect,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { height: windowHeight } = useWindowDimensions();

  const editable = onRemove !== undefined;
  const selectionAtCap = selected.length >= selectionMax;
  const selectionIndexOf = (entry: CollectionEntry) => {
    const i = selected.findIndex((s) => s.id === entry.id && s.type === entry.type);
    return i === -1 ? null : i;
  };
  const idleProgress = useRef(new Animated.Value(0)).current;
  const progress = editProgress ?? idleProgress;
  const removeTile = onRemove ?? noop;

  const view = useTrackedItems(entries, collectionKey, EXIT_MS);
  const { scrollRef, band, onScroll, onLayout, scrollToTop } = useRowBand(metrics, windowHeight);
  const fade = useReorderFade(view.reorders, scrollToTop);

  const tileStyles = useMemo(() => createTileStyles(colors), [colors]);
  const overlayScale = useMemo(() => progress.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }), [progress]);
  const removeLabel = t("Remove");
  const { columns, tileWidth, tileHeight } = metrics;
  const inBand = (index: number) => {
    const row = Math.floor(index / columns);
    return row >= band.first && row <= band.last;
  };
  // Ad rows are opt-in per caller (adUnitId) and suppressed while editing or
  // picking poll items — everyone else (ListDetailScreen's own per-list
  // grid, or mid-drag/remove/select) gets back the exact plain geometry
  // this grid always had, zero change.
  const adsEnabled = !editing && !selectionMode && !!adUnitId;
  const positionOf = (index: number) => (adsEnabled ? tilePositionWithAds(index, metrics, AD_ROW_HEIGHT) : tilePosition(index, metrics));

  const tiles: ReactElement[] = [];
  // Ghosts first, so posters gliding into their slot draw over the exit.
  for (const ghost of view.ghosts) {
    if (!inBand(ghost.index)) continue;
    const { x, y } = positionOf(ghost.index);
    tiles.push(
      <CollectionPosterTile
        key={ghost.key}
        entry={ghost.item}
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
        selectionMode={selectionMode}
        selected={selectionIndexOf(ghost.item) != null}
        selectionIndex={selectionIndexOf(ghost.item)}
        selectionAtCap={selectionAtCap}
        onToggleSelect={onToggleSelect}
      />
    );
  }
  const lastIndex = Math.min(view.items.length - 1, (band.last + 1) * columns - 1);
  for (let index = band.first * columns; index <= lastIndex; index++) {
    const key = view.keys[index];
    const { x, y } = positionOf(index);
    tiles.push(
      <CollectionPosterTile
        key={key}
        entry={view.items[index]}
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
        selectionMode={selectionMode}
        selected={selectionIndexOf(view.items[index]) != null}
        selectionIndex={selectionIndexOf(view.items[index])}
        selectionAtCap={selectionAtCap}
        onToggleSelect={onToggleSelect}
      />
    );
  }

  // The content keeps the height it had until ghosts finish, so removing from
  // the last row doesn't yank the scroll position mid-animation.
  let count = view.items.length;
  for (const ghost of view.ghosts) count = Math.max(count, ghost.index + 1);

  // Suppressed while editing — an ad interleaved between rows the user is
  // actively dragging/removing would be visual noise, not a real placement
  // (same call MyListsScreen.tsx's own edit mode makes). AD_ROW_INTERVAL's
  // small group count (every 3 rows) means a plain loop over every group,
  // filtered against the current band, is cheap even for a large
  // collection — no extra indexing structure needed.
  const adRows: ReactElement[] = [];
  if (adsEnabled) {
    const totalRows = Math.ceil(count / columns);
    const groupCount = Math.floor(totalRows / AD_ROW_INTERVAL);
    for (let g = 0; g < groupCount; g++) {
      const anchorRow = (g + 1) * AD_ROW_INTERVAL - 1;
      if (anchorRow < band.first - 1 || anchorRow > band.last + 1) continue;
      adRows.push(
        <Animated.View key={`ad-${g}`} style={{ position: "absolute", left: 0, right: 0, top: adRowY(g, metrics, AD_ROW_HEIGHT) }}>
          <AdBanner unitId={adUnitId as string} />
        </Animated.View>
      );
    }
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.fill}
      contentContainerStyle={{ height: adsEnabled ? contentHeightWithAds(count, metrics, paddingBottom, AD_ROW_HEIGHT) : contentHeight(count, metrics, paddingBottom) }}
      onScroll={onScroll}
      onLayout={onLayout}
      scrollEventThrottle={16}
      refreshControl={refreshControl}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        {tiles}
        {adRows}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });

export default memo(CollectionGrid);
