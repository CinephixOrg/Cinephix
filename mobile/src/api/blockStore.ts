// The people you've blocked, for everything that shows other people's
// content. A module-level store (not just context state) so non-React code
// — the chat, profile and activity caches — can drop a blocked person's
// things the moment they're blocked, and screens re-render through
// useSyncExternalStore.

type Listener = () => void;

let blocked: ReadonlySet<string> = new Set();
const listeners = new Set<Listener>();
const blockListeners = new Set<(userId: string) => void>();

export function blockedSnapshot(): ReadonlySet<string> {
  return blocked;
}

export function subscribeBlocked(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Called with each newly blocked id — for caches to purge that person. */
export function onUserBlocked(listener: (userId: string) => void): () => void {
  blockListeners.add(listener);
  return () => {
    blockListeners.delete(listener);
  };
}

function publish(next: ReadonlySet<string>) {
  blocked = next;
  for (const listener of listeners) listener();
}

export function setBlocked(ids: Iterable<string>) {
  publish(new Set(ids));
}

export function markBlocked(userId: string) {
  if (blocked.has(userId)) return;
  publish(new Set([...blocked, userId]));
  for (const listener of blockListeners) listener(userId);
}

export function markUnblocked(userId: string) {
  if (!blocked.has(userId)) return;
  const next = new Set(blocked);
  next.delete(userId);
  publish(next);
}

// The official Cinephix account(s): not reportable or blockable, so nothing
// of theirs gets a ⋯. Loaded once at sign-in; content can also say so itself
// (`isOfficial` on a populated user).
let officialIds: ReadonlySet<string> = new Set();

export function setOfficialIds(ids: Iterable<string>) {
  officialIds = new Set(ids);
}

export function isProtectedAccount(person: { _id: string; isOfficial?: boolean } | null | undefined): boolean {
  return Boolean(person && (person.isOfficial || officialIds.has(person._id)));
}
