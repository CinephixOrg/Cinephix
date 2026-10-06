// The Communities page's rules: which communities a filter leaves, how a tag
// reads as a hashtag, and how optimistic join/leave changes the list.
//
// Pure and React-free so it runs under `node --test` (communities.test.mts).

import type { Group, GroupCategory } from "../types";

export type CommunityShow = "all" | "joined";
export type CommunityCategory = "all" | GroupCategory;

export type CommunitySortKey = "members" | "friends" | "name";
export type SortDirection = "asc" | "desc";

export interface CommunitySortRule {
  key: CommunitySortKey;
  direction: SortDirection;
}

export interface CommunityFilters {
  show: CommunityShow;
  category: CommunityCategory;
  /**
   * Active sorts in the order they were picked, at most one per key — the
   * same model as the Watched List's (collectionQuery.ts). The first rule
   * orders the list and each later one only breaks the ties left by those
   * before it.
   */
  sorts: CommunitySortRule[];
}

export const DEFAULT_COMMUNITY_FILTERS: CommunityFilters = { show: "all", category: "all", sorts: [] };

export type CommunityAction =
  | { kind: "show"; value: CommunityShow }
  | { kind: "category"; value: CommunityCategory }
  | { kind: "sort"; key: CommunitySortKey }
  | { kind: "clearFilters" }
  | { kind: "clearSorts" };

/**
 * Applies one tap in the Filter or Sort menu.
 *
 * Most Members and Friends Joined switch on and off. Name cycles A-Z, then
 * Z-A (in place, keeping its priority), then off. Filter changes leave the
 * sorts alone and vice versa, and anything that changes nothing returns the
 * same object.
 */
export function reduceCommunityFilters(state: CommunityFilters, action: CommunityAction): CommunityFilters {
  switch (action.kind) {
    case "show":
      return state.show === action.value ? state : { ...state, show: action.value };
    case "category":
      return state.category === action.value ? state : { ...state, category: action.value };
    case "sort": {
      const index = state.sorts.findIndex((rule) => rule.key === action.key);
      if (index === -1) {
        const direction: SortDirection = action.key === "name" ? "asc" : "desc";
        return { ...state, sorts: [...state.sorts, { key: action.key, direction }] };
      }
      if (action.key === "name" && state.sorts[index].direction === "asc") {
        const sorts = state.sorts.slice();
        sorts[index] = { key: "name", direction: "desc" };
        return { ...state, sorts };
      }
      return { ...state, sorts: state.sorts.filter((_, i) => i !== index) };
    }
    case "clearFilters":
      return state.show === "all" && state.category === "all" ? state : { ...state, show: "all", category: "all" };
    case "clearSorts":
      return state.sorts.length === 0 ? state : { ...state, sorts: [] };
  }
}

/** 1-based position of a sort among the active ones, or 0 when it's off. */
export function sortPriority(filters: CommunityFilters, key: CommunitySortKey): number {
  return filters.sorts.findIndex((rule) => rule.key === key) + 1;
}

export function sortDirection(filters: CommunityFilters, key: CommunitySortKey): SortDirection | null {
  return filters.sorts.find((rule) => rule.key === key)?.direction ?? null;
}

/** Menu order. */
export const COMMUNITY_CATEGORIES: GroupCategory[] = ["genre", "director", "era", "style"];

/** The Filter button's badge: sorts have their own. */
export function activeCommunityFilterCount(filters: CommunityFilters): number {
  return (filters.show !== "all" ? 1 : 0) + (filters.category !== "all" ? 1 : 0);
}

export function filterCommunities(groups: readonly Group[], filters: CommunityFilters): Group[] {
  if (filters.show === "all" && filters.category === "all") return groups as Group[];
  return groups.filter(
    (group) =>
      (filters.show === "all" || group.isMember) && (filters.category === "all" || group.category === filters.category)
  );
}

// Name order that ignores case and accents ("Ölüm" sits with the O's).
const byName = (a: Group, b: Group) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });

function compareByRule(a: Group, b: Group, rule: CommunitySortRule): number {
  const direction = rule.direction === "asc" ? 1 : -1;
  switch (rule.key) {
    case "members":
      return (a.memberCount - b.memberCount) * direction;
    case "friends":
      return ((a.friendsJoined ?? 0) - (b.friendsJoined ?? 0)) * direction;
    case "name":
      return byName(a, b) * direction;
  }
}

