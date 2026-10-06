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
// Ad banners between tile rows (Watched List / Watchlist — "kart satırları
// arasında, optimum sıklıkta" direct ask)
// ---------------------------------------------------------------------------
//
// Purely additive on top of the plain geometry above: tilePosition/
// contentHeight/nextBand/rowHeightOf are all untouched (so gridModel.test.mts
// stays exactly as valid as before this), and these new functions layer an
// extra, fixed-height "ad row" into the y-axis every AD_ROW_INTERVAL tile
// rows. nextBand's own virtualization band is deliberately left reading the
// PLAIN (ad-unaware) row height — overscanRows there is already a full
// screen's worth of extra rows mounted on each side of the viewport, which
// comfortably absorbs the small cumulative drift a handful of ad-row
// insertions introduces; recomputing nextBand's own scroll math to be
// perfectly ad-aware would need inverting a piecewise row height, real
// complexity for a drift this safely small.
export const AD_ROW_INTERVAL = 3;

/** How many ad-banner rows sit above a given tile row. */
export const adRowsBefore = (row: number) => Math.floor(row / AD_ROW_INTERVAL);

export function tilePositionWithAds(index: number, m: GridMetrics, adRowHeight: number): { x: number; y: number } {
  const { x, y } = tilePosition(index, m);
  const row = Math.floor(index / m.columns);
  return { x, y: y + adRowsBefore(row) * (adRowHeight + m.gap) };
}

/** y of the ad-banner row sitting right after tile row `groupIndex * AD_ROW_INTERVAL - 1`. */
export function adRowY(groupIndex: number, m: GridMetrics, adRowHeight: number): number {
  const firstRowAfter = (groupIndex + 1) * AD_ROW_INTERVAL;
  const { y } = tilePosition(firstRowAfter * m.columns, m);
  return y + groupIndex * (adRowHeight + m.gap);
}

export function contentHeightWithAds(count: number, m: GridMetrics, paddingBottom: number, adRowHeight: number): number {
  const rows = Math.ceil(count / m.columns);
  const adRows = Math.floor(rows / AD_ROW_INTERVAL);
  return contentHeight(count, m, paddingBottom) + adRows * (adRowHeight + m.gap);
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

// ---------------------------------------------------------------------------
// Following one grid's items from render to render
// ---------------------------------------------------------------------------

/** glide: animate to a new position. snap: jump there. */
export type GridMotion = "glide" | "snap";

/** An item just removed, kept for its exit animation in the slot it left. */
export interface GridGhost<T> {
  item: T;
  key: string;
  index: number;
  expiresAt: number;
}

export interface TrackedGrid<T> {
  items: readonly T[];
  keys: string[];
  /** How items move into the slots this change gives them. */
  motion: GridMotion;
  /** Keys that just came back (an Undo): they fade and scale in. */
  appearing: ReadonlySet<string>;
  ghosts: GridGhost<T>[];
  /** Bumped on every reorder, to trigger the grid's fade. */
  reorders: number;
}

const NO_KEYS: ReadonlySet<string> = new Set();

export function initialTracking<T>(items: readonly T[], keyOf: (item: T) => string): TrackedGrid<T> {
  return { items, keys: items.map(keyOf), motion: "snap", appearing: NO_KEYS, ghosts: [], reorders: 0 };
}

/**
 * What the grid should do for a new list: which items glide, which play an
 * exit as ghosts, which appear, or whether it's a reorder to fade through.
 */
export function trackChange<T>(
  previous: TrackedGrid<T>,
  items: readonly T[],
  keyOf: (item: T) => string,
  exitMs: number,
  now: number
): TrackedGrid<T> {
  const keys = items.map(keyOf);
  const change = classifyChange(previous.keys, keys);
  if (change.kind === "reorder") {
    return { items, keys, motion: "snap", appearing: NO_KEYS, ghosts: [], reorders: previous.reorders + 1 };
  }
  const present = new Set(keys);
  // An item put back by Undo while its exit is still playing stops being a ghost.
  let ghosts = previous.ghosts.filter((ghost) => ghost.expiresAt > now && !present.has(ghost.key));
  if (change.kind === "removal") {
    ghosts = ghosts.concat(
      change.removed.map((index) => ({ item: previous.items[index], key: previous.keys[index], index, expiresAt: now + exitMs }))
    );
  }
  return {
    items,
    keys,
    motion: change.kind === "same" ? previous.motion : "glide",
    appearing: change.kind === "insertion" ? new Set(change.added.map((index) => keys[index])) : NO_KEYS,
    ghosts,
    reorders: previous.reorders,
  };
}
