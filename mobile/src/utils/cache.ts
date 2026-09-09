// Small shared caching helpers for "show what we already have, then quietly
// check whether it changed" screens.

// Cheap structural equality for API payloads. They're small, flat-ish JSON
// straight off the wire with stable key order from the server, so stringify
// is both correct enough and faster than walking them by hand — and a false
// "changed" only costs one extra render, never wrong data.
//
// The point of comparing at all is identity: handing React a fresh-but-
// identical object throws away every downstream useMemo keyed on it. On the
// profile screens that means re-deriving the whole CineGraph donut (slice
// geometry plus 19 chip positions) for data that didn't move.
export function sameShape<T>(a: T | null | undefined, b: T | null | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

// Insertion-ordered map with a hard cap, evicting whatever was touched
// longest ago. Browsing profiles is exactly the access pattern this suits:
// you bounce between a handful repeatedly, and the long tail is never worth
// holding on to.
export function createLruCache<V>(limit: number) {
  const map = new Map<string, V>();

  return {
    get(key: string): V | undefined {
      const value = map.get(key);
      // Re-insert so a read counts as a use, not just a write.
      if (value !== undefined) {
        map.delete(key);
        map.set(key, value);
      }
      return value;
    },
    set(key: string, value: V) {
      if (map.has(key)) map.delete(key);
      map.set(key, value);
      while (map.size > limit) {
        const oldest = map.keys().next().value;
        if (oldest === undefined) break;
        map.delete(oldest);
      }
    },
    delete(key: string) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  };
}