/**
 * The Communities list: the filters, then the sorts in priority order, with
 * the server's own order (most members first) settling any tie the sorts
 * leave. With no filter and no sort it's the list as it came, same array.
 */
export function queryCommunities(groups: readonly Group[], filters: CommunityFilters): Group[] {
  const filtered = filterCommunities(groups, filters);
  if (filters.sorts.length === 0) return filtered;
  const position = new Map(groups.map((group, index) => [group._id, index]));
  return filtered.slice().sort((a, b) => {
    for (const rule of filters.sorts) {
      const result = compareByRule(a, b, rule);
      if (result !== 0) return result;
    }
    return (position.get(a._id) ?? 0) - (position.get(b._id) ?? 0);
  });
}

/**
 * How many communities each category option would show, given the current
 * Show choice, so the menu can say what a tap will leave before it's made.
 */
export function categoryCounts(groups: readonly Group[], show: CommunityShow): Record<CommunityCategory, number> {
  const counts: Record<CommunityCategory, number> = { all: 0, genre: 0, director: 0, era: 0, style: 0 };
  for (const group of groups) {
    if (show === "joined" && !group.isMember) continue;
    counts.all += 1;
    if (group.category in counts) counts[group.category] += 1;
  }
  return counts;
}

/**
 * A stored tag ("quentin-tarantino", "2001-a-space-odyssey") as a hashtag
 * ("#QuentinTarantino", "#2001ASpaceOdyssey"): hashtags can't hold spaces or
 * hyphens, and capitalising each word keeps a long one readable.
 */
export function toHashtag(tag: string): string {
  const words = tag
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean);
  if (words.length === 0) return "";
  return `#${words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("")}`;
}

/** Joining or leaving, applied to one community: membership and the head count move together. */
export function withMembership(group: Group, isMember: boolean): Group {
  if (group.isMember === isMember) return group;
  return { ...group, isMember, memberCount: Math.max(0, group.memberCount + (isMember ? 1 : -1)) };
}

/** Replaces one community by slug, keeping the array (and every other item) when nothing changes. */
export function replaceGroup(groups: Group[], next: Group): Group[] {
  const index = groups.findIndex((group) => group.slug === next.slug);
  if (index === -1 || groups[index] === next) return groups;
  const copy = groups.slice();
  copy[index] = next;
  return copy;
}

/**
 * Whether two fetches of the list show the same thing. A refresh that
 * changed nothing keeps the old array, so the list and its cards don't
 * re-render for it.
 */
export function sameCommunities(a: readonly Group[], b: readonly Group[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((x, i) => {
    const y = b[i];
    return (
      x._id === y._id &&
      x.isMember === y.isMember &&
      x.memberCount === y.memberCount &&
      x.friendsJoined === y.friendsJoined &&
      x.name === y.name &&
      x.description === y.description &&
      x.category === y.category &&
      x.tags.join("\n") === y.tags.join("\n") &&
      // A partner community's own admin-managed fields — without these,
      // refreshGroup's "nothing changed, keep the old object" shortcut
      // (communitiesStore.ts) kept an OLDER cached copy even after a
      // genuinely fresh fetch populated owner correctly, a real bug: the
      // list's own copy of a brand-new community never had owner
      // populated at all (fixed server-side too), so every admin control
      // gated on `group.owner?._id` silently never showed.
      (x.owner?._id ?? null) === (y.owner?._id ?? null) &&
      (x.accentColor ?? null) === (y.accentColor ?? null) &&
      (x.socialLinks?.instagram ?? null) === (y.socialLinks?.instagram ?? null) &&
      (x.socialLinks?.tiktok ?? null) === (y.socialLinks?.tiktok ?? null) &&
      (x.socialLinks?.youtube ?? null) === (y.socialLinks?.youtube ?? null) &&
      (x.pinnedLists ?? []).map((l) => l._id).join(",") === (y.pinnedLists ?? []).map((l) => l._id).join(",") &&
      (x.pinnedPoll?._id ?? null) === (y.pinnedPoll?._id ?? null)
    );
  });
}
