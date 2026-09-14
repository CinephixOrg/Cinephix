// A request started a moment before the screen that needs it exists.
//
// A tap that navigates can start the destination's request alongside the
// push, and the destination, once mounted, takes that same request instead of
// starting its own — so the round trip begins a whole transition earlier.
//
// Pure (no React Native) so it runs under `node --test` (prefetch.test.mts).

export interface Prefetcher<T> {
  /** Starts loading `key`, or leaves a fresh load already started alone. */
  prefetch(key: string): void;
  /**
   * The prefetched load for `key` when there's a fresh one, otherwise a new
   * one. Either way the slot is emptied, so the next call — a refresh, a
   * retry — goes to the network.
   */
  take(key: string): Promise<T>;
}

export function createPrefetcher<T>(
  load: (key: string) => Promise<T>,
  { ttlMs = 15_000, now = Date.now }: { ttlMs?: number; now?: () => number } = {}
): Prefetcher<T> {
  const slots = new Map<string, { promise: Promise<T>; startedAt: number }>();

  // A prefetch nobody took in time is old news: whatever opens later loads
  // its own copy.
  const fresh = (key: string) => {
    const slot = slots.get(key);
    if (slot && now() - slot.startedAt < ttlMs) return slot;
    slots.delete(key);
    return undefined;
  };

  return {
    prefetch(key) {
      if (fresh(key)) return;
      const slot = { promise: load(key), startedAt: now() };
      slots.set(key, slot);
      // A failed prefetch isn't reported (the screen reports its own
      // failure) and isn't kept, so taking it later loads again.
      slot.promise.catch(() => {
        if (slots.get(key) === slot) slots.delete(key);
      });
    },
    take(key) {
      const slot = fresh(key);
      slots.delete(key);
      return slot ? slot.promise : load(key);
    },
  };
}
