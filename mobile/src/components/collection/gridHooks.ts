import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Animated,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from "react-native";
import { initialTracking, nextBand, rowHeightOf, trackChange, type GridMetrics, type RowBand, type TrackedGrid } from "./gridModel";

// The behaviour the animated poster grid (CollectionGrid) is built from:
// following changes so tiles glide instead of remounting, mounting only the
// rows near the viewport, and fading through a reorder.

const REORDER_FADE_FROM = 0.35;
const REORDER_FADE_MS = 220;

/**
 * The grid's items with what just changed about them (see trackChange).
 * `keyOf` must be stable, e.g. a module-level function.
 *
 * Derived from the previous items during render, React's pattern for state
 * that depends on how a prop changed. Doing it in an effect would commit one
 * frame with a removed tile already unmounted and remount it as a ghost after:
 * the exact flash the grid exists to avoid.
 */
export function useTrackedItems<T>(items: readonly T[], keyOf: (item: T) => string, exitMs: number): TrackedGrid<T> {
  const [tracked, setTracked] = useState(() => initialTracking(items, keyOf));
  let view = tracked;
  if (tracked.items !== items) {
    view = trackChange(tracked, items, keyOf, exitMs, Date.now());
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

  return view;
}

/**
 * Row virtualization: the band of rows to mount for the scroll position. The
 * band reaches about a screen beyond the viewport and only moves every few
 * rows, so scrolling re-renders the grid rarely.
 */
export function useRowBand(metrics: GridMetrics, windowHeight: number) {
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

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    scrollY.current = 0;
    updateBand(true);
  }, [updateBand]);

  return { scrollRef, band, onScroll, onLayout, scrollToTop };
}

/**
 * A new sort or search result starts from the top, the way a new result list
 * reads, and swaps in behind a short fade instead of dozens of tiles flying
 * across each other. Returns the opacity for the grid's content.
 */
export function useReorderFade(reorders: number, onReorder: () => void): Animated.Value {
  const fade = useRef(new Animated.Value(1)).current;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  useLayoutEffect(() => {
    if (reorders === 0) return;
    onReorderRef.current();
    fade.setValue(REORDER_FADE_FROM);
    Animated.timing(fade, { toValue: 1, duration: REORDER_FADE_MS, useNativeDriver: true }).start();
  }, [reorders, fade]);

  return fade;
}
