import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_COMMUNITY_FILTERS,
  queryCommunities,
  reduceCommunityFilters,
  sortDirection,
  sortPriority,
  activeCommunityFilterCount,
  categoryCounts,
  filterCommunities,
  replaceGroup,
  sameCommunities,
  toHashtag,
  withMembership,
} from "./communities.ts";
import type { Group, GroupCategory } from "../types/index.ts";

function group(slug: string, category: GroupCategory, isMember = false, memberCount = 3): Group {
  return {
    _id: `id-${slug}`,
    slug,
    name: slug,
    description: `About ${slug}`,
    category,
    tags: ["a", "b"],
    memberCount,
    isMember,
    isPreset: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const GROUPS = [
  group("thriller", "genre", true),
  group("tarantino", "director"),
  group("scorsese", "director", true),
  group("silent", "era"),
  group("noir", "style"),
];

test("the default filters leave the list as it is, same array", () => {
  assert.equal(filterCommunities(GROUPS, DEFAULT_COMMUNITY_FILTERS), GROUPS);
  assert.equal(activeCommunityFilterCount(DEFAULT_COMMUNITY_FILTERS), 0);
});

test("Joined keeps only communities you're in", () => {
  const joined = filterCommunities(GROUPS, { show: "joined", category: "all", sorts: [] });
  assert.deepEqual(joined.map((g) => g.slug), ["thriller", "scorsese"]);
});

test("a category keeps only that category, and combines with Joined", () => {
  assert.deepEqual(
    filterCommunities(GROUPS, { show: "all", category: "director", sorts: [] }).map((g) => g.slug),
    ["tarantino", "scorsese"]
  );
  assert.deepEqual(
    filterCommunities(GROUPS, { show: "joined", category: "director", sorts: [] }).map((g) => g.slug),
    ["scorsese"]
  );
  assert.equal(activeCommunityFilterCount({ show: "joined", category: "director", sorts: [] }), 2);
});

test("category counts follow the Show choice", () => {
  assert.deepEqual(categoryCounts(GROUPS, "all"), { all: 5, genre: 1, director: 2, era: 1, style: 1 });
  assert.deepEqual(categoryCounts(GROUPS, "joined"), { all: 2, genre: 1, director: 1, era: 0, style: 0 });
});

test("tags read as camel-cased hashtags", () => {
  assert.equal(toHashtag("quentin-tarantino"), "#QuentinTarantino");
  assert.equal(toHashtag("pulp-fiction"), "#PulpFiction");
  assert.equal(toHashtag("2001-a-space-odyssey"), "#2001ASpaceOdyssey");
  assert.equal(toHashtag("sci-fi"), "#SciFi");
  assert.equal(toHashtag("noir"), "#Noir");
  assert.equal(toHashtag("  film festival "), "#FilmFestival");
  assert.equal(toHashtag("--"), "");
});

test("joining and leaving move membership and the count together", () => {
  const g = group("x", "genre", false, 4);
  const joined = withMembership(g, true);
  assert.equal(joined.isMember, true);
  assert.equal(joined.memberCount, 5);
  assert.equal(withMembership(joined, true), joined, "no change keeps identity");
  const left = withMembership(joined, false);
  assert.equal(left.memberCount, 4);
  assert.equal(withMembership(group("y", "genre", true, 0), false).memberCount, 0, "never below zero");
});

test("replaceGroup swaps one item and keeps the array when nothing changes", () => {
  const next = withMembership(GROUPS[1], true);
  const replaced = replaceGroup(GROUPS, next);
  assert.notEqual(replaced, GROUPS);
  assert.equal(replaced[1], next);
  assert.equal(replaced[0], GROUPS[0]);
  assert.equal(replaceGroup(GROUPS, GROUPS[1]), GROUPS);
  assert.equal(replaceGroup(GROUPS, group("missing", "era")), GROUPS);
});

test("sameCommunities notices what the cards show, and only that", () => {
  const copy = GROUPS.map((g) => ({ ...g, tags: [...g.tags] }));
  assert.equal(sameCommunities(GROUPS, copy), true);
  assert.equal(sameCommunities(GROUPS, copy.slice(1)), false);
  copy[2] = { ...copy[2], memberCount: 99 };
  assert.equal(sameCommunities(GROUPS, copy), false);
  const retagged = GROUPS.map((g, i) => (i === 0 ? { ...g, tags: ["a", "c"] } : g));
  assert.equal(sameCommunities(GROUPS, retagged), false);
});

function withFriends(slug: string, name: string, members: number, friends: number, category: GroupCategory = "genre", isMember = false): Group {
  return { ...group(slug, category, isMember, members), name, friendsJoined: friends };
}

const RANKED = [
  withFriends("b", "Bravo", 30, 2),
  withFriends("a", "alpha", 20, 5, "director", true),
  withFriends("c", "Charlie", 20, 5),
  withFriends("d", "Delta", 10, 0),
];

test("Most Members and Friends Joined switch on and off; Name cycles A-Z, Z-A, off", () => {
  let state = DEFAULT_COMMUNITY_FILTERS;
  state = reduceCommunityFilters(state, { kind: "sort", key: "friends" });
  assert.deepEqual(state.sorts, [{ key: "friends", direction: "desc" }]);
  state = reduceCommunityFilters(state, { kind: "sort", key: "name" });
  assert.deepEqual(state.sorts[1], { key: "name", direction: "asc" });
  state = reduceCommunityFilters(state, { kind: "sort", key: "name" });
  assert.deepEqual(state.sorts[1], { key: "name", direction: "desc" }, "flips in place, keeping its priority");
  assert.equal(sortPriority(state, "name"), 2);
  assert.equal(sortDirection(state, "name"), "desc");
  state = reduceCommunityFilters(state, { kind: "sort", key: "name" });
  assert.deepEqual(state.sorts, [{ key: "friends", direction: "desc" }]);
  state = reduceCommunityFilters(state, { kind: "sort", key: "friends" });
  assert.deepEqual(state.sorts, []);
  assert.equal(sortPriority(state, "friends"), 0);
});

test("filters and sorts clear independently, and a no-op keeps the same object", () => {
  let state = reduceCommunityFilters(DEFAULT_COMMUNITY_FILTERS, { kind: "sort", key: "members" });
  state = reduceCommunityFilters(state, { kind: "category", value: "director" });
  const cleared = reduceCommunityFilters(state, { kind: "clearFilters" });
  assert.equal(cleared.category, "all");
  assert.equal(cleared.sorts.length, 1, "sorts survive clearing filters");
  assert.equal(reduceCommunityFilters(cleared, { kind: "clearFilters" }), cleared);
  assert.equal(reduceCommunityFilters(cleared, { kind: "clearSorts" }).sorts.length, 0);
  assert.equal(reduceCommunityFilters(cleared, { kind: "show", value: "all" }), cleared);
});

test("no sort keeps the server's order and array", () => {
  assert.equal(queryCommunities(RANKED, DEFAULT_COMMUNITY_FILTERS), RANKED);
});

test("the first sort leads and later ones break its ties", () => {
  const byFriends = queryCommunities(RANKED, { ...DEFAULT_COMMUNITY_FILTERS, sorts: [{ key: "friends", direction: "desc" }] });
  assert.deepEqual(byFriends.map((g) => g.slug), ["a", "c", "b", "d"], "ties keep server order");
  const friendsThenZA = queryCommunities(RANKED, {
    ...DEFAULT_COMMUNITY_FILTERS,
    sorts: [
      { key: "friends", direction: "desc" },
      { key: "name", direction: "desc" },
    ],
  });
  assert.deepEqual(friendsThenZA.map((g) => g.slug), ["c", "a", "b", "d"]);
});

test("name order ignores case; members sorts descending", () => {
  const az = queryCommunities(RANKED, { ...DEFAULT_COMMUNITY_FILTERS, sorts: [{ key: "name", direction: "asc" }] });
  assert.deepEqual(az.map((g) => g.name), ["alpha", "Bravo", "Charlie", "Delta"]);
  const members = queryCommunities(RANKED, { ...DEFAULT_COMMUNITY_FILTERS, sorts: [{ key: "members", direction: "desc" }] });
  assert.deepEqual(members.map((g) => g.slug), ["b", "a", "c", "d"]);
});

test("sorts apply to what the filters leave", () => {
  const genres = queryCommunities(RANKED, {
    show: "all",
    category: "genre",
    sorts: [{ key: "name", direction: "desc" }],
  });
  assert.deepEqual(genres.map((g) => g.slug), ["d", "c", "b"]);
});

test("a server without friend counts sorts them as zero", () => {
  const legacy = RANKED.map(({ friendsJoined, ...g }) => g as Group);
  const sorted = queryCommunities(legacy, { ...DEFAULT_COMMUNITY_FILTERS, sorts: [{ key: "friends", direction: "desc" }] });
  assert.deepEqual(sorted.map((g) => g.slug), ["b", "a", "c", "d"]);
});
