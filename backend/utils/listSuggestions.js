// The pure half of list suggestions (services/listSuggestions.js does the
// fetching): reading a request, and merging several titles' recommendations
// into one ranked pool.
//
// Pure, so it's unit-tested (listSuggestions.test.js).

/** How many of the list's most recently added titles suggestions are drawn from. */
export const MAX_SEEDS = 3;
export const DEFAULT_SUGGESTIONS = 18;
export const MAX_SUGGESTIONS = 30;
const MAX_EXCLUDE = 1000;

const OBJECT_ID = /^[a-f\d]{24}$/i;
const ITEM_TYPES = new Set(["movie", "series"]);

export const catalogKey = (itemType, itemId) => `${itemType}:${String(itemId).toLowerCase()}`;

const yearOf = (date) => (typeof date === "string" && /^\d{4}/.test(date) ? date.slice(0, 4) : "");

const normalizeTitle = (title) =>
  String(title ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/**
 * Recognizes a title across duplicate catalogue records. The catalogue holds
 * the same show more than once (a legacy import without a TMDB id beside a
 * TMDB-keyed record), so "already on the list" can't be a catalogue id alone:
 * the list may hold one record while a recommendation resolves to the other.
 *
 * Two titles match when they're the same kind with the same normalized title
 * and the same release year — or when either side has no year to compare, so
 * an undated record still matches its dated twin.
 */
export function createTitleMatcher() {
  const yearsByTitle = new Map();
  const titleKey = (itemType, title) => {
    const normalized = normalizeTitle(title);
    return normalized ? `${itemType}:${normalized}` : null;
  };
  return {
    add(itemType, title, date) {
      const key = titleKey(itemType, title);
      if (!key) return;
      if (!yearsByTitle.has(key)) yearsByTitle.set(key, new Set());
      yearsByTitle.get(key).add(yearOf(date));
    },
    has(itemType, title, date) {
      const key = titleKey(itemType, title);
      const years = key ? yearsByTitle.get(key) : undefined;
      if (!years) return false;
      const year = yearOf(date);
      return year === "" || years.has("") || years.has(year);
    },
  };
}

const validItem = (raw) => raw && OBJECT_ID.test(String(raw.itemId ?? "")) && ITEM_TYPES.has(raw.itemType);

/**
 * `{ seeds, exclude, limit }` from a request body, or `{ error }`.
 *
 * seeds    the titles to draw from, most recently added last (only the last
 *          MAX_SEEDS are used)
 * exclude  titles already on the list, as catalogue keys; the seeds are
 *          always excluded too
 */
export function parseSuggestionRequest(body) {
  if (!Array.isArray(body?.seeds) || body.seeds.length === 0) return { error: "seeds must be a non-empty array" };

  const seeds = [];
  for (const raw of body.seeds.slice(-MAX_SEEDS)) {
    if (!validItem(raw)) return { error: "Each seed needs a valid itemId and an itemType of movie or series" };
    seeds.push({ itemId: String(raw.itemId), itemType: raw.itemType });
  }

  if (body.exclude !== undefined && !Array.isArray(body.exclude)) return { error: "exclude must be an array" };
  const exclude = new Set();
  for (const raw of (body.exclude ?? []).slice(0, MAX_EXCLUDE)) {
    if (validItem(raw)) exclude.add(catalogKey(raw.itemType, raw.itemId));
  }
  for (const seed of seeds) exclude.add(catalogKey(seed.itemType, seed.itemId));

  const requested = Number.parseInt(body.limit, 10);
  const limit = Number.isFinite(requested) ? Math.min(MAX_SUGGESTIONS, Math.max(1, requested)) : DEFAULT_SUGGESTIONS;

  return { seeds, exclude, limit };
}

/**
 * One pool from several ranked recommendation lists (one per seed), each a
 * list of `{ key, ... }` candidates best first.
 *
 *   * A title recommended for more of the seeds ranks higher: it fits the
 *     list, not just one title on it.
 *   * Then by how highly it was ranked (1 for first, 1/2 for second, ...,
 *     summed across seeds).
 *   * Titles that tie take turns from each seed in seed order, so the pool
 *     reads as a mix rather than one seed's list followed by the next.
 */
export function mergeRecommendations(rankedLists) {
  const byKey = new Map();
  let firstSeen = 0;

  (rankedLists || []).forEach((list) => {
    (list || []).forEach((candidate, index) => {
      const weight = 1 / (index + 1);
      const entry = byKey.get(candidate.key);
      if (entry) {
        entry.seeds += 1;
        entry.score += weight;
        entry.best = Math.min(entry.best, index);
      } else {
        byKey.set(candidate.key, { candidate, seeds: 1, score: weight, best: index, order: firstSeen++ });
      }
    });
  });

  return [...byKey.values()]
    .sort((a, b) => b.seeds - a.seeds || b.score - a.score || a.best - b.best || a.order - b.order)
    .map((entry) => entry.candidate);
}
