// Small in-memory TTL cache, same idea as services/llmAdapter.js's own but
// reusable and unit-testable. Per-process, so it warms independently on each
// instance and empties on restart — correct for values that are derived,
// cheap to recompute, and never authoritative.

export function createTtlCache({ ttlMs, limit = 500, now = () => Date.now() }) {
  const entries = new Map();

  const isExpired = (entry) => now() - entry.ts > ttlMs;

  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (isExpired(entry)) {
        entries.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value) {
      // Sweep on write rather than on a timer: this runs inside a request
      // that's already doing far more work than a Map scan, and it means no
      // background interval keeping the process awake.
      if (entries.size >= limit) {
        for (const [k, entry] of entries) {
          if (isExpired(entry)) entries.delete(k);
        }
        // Still full of live entries — drop the oldest insertion to keep the
        // bound hard rather than letting it drift.
        if (entries.size >= limit) {
          const oldest = entries.keys().next().value;
          if (oldest !== undefined) entries.delete(oldest);
        }
      }
      entries.set(key, { value, ts: now() });
      return value;
    },
    delete(key) {
      entries.delete(key);
    },
    clear() {
      entries.clear();
    },
    get size() {
      return entries.size;
    },
  };
}
