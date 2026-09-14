// Geometry and change detection behind CollectionGrid.
//
// Pure and React-free so it runs under `node --test` (gridModel.test.mts).
// The grid positions every poster from its index alone, which is what lets a
// poster keep its identity while it moves — see CollectionGrid for why that
// matters.

export interface GridMetrics {
  columns: number;
  tileWidth: number;
  tileHeight: number;
  gap: number;
  paddingX: number;
  paddingTop: number;
}

export function computeMetrics(
  screenWidth: number,
  { columns, gap, paddingX, paddingTop, posterRatio }: { columns: number; gap: number; paddingX: number; paddingTop: number; posterRatio: number }
): GridMetrics {
  const tileWidth = Math.max(1, Math.floor((screenWidth - paddingX * 2 - gap * (columns - 1)) / columns));
  return { columns, tileWidth, tileHeight: Math.round(tileWidth * posterRatio), gap, paddingX, paddingTop };
}

export const rowHeightOf = (m: GridMetrics) => m.tileHeight + m.gap;

export function tilePosition(index: number, m: GridMetrics): { x: number; y: number } {
  const column = index % m.columns;
  const row = Math.floor(index / m.columns);
  return { x: m.paddingX + column * (m.tileWidth + m.gap), y: m.paddingTop + row * rowHeightOf(m) };
}

export function contentHeight(count: number, m: GridMetrics, paddingBottom: number): number {
  const rows = Math.ceil(count / m.columns);
  return m.paddingTop + rows * m.tileHeight + Math.max(rows - 1, 0) * m.gap + paddingBottom;
}

// ---------------------------------------------------------------------------
// What kind of change turned one list into the next
// ---------------------------------------------------------------------------

export type ChangeKind = "initial" | "same" | "removal" | "insertion" | "reorder";

export interface GridChange {
  kind: ChangeKind;
  /** Indices in the previous list that are gone (removal only). */
  removed: number[];
  /** Indices in the next list that are new (insertion only). */
  added: number[];
}

// Walks the longer list once, matching the shorter list's keys in order. The
// shorter list is an in-order subsequence of the longer one exactly when every
// one of its keys gets matched; the unmatched indices are what changed.
function subsequenceGaps(longer: readonly string[], shorter: readonly string[]): number[] | null {
  const gaps: number[] = [];
  let j = 0;
  for (let i = 0; i < longer.length; i++) {
    if (j < shorter.length && longer[i] === shorter[j]) j++;
    else gaps.push(i);
  }
  return j === shorter.length ? gaps : null;
}

/**
 * Classifies a list change so the grid knows how to show it:
 *  - removal / insertion: the order of everything else is unchanged, so the
 *    remaining posters glide to their new places;
 *  - reorder: a new sort, filter or search result, where gliding dozens of
 *    posters across each other would be noise, so the grid swaps instantly
 *    behind a short fade.
 */
export function classifyChange(prevKeys: readonly string[] | null, nextKeys: readonly string[]): GridChange {
  if (prevKeys === null) return { kind: "initial", removed: [], added: [] };
  if (prevKeys.length === nextKeys.length) {
    for (let i = 0; i < nextKeys.length; i++) {
      if (prevKeys[i] !== nextKeys[i]) return { kind: "reorder", removed: [], added: [] };
    }
    return { kind: "same", removed: [], added: [] };
  }
  if (nextKeys.length < prevKeys.length) {
    const removed = subsequenceGaps(prevKeys, nextKeys);
    return removed ? { kind: "removal", removed, added: [] } : { kind: "reorder", removed: [], added: [] };
  }
  const added = subsequenceGaps(nextKeys, prevKeys);
  return added ? { kind: "insertion", removed: [], added } : { kind: "reorder", removed: [], added: [] };
}

// ---------------------------------------------------------------------------
// Virtualization window
// ---------------------------------------------------------------------------

/** Rows to mount, inclusive. */
export interface RowBand {
  first: number;
  last: number;
}

/**
 * The rows to keep mounted for a scroll position.
 *
 * The band extends `overscanRows` beyond the viewport on both sides and is
 * only moved once the viewport gets within half of that of either edge, so a
 * scroll re-renders the grid every few rows instead of on every row crossed.
 * Returns `current` itself when it still covers the viewport, so callers can
 * skip the state update by identity.
 */
export function nextBand(
  current: RowBand | null,
  scrollY: number,
  viewportHeight: number,
  m: GridMetrics,
  overscanRows: number
): RowBand {
  const rowHeight = rowHeightOf(m);
  const firstVisible = Math.max(0, Math.floor((scrollY - m.paddingTop) / rowHeight));
  const lastVisible = Math.max(firstVisible, Math.floor((scrollY + viewportHeight - m.paddingTop) / rowHeight));
  const margin = Math.max(1, Math.floor(overscanRows / 2));
  if (current && current.first <= Math.max(0, firstVisible - margin) && current.last >= lastVisible + margin) {
    return current;
  }
  return { first: Math.max(0, firstVisible - overscanRows), last: lastVisible + overscanRows };
}
