import { getAllGroups, getGroupBySlug, getGroupMembers, joinGroup, leaveGroup } from "./groupService";
import { createLruCache } from "../utils/cache";
import { replaceGroup, sameCommunities, withMembership } from "../utils/communities";
import type { Group, GroupMember } from "../types";

// Communities, shared by the Communities page, a community's own page and the
// share picker's group list.
//
//   * stale-while-revalidate: every screen renders what's cached on its first
//     frame and quietly refreshes underneath once the cache is FRESH_MS old;
//   * one in-flight request, so screens asking at once cost one round trip;
//   * a community's page opens from the list's copy of it, so its header is
//     there before the page's own request returns;
//   * joining or leaving updates every screen at once, and is undone if the
//     server refuses it.
//
// Membership is per person, so everything is dropped when the signed-in
// user changes.

const FRESH_MS = 30_000;

type Listener = () => void;

const listeners = new Set<Listener>();
// A community's own fetch, for one opened before the list has ever loaded.
const singles = new Map<string, Group>();
const members = createLruCache<GroupMember[]>(12);

let groups: Group[] | null = null;
let ownerId: string | null = null;
let fetchedAt = 0;
let inFlight: Promise<Group[]> | null = null;
// Bumped on every sign-in change, so a request that outlives its user is ignored.
let generation = 0;

function emit() {
  for (const listener of listeners) listener();
}

/** Call with the signed-in user's id before reading; a different user starts from nothing. */
export function setCommunitiesOwner(userId: string | null | undefined) {
  const next = userId ?? null;
  if (next === ownerId) return;
  ownerId = next;
  groups = null;
  fetchedAt = 0;
  inFlight = null;
  generation += 1;
  singles.clear();
  members.clear();
}

export function subscribeCommunities(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function communitiesSnapshot(): Group[] | null {
  return groups;
}

export function isCommunitiesStale(): boolean {
  return !groups || Date.now() - fetchedAt > FRESH_MS;
}

/** The list, from the network. Concurrent calls share one request. */
export function refreshCommunities(): Promise<Group[]> {
  if (inFlight) return inFlight;
  const startedIn = generation;
  const request = getAllGroups()
    .then((fresh) => {
      if (startedIn !== generation) return fresh;
      fetchedAt = Date.now();
      if (!groups || !sameCommunities(groups, fresh)) {
        groups = fresh;
        emit();
      }
      return groups;
    })
    .finally(() => {
      if (inFlight === request) inFlight = null;
    });
  inFlight = request;
  return request;
}

/** The cached list when fresh enough, otherwise a refresh. */
export function loadCommunities(): Promise<Group[]> {
  return groups && !isCommunitiesStale() ? Promise.resolve(groups) : refreshCommunities();
}

export function cachedGroup(slug: string): Group | undefined {
  return groups?.find((group) => group.slug === slug) ?? singles.get(slug);
}

/** One community from the network; the list's copy is updated with it. */
export async function refreshGroup(slug: string): Promise<Group> {
  const startedIn = generation;
  const fresh = await getGroupBySlug(slug);
  if (startedIn !== generation) return fresh;
  const current = cachedGroup(slug);
  // An older server leaves friendsJoined out of this response; keep the
  // list's count rather than dropping the community to 0 in a Friends sort.
  const withFriends =
    fresh.friendsJoined === undefined && current?.friendsJoined !== undefined ? { ...fresh, friendsJoined: current.friendsJoined } : fresh;
  // Keeps the cached object when nothing the page shows changed.
  const next = current && sameCommunities([current], [withFriends]) ? current : withFriends;
  singles.set(slug, next);
  if (groups) groups = replaceGroup(groups, next);
  if (next !== current) emit();
  return next;
}

function applyGroup(next: Group) {
  singles.set(next.slug, next);
  if (groups) groups = replaceGroup(groups, next);
  emit();
}

/**
 * Joins or leaves, showing the result straight away. If the server refuses,
 * the change is undone and the error is rethrown for the caller to report.
 */
export async function setMembership(slug: string, isMember: boolean): Promise<void> {
  const before = cachedGroup(slug);
  if (!before || before.isMember === isMember) return;
  applyGroup(withMembership(before, isMember));
  members.delete(slug);
  try {
    await (isMember ? joinGroup(slug) : leaveGroup(slug));
  } catch (error) {
    const current = cachedGroup(slug);
    if (current) applyGroup(withMembership(current, before.isMember));
    throw error;
  }
}

export function cachedMembers(slug: string): GroupMember[] | undefined {
  return members.get(slug);
}

export async function refreshMembers(slug: string): Promise<GroupMember[]> {
  const startedIn = generation;
  const items = await getGroupMembers(slug);
  if (startedIn === generation) members.set(slug, items);
  return items;
}
