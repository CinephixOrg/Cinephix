// The web list editor's draft: the titles being added, what suggestions are
// drawn from, and whether anything changed. The same rules as the mobile
// editor (mobile/src/utils/listDraft.ts).

/** Suggestions appear once a list has this many titles... */
export const MIN_ITEMS_FOR_SUGGESTIONS = 3;
/** ...and are drawn from this many of the most recently added. */
export const SUGGESTION_SEED_COUNT = 3;

const TMDB_IMAGE = "https://image.tmdb.org/t/p";

/** A TMDB poster URL at a size, or null without a path. */
export const posterUrl = (path, size = "w185") => (path ? `${TMDB_IMAGE}/${size}${path}` : null);

export const draftKey = (item) => `${item.type}:${item.id}`;

/**
 * A title's identity across duplicate catalogue records: its kind, title and
 * year. The catalogue holds some titles twice, so a suggestion can be a
 * different record of a title that's already on the list.
 */
export const titleIdentity = (item) =>
  `${item.type}:${String(item.title ?? "").trim().toLowerCase().replace(/\s+/g, " ")}:${item.year ?? ""}`;

export function yearOf(date) {
  return typeof date === "string" && /^\d{4}/.test(date) ? date.slice(0, 4) : null;
}

/** Appends a title, or returns the same array when it's already there. */
export function addToDraft(items, item) {
  const key = draftKey(item);
  return items.some((existing) => draftKey(existing) === key) ? items : [...items, item];
}

/** Removes a title by key, or returns the same array when it isn't there. */
export function removeFromDraft(items, key) {
  const next = items.filter((item) => draftKey(item) !== key);
  return next.length === items.length ? items : next;
}

/** The most recently added titles, newest first; empty below the threshold. */
export function suggestionSeeds(items, minItems = MIN_ITEMS_FOR_SUGGESTIONS, count = SUGGESTION_SEED_COUNT) {
  if (items.length < minItems) return [];
  return items.slice(-count).reverse();
}

/** Stable identity for a set of seeds: the same seeds, the same suggestions. */
export const seedsKey = (seeds) => seeds.map(draftKey).join("|");

/** Alternates two result lists (movies and series), so both kinds show near the top. */
export function interleave(a, b, limit) {
  const out = [];
  for (let i = 0; out.length < limit && (i < a.length || i < b.length); i++) {
    if (i < a.length) out.push(a[i]);
    if (out.length < limit && i < b.length) out.push(b[i]);
  }
  return out;
}

/** Whether the draft differs from what was loaded: what leaving would throw away. */
export function isDraftChanged(baseline, draft) {
  if (baseline.name.trim() !== draft.name.trim()) return true;
  if (baseline.description.trim() !== draft.description.trim()) return true;
  if (baseline.isPublic !== draft.isPublic) return true;
  if (baseline.items.length !== draft.items.length) return true;
  return baseline.items.some((item, index) => draftKey(item) !== draftKey(draft.items[index]));
}
