// The titles a list is saved with, checked in one place: creating a list with
// its titles already chosen, and replacing a list's titles from the editor.
//
// Pure, so it's unit-tested (listItems.test.js).

export const MAX_LIST_ITEMS = 500;

const OBJECT_ID = /^[a-f\d]{24}$/i;
const ITEM_TYPES = new Set(["movie", "series"]);

const keyOf = (itemType, itemId) => `${itemType}:${String(itemId).toLowerCase()}`;

/**
 * `{ items }` for a valid array of `{ itemId, itemType }`, or `{ error }`.
 *
 * Items keep the order they were given in and repeats are dropped. An item
 * that's already on the list keeps the date it was first added, so saving
 * the editor doesn't make every title look newly added.
 */
export function normalizeListItems(input, existing = [], now = new Date()) {
  if (!Array.isArray(input)) return { error: "items must be an array" };

  const addedAt = new Map((existing || []).map((item) => [keyOf(item.itemType, item.itemId), item.addedAt]));
  const seen = new Set();
  const items = [];

  for (const raw of input) {
    const itemId = raw?.itemId == null ? "" : String(raw.itemId);
    const itemType = raw?.itemType;
    if (!OBJECT_ID.test(itemId) || !ITEM_TYPES.has(itemType)) {
      return { error: "Each item needs a valid itemId and an itemType of movie or series" };
    }
    const key = keyOf(itemType, itemId);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ itemId, itemType, addedAt: addedAt.get(key) ?? now });
  }

  if (items.length > MAX_LIST_ITEMS) return { error: `A list can hold at most ${MAX_LIST_ITEMS} titles` };
  return { items };
}
