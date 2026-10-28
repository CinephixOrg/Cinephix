// A title's name in its own language travels with it to the app.
//
// The catalogue stores every title under its English name (`title`, or
// `name` for series), plus — where TMDB gave one — its name in its original
// language (`original_title` / `original_name`) and that language's code
// (`original_language`). The app shows the original name when the title's
// language is the one the app is in, and the English name otherwise: a
// Turkish-language app shows "Kurtlar Vadisi" but still "Breaking Bad"
// (mobile/src/utils/localizedTitles.ts). So any response that carries a
// title has to carry these three fields alongside it.

export const ORIGINAL_TITLE_FIELDS = ["original_title", "original_name", "original_language"];

/** For an aggregation `$project` that keeps a title: `{ title: 1, ...ORIGINAL_TITLE_PROJECTION }`. */
export const ORIGINAL_TITLE_PROJECTION = Object.fromEntries(ORIGINAL_TITLE_FIELDS.map((field) => [field, 1]));

/**
 * `{ title, original_title?, original_language? }` for a response that
 * re-shapes a catalogue document: `{ id, ...titleFields(doc), poster_path }`.
 */
export function titleFields(doc) {
  const out = { title: doc.title || doc.name };
  const original = doc.original_title || doc.original_name;
  if (original && doc.original_language) {
    out.original_title = original;
    out.original_language = doc.original_language;
  }
  return out;
}

const selectsTitle = (projection) => {
  if (!projection || !("title" in projection || "name" in projection)) return false;
  // Only an inclusive projection ("title poster_path") leaves the original
  // name out; an exclusive one ("-overview") already returns it.
  return Object.entries(projection).some(([field, value]) => field !== "_id" && (value === 1 || value === true));
};

/**
 * Schema plugin for the Movie and Series models: any find that selects the
 * title also selects the original-name fields, so the ~30 projections and
 * populates across the controllers don't each have to list them.
 */
export function selectOriginalTitles(schema) {
  schema.pre(["find", "findOne"], function () {
    if (selectsTitle(this.projection())) this.select(ORIGINAL_TITLE_PROJECTION);
  });
}
