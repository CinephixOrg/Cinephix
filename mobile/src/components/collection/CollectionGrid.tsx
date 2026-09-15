import { memo, useMemo, useRef, type ReactElement } from "react";
import { Animated, ScrollView, StyleSheet, useWindowDimensions, type RefreshControlProps } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { collectionKey, type CollectionEntry } from "../../utils/collectionQuery";
import CollectionPosterTile, { EXIT_MS, createTileStyles } from "./CollectionPosterTile";
import { contentHeight, tilePosition, type GridMetrics } from "./gridModel";
import { useReorderFade, useRowBand, useTrackedItems } from "./gridHooks";

const noop = () => {};

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
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { height: windowHeight } = useWindowDimensions();

  const editable = onRemove !== undefined;
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

  const tiles: ReactElement[] = [];
  // Ghosts first, so posters gliding into their slot draw over the exit.
  for (const ghost of view.ghosts) {
    if (!inBand(ghost.index)) continue;
    const { x, y } = tilePosition(ghost.index, metrics);
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
      />
    );
  }
  const lastIndex = Math.min(view.items.length - 1, (band.last + 1) * columns - 1);
  for (let index = band.first * columns; index <= lastIndex; index++) {
    const key = view.keys[index];
    const { x, y } = tilePosition(index, metrics);
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
      />
    );
  }

  // The content keeps the height it had until ghosts finish, so removing from
  // the last row doesn't yank the scroll position mid-animation.
  let count = view.items.length;
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
