// The list editor's draft: the titles being added, what suggestions are
// drawn from, and whether anything changed.
//
// Pure (no React Native) so it runs under `node --test` (listDraft.test.mts).

import type { ContentType } from "../types";

export interface DraftItem {
  id: string;
  type: ContentType;
  title: string;
  posterPath: string | null;
  /** Four-digit release year, or null. */
  year: string | null;
}

export interface DraftFields {
  name: string;
  description: string;
  isPublic: boolean;
  items: DraftItem[];
}

/** Suggestions appear once a list has this many titles. */
export const MIN_ITEMS_FOR_SUGGESTIONS = 3;
/** And are drawn from this many of the most recently added. */
export const SUGGESTION_SEED_COUNT = 3;

export const draftKey = (item: { id: string; type: ContentType }) => `${item.type}:${item.id}`;

/**
 * A title's identity across duplicate catalogue records: its kind, title and
 * year. The catalogue holds some titles twice, so a suggestion can be a
 * different record of a title that's already on the list.
 */
export const titleIdentity = (item: { type: ContentType; title: string; year: string | null }) =>
  `${item.type}:${item.title.trim().toLowerCase().replace(/\s+/g, " ")}:${item.year ?? ""}`;

export function yearOf(date: string | null | undefined): string | null {
  return date && /^\d{4}/.test(date) ? date.slice(0, 4) : null;
}

/** Appends a title, or returns the same array when it's already there. */
export function addToDraft(items: DraftItem[], item: DraftItem): DraftItem[] {
  const key = draftKey(item);
  return items.some((existing) => draftKey(existing) === key) ? items : [...items, item];
}

/** Removes a title by key, or returns the same array when it isn't there. */
export function removeFromDraft(items: DraftItem[], key: string): DraftItem[] {
  const next = items.filter((item) => draftKey(item) !== key);
  return next.length === items.length ? items : next;
}

/**
 * The titles suggestions are drawn from: the most recently added, newest
 * first. Empty until the list has enough titles for suggestions to mean
 * anything.
 */
export function suggestionSeeds(
  items: DraftItem[],
  minItems = MIN_ITEMS_FOR_SUGGESTIONS,
  count = SUGGESTION_SEED_COUNT
): DraftItem[] {
  if (items.length < minItems) return [];
  return items.slice(-count).reverse();
}

/** Stable identity for a set of seeds: the same seeds, the same suggestions. */
export const seedsKey = (seeds: DraftItem[]) => seeds.map(draftKey).join("|");

/** Alternates two result lists (movies and series), so both kinds show near the top. */
export function interleave<T>(a: readonly T[], b: readonly T[], limit: number): T[] {
  const out: T[] = [];
  for (let i = 0; out.length < limit && (i < a.length || i < b.length); i++) {
    if (i < a.length) out.push(a[i]);
    if (out.length < limit && i < b.length) out.push(b[i]);
  }
  return out;
}

/** Whether the draft differs from what was loaded: what leaving the editor would throw away. */
export function isDraftChanged(baseline: DraftFields, draft: DraftFields): boolean {
  if (baseline.name.trim() !== draft.name.trim()) return true;
  if (baseline.description.trim() !== draft.description.trim()) return true;
  if (baseline.isPublic !== draft.isPublic) return true;
  if (baseline.items.length !== draft.items.length) return true;
  return baseline.items.some((item, index) => draftKey(item) !== draftKey(draft.items[index]));
}
