import { deleteList, getMyLists } from "./listService";
import type { CustomList } from "../types";

// The signed-in user's own lists, behind the Lists page. The same model as the
// Watched List and Watchlist caches (collectionCache.ts):
//
//   * stale-while-revalidate: a revisit renders the cached lists on the first
//     frame and quietly refreshes underneath;
//   * one shared in-flight request, so a focus and a pull-to-refresh racing
//     each other cost a single round trip;
//   * optimistic delete with an undo window that survives a refresh landing
//     in the middle of it;
//   * a list created from the page appears straight away. Changes made
//     elsewhere (renaming a list on its own page, adding a title to a list
//     from the title's page) show on the next visit, which refreshes once
//     the cache is more than FRESH_MS old.

const FRESH_MS = 5_000;

type Listener = (lists: CustomList[]) => void;

const listeners = new Set<Listener>();
// Deleted optimistically, delete not yet sent (or not yet confirmed).
const pendingRemoval = new Set<string>();
// When each confirmed delete landed: a refresh that started before it can
// still carry the list, so for that refresh the delete wins.
const confirmedRemoval = new Map<string, number>();

let lists: CustomList[] | null = null;
let ownerId: string | null = null;
let fetchedAt = 0;
let stale = true;
let inFlight: Promise<CustomList[]> | null = null;

// The server's order: the user's own order, newest first, then creation time.
function byServerOrder(a: CustomList, b: CustomList): number {
  return (b.order ?? 0) - (a.order ?? 0) || (b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0);
}

// Cheap equality for the refresh path, so unchanged lists keep their identity
// and the page doesn't rebuild its search index or re-render every card.
function sameLists(a: CustomList[], b: CustomList[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((x, i) => {
    const y = b[i];
    return (
      x._id === y._id &&
      x.updatedAt === y.updatedAt &&
      x.name === y.name &&
      x.items.length === y.items.length &&
      x.likeCount === y.likeCount &&
      x.views === y.views &&
      (x.previewItems?.length ?? 0) === (y.previewItems?.length ?? 0)
    );
  });
}

function emit() {
  if (!lists) return;
  for (const listener of listeners) listener(lists);
}

function reset(userId: string) {
  lists = null;
  ownerId = userId;
  fetchedAt = 0;
  stale = true;
  inFlight = null;
  pendingRemoval.clear();
  confirmedRemoval.clear();
}

function restore(list: CustomList) {
  pendingRemoval.delete(list._id);
  confirmedRemoval.delete(list._id);
  if (!lists || lists.some((existing) => existing._id === list._id)) return;
  lists = [...lists, list].sort(byServerOrder);
  emit();
}

export const myListsCache = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** The cached lists for this user, or null if nothing has loaded yet. */
  getCached(userId: string): CustomList[] | null {
    return ownerId === userId ? lists : null;
  },

  isFresh(): boolean {
    return !stale && Date.now() - fetchedAt < FRESH_MS;
  },

  /** Always hits the network; callers decide whether to wait on it. */
  load(userId: string): Promise<CustomList[]> {
    if (ownerId !== userId) reset(userId);
    if (inFlight) return inFlight;

    const request = (async () => {
      const startedAt = Date.now();
      const fetched = await getMyLists();
      // The account changed while this was in flight; its result belongs to nobody now.
      if (ownerId !== userId) return lists ?? [];

      const next = fetched.filter((list) => {
        if (pendingRemoval.has(list._id)) return false;
        const confirmedAt = confirmedRemoval.get(list._id);
        if (confirmedAt === undefined) return true;
        if (confirmedAt >= startedAt) return false;
        confirmedRemoval.delete(list._id);
        return true;
      });

      fetchedAt = Date.now();
      stale = false;
      if (!lists || !sameLists(lists, next)) {
        lists = next;
        emit();
      }
      return lists;
    })();

    inFlight = request;
    request
      .catch(() => {})
      .finally(() => {
        if (inFlight === request) inFlight = null;
      });
    return request;
  },

  /** Takes a list off the page without telling the server yet. Returns it, for restore. */
  hide(listId: string): CustomList | null {
    const target = lists?.find((list) => list._id === listId) ?? null;
    if (!target || !lists) return null;
    pendingRemoval.add(listId);
    lists = lists.filter((list) => list._id !== listId);
    emit();
    return target;
  },

  /** Puts a hidden list back in its place. */
  restore,

  /** Sends the delete for a hidden list. On failure the list is restored and the error rethrown. */
  async commitRemoval(list: CustomList): Promise<void> {
    try {
      await deleteList(list._id);
    } catch (error: any) {
      // Already gone (deleted on another device) is what was wanted.
      if (error?.response?.status !== 404) {
        restore(list);
        throw error;
      }
    }
    confirmedRemoval.set(list._id, Date.now());
    pendingRemoval.delete(list._id);
  },

  /** A list created or changed by this device, shown without waiting for a refresh. */
  upsert(userId: string, list: CustomList): void {
    stale = true;
    if (ownerId !== userId || !lists) return;
    const previous = lists.find((existing) => existing._id === list._id);
    const merged: CustomList = { ...previous, ...list, previewItems: list.previewItems ?? previous?.previewItems ?? [] };
    lists = [...lists.filter((existing) => existing._id !== list._id), merged].sort(byServerOrder);
    emit();
  },
};
