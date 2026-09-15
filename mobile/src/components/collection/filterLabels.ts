import type {
  CollectionFilters,
  ContentKind,
  FilterAction,
  RatedFilter,
  SortDirection,
  SortGroup,
  SortRule,
} from "../../utils/collectionQuery";

type Translate = (key: string, options?: Record<string, unknown>) => string;

// Labels shared by the filter sheet and the active-filter chips, so the two
// can never describe the same filter differently.
//
// Every option carries its FilterAction as a module-level constant. The
// sheet's option rows are memoized, and an action object that stays the same
// reference is what lets a tap re-render only the rows whose state changed.

export const TYPE_LABEL: Record<ContentKind, string> = { movie: "Movies", series: "Series" };
export const RATED_LABEL: Record<RatedFilter, string> = { rated: "Rated", unrated: "Not Rated" };

export const TYPE_OPTIONS: { kind: ContentKind; icon: "film-outline" | "tv-outline"; action: FilterAction }[] = [
  { kind: "movie", icon: "film-outline", action: { kind: "type", value: "movie" } },
  { kind: "series", icon: "tv-outline", action: { kind: "type", value: "series" } },
];

export const RATED_OPTIONS: { value: RatedFilter; action: FilterAction }[] = [
  { value: "rated", action: { kind: "rated", value: "rated" } },
  { value: "unrated", action: { kind: "rated", value: "unrated" } },
];

export interface SortOptionSpec {
  direction: SortDirection;
  label: string;
  action: FilterAction;
}

export interface SortGroupSpec {
  group: SortGroup;
  label: string;
  options: SortOptionSpec[];
}

const option = (group: SortGroup, direction: SortDirection, label: string): SortOptionSpec => ({
  direction,
  label,
  action: { kind: "sort", group, direction },
});

const TITLE_GROUP: SortGroupSpec = {
  group: "alpha",
  label: "Title",
  // Written out rather than translated: the letters themselves are the label.
  options: [option("alpha", "asc", "A–Z"), option("alpha", "desc", "Z–A")],
};

const RELEASE_GROUP: SortGroupSpec = {
  group: "release",
  label: "Release date",
  options: [option("release", "desc", "Newest"), option("release", "asc", "Oldest")],
};

const RATING_GROUP: SortGroupSpec = {
  group: "rating",
  label: "Your rating",
  options: [option("rating", "desc", "Highest"), option("rating", "asc", "Lowest")],
};

// Someone else's watched list sorts by their rating, so it says whose.
const THEIR_RATING_GROUP: SortGroupSpec = { ...RATING_GROUP, label: "Their rating" };

export const WATCHED_SORT_GROUPS: SortGroupSpec[] = [TITLE_GROUP, RELEASE_GROUP, RATING_GROUP];
export const PUBLIC_WATCHED_SORT_GROUPS: SortGroupSpec[] = [TITLE_GROUP, RELEASE_GROUP, THEIR_RATING_GROUP];
// Nothing on the Watchlist has been watched yet, so there is no rating to sort by.
export const WATCHLIST_SORT_GROUPS: SortGroupSpec[] = [TITLE_GROUP, RELEASE_GROUP];

/** 1-based priority of a sort rule, or 0 when that exact rule isn't active. */
export function priorityOf(sorts: SortRule[], group: SortGroup, direction: SortDirection): number {
  return sorts.findIndex((rule) => rule.group === group && rule.direction === direction) + 1;
}

// Chips appear without their section heading next to them, so they need the
// longer, self-explanatory form.
const SORT_CHIP_LABEL: Record<SortGroup, Record<SortDirection, string>> = {
  alpha: { asc: "A–Z", desc: "Z–A" },
  release: { desc: "Newest first", asc: "Oldest first" },
  rating: { desc: "Highest Rating", asc: "Lowest Rating" },
};

export interface ActiveChip {
  key: string;
  label: string;
  /** The action that turns this filter off again. */
  action: FilterAction;
}

export function activeChips(filters: CollectionFilters, t: Translate): ActiveChip[] {
  const chips: ActiveChip[] = [];
  for (const value of filters.types) {
    chips.push({ key: `type-${value}`, label: t(TYPE_LABEL[value]), action: { kind: "type", value } });
  }
  if (filters.rated) {
    chips.push({ key: `rated-${filters.rated}`, label: t(RATED_LABEL[filters.rated]), action: { kind: "rated", value: filters.rated } });
  }
  for (const rule of filters.sorts) {
    const raw = SORT_CHIP_LABEL[rule.group][rule.direction];
    chips.push({
      key: `sort-${rule.group}`,
      label: rule.group === "alpha" ? raw : t(raw),
      action: { kind: "sort", group: rule.group, direction: rule.direction },
    });
  }
  return chips;
}
