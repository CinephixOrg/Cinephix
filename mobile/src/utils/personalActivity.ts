// The Activity page's rules: its filters, what each activity says, how the
// feed is grouped by day, and how a refreshed page lands on a cached one.
//
// Pure and React-free so it runs under `node --test` (personalActivity.test.mts).

import type { PersonalActivityItem } from "../types";

export type ActivityRange = "week" | "month" | "all";

export const ACTIVITY_RANGES: ActivityRange[] = ["week", "month", "all"];

/** i18n keys. */
export const RANGE_LABEL: Record<ActivityRange, string> = {
  week: "This Week",
  month: "This Month",
  all: "All Time",
};

// The "Activity type" filter's options — the same keys the server accepts
// in ?categories= (backend/utils/activityFeed.js), in menu order.
export type ActivityCategory =
  | "ratings"
  | "reviews"
  | "likes"
  | "list_likes"
  | "follows"
  | "lists"
  | "watched"
  | "favorites"
  | "communities"
  | "shares"
  | "cinematch";

export const ACTIVITY_CATEGORIES: ActivityCategory[] = [
  "ratings",
  "reviews",
  "likes",
  "list_likes",
  "follows",
  "lists",
  "watched",
  "favorites",
  "communities",
  "shares",
  "cinematch",
];

/** i18n keys. */
export const CATEGORY_LABEL: Record<ActivityCategory, string> = {
  ratings: "Ratings",
  reviews: "Reviews",
  likes: "Liked reviews",
  list_likes: "Liked lists",
  follows: "Follows",
  lists: "Created lists",
  watched: "Watched & Watchlist",
  favorites: "Favorites",
  communities: "Communities",
  shares: "Media posts",
  cinematch: "CineMatch & CineGraph",
};

export interface ActivityFilters {
  range: ActivityRange;
  /** The types shown; empty means every type (what the server expects too). */
  categories: ActivityCategory[];
}

export const DEFAULT_ACTIVITY_FILTERS: ActivityFilters = { range: "week", categories: [] };

/** The types being shown: every one when the filter is empty. */
export function shownCategories(filters: ActivityFilters): ActivityCategory[] {
  return filters.categories.length === 0 ? ACTIVITY_CATEGORIES : filters.categories;
}

/** How many types are hidden — the filter button's badge. */
export function hiddenCategoryCount(filters: ActivityFilters): number {
  return filters.categories.length === 0 ? 0 : ACTIVITY_CATEGORIES.length - filters.categories.length;
}

/**
 * Ticks or unticks one type, checklist-style: with everything shown, a tap
 * hides just that type ("everything except ratings" is one tap). The last
 * type left can't be unticked — an empty checklist would show nothing — and
 * ticking the last missing one goes back to "everything". The menu's order
 * is kept, so equal filters are equal.
 */
export function toggleCategory(filters: ActivityFilters, category: ActivityCategory): ActivityFilters {
  const shown = shownCategories(filters);
  const next = shown.includes(category) ? shown.filter((c) => c !== category) : [...shown, category];
  if (next.length === 0) return filters;
  const categories = next.length === ACTIVITY_CATEGORIES.length ? [] : ACTIVITY_CATEGORIES.filter((c) => next.includes(c));
  return { ...filters, categories };
}

/** One cache entry per distinct request. */
export function activityQueryKey(filters: ActivityFilters): string {
  const categories = ACTIVITY_CATEGORIES.filter((c) => filters.categories.includes(c));
  return `${filters.range}|${categories.join(",")}`;
}

// ---------------------------------------------------------------------------
// What each activity says
// ---------------------------------------------------------------------------

export interface ActivitySentence {
  /** i18n key, in the second person ("You rated {{title}}"). */
  key: string;
  /** Interpolated values — each shown emphasised in the sentence. */
  vars: Record<string, string>;
}

const SHARE_SENTENCE: Record<string, { withTitle: string; plain: string }> = {
  review: { withTitle: "You shared your review of {{title}} on {{media}}", plain: "You shared a review on {{media}}" },
  recommendation: { withTitle: "You recommended {{title}} on {{media}}", plain: "You shared a recommendation on {{media}}" },
  list: { withTitle: "You shared your list {{title}} on {{media}}", plain: "You shared a list on {{media}}" },
  analysis: { withTitle: "You shared an analysis on {{media}}", plain: "You shared an analysis on {{media}}" },
  poll: { withTitle: "You posted a poll on {{media}}", plain: "You posted a poll on {{media}}" },
  badge: { withTitle: "You shared a badge on {{media}}", plain: "You shared a badge on {{media}}" },
};

/**
 * The conversational sentence for one activity. `media` is the app's own
 * name for the Media tab, already translated by the caller.
 */
