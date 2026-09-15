import { getCineGraph, getUserCollections, getUserProfile } from "./userService";
import { getFavorites } from "./favoriteService";
import { getUserShares, SHARES_PREVIEW_LIMIT } from "./shareService";
import { prefetchSyncScore } from "./syncScoreCache";
import { invalidatePublicCollections } from "./publicCollectionCache";
import { createLruCache } from "../utils/cache";
import type { CineGraphData, Favorites, PublicProfile, Share, UserCollections } from "../types";

export interface PublicProfileBundle {
  profile: PublicProfile;
  cineGraph: CineGraphData;
  favorites: Favorites;
  shareCount: number;
  // The Sharings grid's own page, fetched here rather than by that tab, so
  // the default tab has content the moment the profile does.
  shares: Share[];
}

// Enough to cover bouncing around a follower list or a few conversations
// without holding every profile ever opened. Survives navigation but not an
// app restart, which is the right lifetime for something we revalidate on
// every visit anyway.
const bundles = createLruCache<PublicProfileBundle>(24);
const collections = createLruCache<UserCollections>(24);

// One in-flight request per user, so two things asking for the same profile
// at once (the screen's focus effect racing its own remount) share a single
// round trip instead of firing two.
const inFlight = new Map<string, Promise<PublicProfileBundle>>();
const collectionsInFlight = new Map<string, Promise<UserCollections>>();

export function getCachedPublicProfile(userId: string): PublicProfileBundle | undefined {
  return bundles.get(userId);
}

export function getCachedCollections(userId: string): UserCollections | undefined {
  return collections.get(userId);
}

// Lists / watched list / watchlist. Deliberately NOT part of the bundle
// below any more.
//
// It's the heaviest request on this screen — per-list preview hydration plus
// a content lookup for each of the two watch lists — and it feeds the Lists
// tab, which isn't the one that opens first. Inside the bundle's
// Promise.all, its cost was added to every profile open, holding the header
// and the Sharings grid behind data for a tab the user might never reach.
// Started at the same moment but awaited separately, it lands while they're
// still looking at Sharings.
export function fetchPublicProfileCollections(userId: string): Promise<UserCollections> {
  const existing = collectionsInFlight.get(userId);
  if (existing) return existing;

  const request = getUserCollections(userId).then((result) => {
    collections.set(userId, result);
    return result;
  });

  collectionsInFlight.set(userId, request);
  request.catch(() => {}).finally(() => collectionsInFlight.delete(userId));
  return request;
}

// Always hits the network — callers decide whether to *wait* on it. The
// screen renders whatever getCachedPublicProfile returned and lets this
// resolve underneath, so a profile you've opened before appears instantly
// and still corrects itself if the other person has since rated something.
export function fetchPublicProfile(userId: string): Promise<PublicProfileBundle> {
  const existing = inFlight.get(userId);
  if (existing) return existing;

  // Both started here, neither awaited below. The profile must never wait on
  // data belonging to a tab that isn't open yet — but starting them now is
  // exactly what makes those tabs instant once they are.
  prefetchSyncScore(userId).catch(() => {
    // Silent — the Sync Score card retries on its own.
  });
  fetchPublicProfileCollections(userId).catch(() => {
    // Silent — the Lists tab retries on its own.
  });

  const request = (async () => {
    const [profile, cineGraph, favorites, shares] = await Promise.all([
      getUserProfile(userId),
      getCineGraph(userId),
      getFavorites(userId),
      getUserShares(userId, 1, SHARES_PREVIEW_LIMIT),
    ]);
    const bundle: PublicProfileBundle = {
      profile,
      cineGraph,
      favorites,
      shareCount: shares.total,
      shares: shares.items,
    };
    bundles.set(userId, bundle);
    return bundle;
  })();

  inFlight.set(userId, request);
  request.catch(() => {}).finally(() => inFlight.delete(userId));
  return request;
}

// Called when something makes the cached copy definitely wrong rather than
// merely old — following someone changes what their profile will return.
export function invalidatePublicProfile(userId: string) {
  bundles.delete(userId);
  collections.delete(userId);
  invalidatePublicCollections(userId);
}
