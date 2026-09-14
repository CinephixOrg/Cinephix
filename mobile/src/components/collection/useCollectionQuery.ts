import { useCallback, useDeferredValue, useMemo, useReducer, useState } from "react";
import {
  EMPTY_FILTERS,
  activeFilterCount,
  buildIndex,
  queryCollection,
  reduceFilters,
  type CollectionEntry,
  type FilterAction,
} from "../../utils/collectionQuery";
import { computeMetrics } from "./gridModel";

/** The grid geometry every collection shares: five posters across. */
export const COLLECTION_GRID = { columns: 5, gap: 6, paddingX: 16, paddingTop: 4, posterRatio: 1.5 } as const;

export function useGridMetrics(width: number) {
  return useMemo(() => computeMetrics(width, COLLECTION_GRID), [width]);
}

// Search, filters and the filter sheet's open state for one collection —
// shared by the personal Watched List / Watchlist screens and the public
// profile's Watched List / Watchlist pages, so all four behave identically.
//
// The query runs urgently: it's an in-memory pass cheap enough that the
// sheet's result count and the toolbar are exact on the frame of a tap. Only
// the grid gets its results through useDeferredValue, so a tap renders the
// controls first and the grid follows at low priority — and React abandons
// that render if another tap arrives first.
export function useCollectionQuery(entries: CollectionEntry[]) {
  const [query, setQuery] = useState("");
  const [filters, dispatchFilter] = useReducer(reduceFilters, EMPTY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  const index = useMemo(() => buildIndex(entries), [entries]);
  const visible = useMemo(() => queryCollection(index, { query, filters }), [index, query, filters]);
  const gridEntries = useDeferredValue(visible);

  const onFilterAction = useCallback((action: FilterAction) => dispatchFilter(action), []);
  const clearFilters = useCallback(() => dispatchFilter({ kind: "clear" }), []);
  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  return {
    query,
    setQuery,
    filters,
    onFilterAction,
    clearFilters,
    visible,
    gridEntries,
    filterCount: activeFilterCount(filters),
    narrowed: query.trim().length > 0 || filters.types.length === 1 || filters.rated !== null,
    sheetOpen,
    openSheet,
    closeSheet,
  };
}