export function sentenceFor(item: PersonalActivityItem, media: string): ActivitySentence {
  const title = item.content?.title ?? "";
  const username = item.targetUser?.username;
  switch (item.type) {
    case "rated":
      return { key: "You rated {{title}}", vars: { title } };
    case "reviewed":
      return { key: "You reviewed {{title}}", vars: { title } };
    case "review_liked":
      return username
        ? { key: "You liked {{username}}'s review of {{title}}", vars: { username, title } }
        : { key: "You liked a review of {{title}}", vars: { title } };
    case "list_liked":
      return username
        ? { key: "You liked {{username}}'s list {{name}}", vars: { username, name: item.listName ?? "" } }
        : { key: "You liked the list {{name}}", vars: { name: item.listName ?? "" } };
    case "followed":
      return { key: "You started following {{username}}", vars: { username: username ?? "" } };
    case "list_created":
      return { key: "You created a new list {{name}}", vars: { name: item.listName ?? "" } };
    case "watchlist_added":
      return { key: "You added {{title}} to your watched list", vars: { title } };
    case "towatch_added":
      return { key: "You added {{title}} to your watchlist", vars: { title } };
    case "favorited":
      return { key: "You added {{title}} to your favorites", vars: { title } };
    case "group_joined":
      return { key: "You joined the {{name}} community", vars: { name: item.groupName ?? "" } };
    case "shared": {
      const sentences = SHARE_SENTENCE[item.shareType ?? ""] ?? { withTitle: "You posted on {{media}}", plain: "You posted on {{media}}" };
      return item.shareTitle
        ? { key: sentences.withTitle, vars: { title: item.shareTitle, media } }
        : { key: sentences.plain, vars: { media } };
    }
    case "match_analyzed":
      return username
        ? { key: "You ran a CineMatch with {{username}}", vars: { username } }
        : { key: "You ran a CineMatch analysis", vars: {} };
    case "profile_analyzed":
      return item.nickname
        ? { key: "Your CineGraph analysis named you {{nickname}}", vars: { nickname: item.nickname } }
        : { key: "You ran a CineGraph analysis", vars: {} };
    default:
      return { key: "You were active on Cinephix", vars: {} };
  }
}

// Private-use characters that can't appear in a title or name, wrapped round
// each interpolated value so the resolved sentence can be split back into
// plain and emphasised runs in whatever word order the language uses.
export const EMPHASIS_OPEN = "\uE000";
export const EMPHASIS_CLOSE = "\uE001";

/** Wraps every value for emphasis before it's interpolated. */
export function markVars(vars: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, `${EMPHASIS_OPEN}${v}${EMPHASIS_CLOSE}`]));
}

export interface SentenceRun {
  text: string;
  strong: boolean;
}

/** A resolved sentence as runs of plain and emphasised text; unmatched markers are dropped. */
export function splitEmphasis(resolved: string): SentenceRun[] {
  const runs: SentenceRun[] = [];
  let strong = false;
  let buffer = "";
  const flush = () => {
    if (buffer) runs.push({ text: buffer, strong });
    buffer = "";
  };
  for (const char of resolved) {
    if (char === EMPHASIS_OPEN) {
      flush();
      strong = true;
    } else if (char === EMPHASIS_CLOSE) {
      flush();
      strong = false;
    } else {
      buffer += char;
    }
  }
  flush();
  return runs;
}

/** 1-10 as stars on the 5-star scale, with a half star: 9 → "★★★★½". */
export function starString(value: number | undefined): string {
  if (typeof value !== "number" || value <= 0) return "";
  const scaled = Math.min(10, value) / 2;
  const full = Math.floor(scaled);
  return "★".repeat(full) + (scaled - full >= 0.5 ? "½" : "");
}

// ---------------------------------------------------------------------------
// Grouping and paging
// ---------------------------------------------------------------------------

export type ActivityRow =
  | { kind: "day"; key: string; iso: string }
  | { kind: "item"; key: string; item: PersonalActivityItem };

const dayOf = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

const newestFirst = (a: PersonalActivityItem, b: PersonalActivityItem) => {
  const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  return diff !== 0 ? diff : a.key < b.key ? 1 : a.key > b.key ? -1 : 0;
};

/**
 * Items under a header for each calendar day, newest first. Sorted here
 * rather than trusted to arrive in order — pages loaded at different times
 * can interleave — so each day gets exactly one header, and an item that
 * somehow arrives twice is shown once: every row key is unique.
 */
export function activityRows(items: readonly PersonalActivityItem[]): ActivityRow[] {
  const seen = new Set<string>();
  const unique = items.filter((item) => (seen.has(item.key) ? false : (seen.add(item.key), true)));
  const rows: ActivityRow[] = [];
  let current: string | null = null;
  for (const item of unique.sort(newestFirst)) {
    const day = dayOf(item.createdAt);
    if (day !== current) {
      rows.push({ kind: "day", key: `day:${day}`, iso: item.createdAt });
      current = day;
    }
    rows.push({ kind: "item", key: item.key, item });
  }
  return rows;
}

/** An older page appended, skipping anything already shown. */
export function appendActivity(existing: readonly PersonalActivityItem[], older: readonly PersonalActivityItem[]): PersonalActivityItem[] {
  const keys = new Set(existing.map((item) => item.key));
  return [...existing, ...older.filter((item) => !keys.has(item.key))];
}

/**
 * A refreshed first page over a list that may hold older pages too. When the
 * fresh page is the whole feed it replaces the list; otherwise what was
 * already loaded below it stays, so a refresh doesn't throw away what's been
 * scrolled through. Returns the same array when nothing changed.
 */
export function mergeFreshActivity(
  existing: readonly PersonalActivityItem[],
  fresh: readonly PersonalActivityItem[],
  freshHasMore: boolean
): PersonalActivityItem[] {
  let next: PersonalActivityItem[];
  if (!freshHasMore || fresh.length === 0) {
    next = [...fresh];
  } else {
    const oldest = new Date(fresh[fresh.length - 1].createdAt).getTime();
    const keys = new Set(fresh.map((item) => item.key));
    next = [...fresh, ...existing.filter((item) => !keys.has(item.key) && new Date(item.createdAt).getTime() < oldest)];
  }
  // Compared in full, not just by key: a rating's value can change in place.
  return JSON.stringify(next) === JSON.stringify(existing) ? (existing as PersonalActivityItem[]) : next;
}
