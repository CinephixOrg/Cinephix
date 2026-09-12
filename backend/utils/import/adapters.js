// Adapters: raw file text -> normalized items.
//
// Stage 1-2 of the pipeline: Upload -> **Parse + Normalize** -> Match -> Save.
//
// Most sources are column-shaped, so one profile-driven adapter handles them
// all off the declarations in sources.js. Four are structurally nested in
// ways no column mapping can express (TV Time's seasons-inside-shows, Trakt's
// wrapper objects, MAL's XML, AniList's media objects) and get real adapters.
//
// Pure: takes `{ name, text }` file records, returns items. No I/O.

import { parseCsv } from "./csv.js";
import {
  buildHeaderIndex,
  cleanIds,
  dedupe,
  foldTitle,
  inferScale,
  makeItem,
  normalizeRating,
  normalizeType,
  parseBoolean,
  parseDate,
  parseYear,
  pickFolded,
  foldStatus,
  WATCHED_STATUSES,
  PLANNED_STATUSES,
} from "./normalize.js";
import { getSource, resolveMap } from "./sources.js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// JSON exports bury their list at a different key in every product. Find it
// rather than making each adapter special-case its own.
const LIST_KEYS = [
  "results", "items", "data", "entries", "list", "lists", "movies", "shows",
  "series", "anime", "library", "media", "records", "watched", "history",
];

export function toArray(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") return [];
  for (const key of LIST_KEYS) {
    const value = parsed[key];
    if (Array.isArray(value)) return value;
  }
  // AniList-style: an object whose values are themselves the lists.
  const collected = [];
  for (const value of Object.values(parsed)) {
    if (Array.isArray(value)) collected.push(...value);
    else if (value && typeof value === "object") {
      for (const nested of Object.values(value)) {
        if (Array.isArray(nested)) collected.push(...nested);
      }
    }
  }
  return collected;
}

export function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Flattens nested objects to dotted keys so JSON rows can use the same
// column machinery as CSV ones — this is what makes Jellyfin's
// `ProviderIds.Imdb` and Kodi's `uniqueid.imdb` resolvable as columns.
export function flattenRow(row, prefix = "", out = {}, depth = 0) {
  if (!row || typeof row !== "object") return out;
  for (const [key, value] of Object.entries(row)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      // Arrays of primitives are worth keeping as a joined string (genres);
      // arrays of objects are not column-shaped and are left to adapters.
      if (value.length > 0 && value.every((v) => typeof v !== "object")) {
        out[path] = value.join(", ");
      }
      continue;
    }
    if (typeof value === "object") {
      if (depth < 3) flattenRow(value, path, out, depth + 1);
      continue;
    }
    out[path] = value;
  }
  return out;
}

const isCsvName = (name) => /\.csv$/i.test(name);
const isJsonName = (name) => /\.json$/i.test(name);

// Turns one file into row objects, whatever its format.
function readRows(file) {
  // Content wins over the extension. Exports are routinely misnamed — a
  // JSON body saved as .csv is common enough that trusting the name would
  // silently produce an import of zero items.
  const head = file.text.slice(0, 200).trimStart();
  const looksJson = head.startsWith("{") || head.startsWith("[");
  if (looksJson || (isJsonName(file.name) && !isCsvName(file.name))) {
    return toArray(safeJson(file.text)).map((row) => flattenRow(row));
  }
  return parseCsv(file.text);
}

// ---------------------------------------------------------------------------
// Profile adapter — every column-shaped source
// ---------------------------------------------------------------------------

function adaptProfile(source, files, map) {
  const items = [];

  for (const file of files) {
    const rows = readRows(file);
    if (rows.length === 0) continue;
    // One header index per file, not per row: the key set is identical
    // across a file's rows, and folding every header for every row was the
    // single largest avoidable cost in the parse stage.
    const index = buildHeaderIndex(rows[0]);
    const flags = file.flags || {};

    for (const row of rows) {
      const rawTitle = pickFolded(row, index, map.title) ?? pickFolded(row, index, map.originalTitle);
      const ids = cleanIds({
        imdb: pickFolded(row, index, map.ids.imdb),
        tmdb: pickFolded(row, index, map.ids.tmdb),
        tvdb: pickFolded(row, index, map.ids.tvdb),
        mal: pickFolded(row, index, map.ids.mal),
        anilist: pickFolded(row, index, map.ids.anilist),
        kitsu: pickFolded(row, index, map.ids.kitsu),
        trakt: pickFolded(row, index, map.ids.trakt),
        simkl: pickFolded(row, index, map.ids.simkl),
      });
      // A row with neither a title nor any id identifies nothing.
      if (!rawTitle && Object.keys(ids).length === 0) continue;

      const rawFavorite = pickFolded(row, index, map.favorite);
      const rawEpisodes = pickFolded(row, index, map.episodes);
      const ratingRaw = pickFolded(row, index, map.rating);

      // A recognised status column settles both flags on its own. Reading
      // the boolean columns as well would double-count: Simkl keeps its
      // status in a column literally named "Watchlist", so a completed film
      // would come out marked both watched and planned.
      const status = foldStatus(pickFolded(row, index, map.status));
      const statusWatched = WATCHED_STATUSES.has(status);
      const statusPlanned = PLANNED_STATUSES.has(status);

      let watched;
      let watchlist;
      if (statusWatched || statusPlanned) {
        watched = statusWatched;
        watchlist = statusPlanned;
      } else {
        // A date column that has a value means it was watched; a counter
        // column means it if the count is above zero.
        const watchedAtPresent = pickFolded(row, index, map.watchedIfPresent) !== undefined;
        watched = parseBoolean(pickFolded(row, index, map.watched), false) || watchedAtPresent;
        watchlist = parseBoolean(pickFolded(row, index, map.watchlist), false);
      }

      const item = makeItem({
        type: normalizeType(pickFolded(row, index, map.type), map.defaultType),
        title: rawTitle ? String(rawTitle) : "",
        year: parseYear(pickFolded(row, index, map.year)),
        ids,
        // The file's own flag wins when set; otherwise use what the
        // columns said above.
        watched: flags.watched === true || watched,
        watchlist: flags.watchlist === true || watchlist,
        favorite: flags.favorite === true || parseBoolean(rawFavorite, false),
        watchedAt: parseDate(pickFolded(row, index, map.watchedAt)),
        episodes: rawEpisodes ? Math.max(0, parseInt(rawEpisodes, 10) || 0) : 0,
      });
      item.ratingRaw = ratingRaw;
      items.push(item);
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// TV Time — shows.json nests seasons, which nest episodes
// ---------------------------------------------------------------------------

function tvTimeIds(node) {
  return cleanIds({
    tvdb: node.id?.tvdb ?? node["id.tvdb"] ?? node.tvdb,
    imdb: node.id?.imdb ?? node["id.imdb"] ?? node.imdb,
    tmdb: node.id?.tmdb ?? node["id.tmdb"] ?? node.tmdb,
  });
}

function adaptTvTime(source, files) {
  const items = [];

  for (const file of files) {
    const parsed = isCsvName(file.name) ? parseCsv(file.text) : toArray(safeJson(file.text));
    if (!Array.isArray(parsed) || parsed.length === 0) continue;
    const kind = file.kind || (/show/i.test(file.name) ? "shows" : "movies");

    if (kind === "movies") {
      for (const row of parsed) {
        const title = row.title || row.name;
        const ids = tvTimeIds(row);
        if (!title && Object.keys(ids).length === 0) continue;
        const watched = row.is_watched === true || parseBoolean(row.is_watched, false);
        const item = makeItem({
          type: "movie",
          title: title ? String(title) : "",
          year: parseYear(row.year ?? row.release_date),
          ids,
          watched,
          // TV Time has no separate watchlist file: an unwatched movie in
          // the export is exactly what the watchlist is.
          watchlist: !watched,
          watchedAt: parseDate(row.watched_at),
        });
        item.ratingRaw = row.rating;
        items.push(item);
      }
      continue;
    }

    for (const row of parsed) {
      const title = row.title || row.name;
      const ids = tvTimeIds(row);
      if (!title && Object.keys(ids).length === 0) continue;

      let episodes = 0;
      let ratingSum = 0;
      let ratingCount = 0;
      let firstWatchedAt = null;

      for (const season of row.seasons || []) {
        for (const episode of season.episodes || []) {
          if (episode.is_watched) {
            episodes += 1;
            const at = parseDate(episode.watched_at);
            if (at && (!firstWatchedAt || at < firstWatchedAt)) firstWatchedAt = at;
          }
          const rating = Number(episode.rating);
          if (Number.isFinite(rating) && rating > 0) {
            ratingSum += rating;
            ratingCount += 1;
          }
        }
      }

      const item = makeItem({
        type: "series",
        title: title ? String(title) : "",
        year: parseYear(row.year ?? row.first_aired),
        ids,
        watched: episodes > 0,
        watchlist: episodes === 0,
        watchedAt: firstWatchedAt,
        episodes,
      });
      // A show's rating is the mean of its rated episodes — the only
      // show-level signal a TV Time export carries.
      item.ratingRaw = ratingCount > 0 ? ratingSum / ratingCount : row.rating;
      items.push(item);
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// Trakt — every record wraps the real entity in movie/show and nests ids
// ---------------------------------------------------------------------------

function adaptTrakt(source, files, map) {
  const items = [];

  for (const file of files) {
    if (file.kind === "csv" || isCsvName(file.name)) {
      items.push(...adaptProfile(source, [file], map));
      continue;
    }
    const rows = toArray(safeJson(file.text));
    if (rows.length === 0) continue;
    const flags = file.flags || {};

    for (const row of rows) {
      // history.json entries are typed; the per-collection files aren't.
      const node = row.movie || row.show || row.series || row;
      const isSeries = Boolean(row.show || row.series || row.seasons || file.kind === "shows");
      const title = node.title || node.name;
      const ids = cleanIds({
        trakt: node.ids?.trakt,
        imdb: node.ids?.imdb,
        tmdb: node.ids?.tmdb,
        tvdb: node.ids?.tvdb,
      });
      if (!title && Object.keys(ids).length === 0) continue;

      let episodes = 0;
      let firstWatchedAt = parseDate(row.last_watched_at || row.watched_at || row.listed_at || row.rated_at);
      for (const season of row.seasons || []) {
        for (const episode of season.episodes || []) {
          const plays = Number(episode.plays ?? 0);
          if (plays > 0 || episode.last_watched_at) {
            episodes += 1;
            const at = parseDate(episode.last_watched_at);
            if (at && (!firstWatchedAt || at < firstWatchedAt)) firstWatchedAt = at;
          }
        }
      }

      const plays = Number(row.plays ?? 0);
      const item = makeItem({
        type: isSeries ? "series" : "movie",
        title: title ? String(title) : "",
        year: parseYear(node.year),
        ids,
        watched: flags.watched === true || plays > 0 || episodes > 0,
        watchlist: flags.watchlist === true,
        watchedAt: firstWatchedAt,
        episodes,
      });
      item.ratingRaw = row.rating;
      items.push(item);
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// MyAnimeList — gzipped XML
// ---------------------------------------------------------------------------

// A full XML parser is not worth a dependency for a flat, machine-generated
// document with no attributes and no nesting below the entry level. This
// pulls the <anime> blocks and reads their direct children.
const ANIME_BLOCK = /<anime>([\s\S]*?)<\/anime>/gi;

function xmlField(block, tag) {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  if (!match) return undefined;
  const raw = match[1].trim();
  const cdata = raw.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  const value = (cdata ? cdata[1] : raw).trim();
  return value === "" ? undefined : value;
}

// MAL writes 0000-00-00 for "not set", which Date happily turns into a real
// (and wrong) date.
function malDate(value) {
  if (!value || /^0{4}-0{2}-0{2}$/.test(value)) return null;
  return parseDate(value);
}

function adaptMal(source, files, map) {
  const items = [];

  for (const file of files) {
    if (isCsvName(file.name) || (!file.text.includes("<anime>") && !file.text.includes("<myanimelist"))) {
      items.push(...adaptProfile(source, [file], map));
      continue;
    }

    ANIME_BLOCK.lastIndex = 0;
    let match;
    while ((match = ANIME_BLOCK.exec(file.text)) !== null) {
      const block = match[1];
      const title = xmlField(block, "series_title");
      const ids = cleanIds({ mal: xmlField(block, "series_animedb_id") });
      if (!title && Object.keys(ids).length === 0) continue;

      const status = foldStatus(xmlField(block, "my_status"));
      const episodes = parseInt(xmlField(block, "my_watched_episodes") || "0", 10) || 0;
      const item = makeItem({
        // MAL's series_type distinguishes Movie from TV/OVA/ONA/Special.
        type: normalizeType(xmlField(block, "series_type"), "series"),
        title: title ? String(title) : "",
        year: parseYear(xmlField(block, "series_start") || xmlField(block, "my_start_date")),
        ids,
        watched: WATCHED_STATUSES.has(status) || episodes > 0,
        watchlist: PLANNED_STATUSES.has(status),
        watchedAt: malDate(xmlField(block, "my_finish_date")) || malDate(xmlField(block, "my_start_date")),
        episodes,
      });
      item.ratingRaw = xmlField(block, "my_score");
      items.push(item);
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// AniList / Kitsu — a media object beside the list entry
// ---------------------------------------------------------------------------

// Both products title things in several languages at once. Prefer the one a
// user is most likely to have in a local catalogue, then fall back.
function preferredTitle(title) {
  if (!title) return "";
  if (typeof title === "string") return title;
  return (
    title.english || title.en || title.romaji || title.en_jp ||
    title.userPreferred || title.canonical || title.native || title.ja_jp || ""
  );
}

function adaptMediaList(source, files, map, kind) {
  const items = [];

  for (const file of files) {
    if (isCsvName(file.name)) {
      items.push(...adaptProfile(source, [file], map));
      continue;
    }
    const rows = toArray(safeJson(file.text));
    if (rows.length === 0) continue;

    for (const row of rows) {
      const media = row.media || row.anime || row.manga || row.item || row;
      const attributes = row.attributes || {};
      const mediaAttributes = media.attributes || {};

      const title = preferredTitle(
        media.title || media.titles || mediaAttributes.titles || mediaAttributes.canonicalTitle
      );
      const ids = cleanIds({
        anilist: kind === "anilist" ? media.id ?? row.mediaId : media.anilistId,
        mal: media.idMal ?? media.malId ?? mediaAttributes.malId,
        kitsu: kind === "kitsu" ? media.id ?? row.mediaId : media.kitsuId,
      });
      if (!title && Object.keys(ids).length === 0) continue;

      const status = foldStatus(row.status ?? attributes.status);
      const progress = Number(row.progress ?? attributes.progress ?? 0) || 0;
      const startYear =
        media.startDate?.year ??
        parseYear(mediaAttributes.startDate) ??
        parseYear(media.seasonYear);

      const item = makeItem({
        // AniList/Kitsu formats include MOVIE for anime films.
        type: normalizeType(media.format ?? media.type ?? mediaAttributes.subtype, "series"),
        title: title ? String(title) : "",
        year: parseYear(startYear),
        ids,
        watched: WATCHED_STATUSES.has(status) || progress > 0,
        watchlist: PLANNED_STATUSES.has(status),
        watchedAt: parseDate(row.completedAt ?? attributes.finishedAt ?? row.finishedAt),
        episodes: progress,
      });
      item.ratingRaw =
        row.score ?? attributes.ratingTwenty ?? attributes.rating ?? row.rating ?? null;
      items.push(item);
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const ADAPTERS = {
  profile: adaptProfile,
  tvtime: (source, files) => adaptTvTime(source, files),
  trakt: adaptTrakt,
  mal: adaptMal,
  anilist: (source, files, map) => adaptMediaList(source, files, map, "anilist"),
  kitsu: (source, files, map) => adaptMediaList(source, files, map, "kitsu"),
};

// Converts the raw rating each adapter attached into the 1-10 scale, using
// the source's declared scale or, when it has none, one inferred from the
// values actually present.
function applyRatings(items, declaredScale) {
  const scale =
    declaredScale ?? inferScale(items.map((item) => item.ratingRaw).filter((v) => v != null));
  for (const item of items) {
    item.rating = normalizeRating(item.ratingRaw, scale);
    delete item.ratingRaw;
  }
  return scale;
}

/**
 * Normalizes a set of uploaded files into deduplicated items.
 *
 * @param {string} sourceId one of SOURCES
 * @param {Array<{name: string, text: string, flags?: object, kind?: string}>} files
 * @returns {{ items: Array, stats: object }}
 */
export function normalizeFiles(sourceId, files) {
  const source = getSource(sourceId);
  if (!source) throw new Error(`Unknown import source: ${sourceId}`);

  const map = resolveMap(source);
  const adapter = ADAPTERS[source.adapter] || adaptProfile;
  const raw = adapter(source, files, map);
  const scale = applyRatings(raw, source.ratingScale);
  const items = dedupe(raw);

  let movies = 0;
  let series = 0;
  let rated = 0;
  let watched = 0;
  let watchlist = 0;
  let favorites = 0;
  for (const item of items) {
    if (item.type === "series") series += 1;
    else movies += 1;
    if (item.rating !== null) rated += 1;
    if (item.watched) watched += 1;
    if (item.watchlist) watchlist += 1;
    if (item.favorite) favorites += 1;
  }

  return {
    items,
    stats: {
      files: files.length,
      rows: raw.length,
      items: items.length,
      movies,
      series,
      rated,
      watched,
      watchlist,
      favorites,
      ratingScale: scale,
    },
  };
}

/**
 * Decides which of an archive's entries matter for a source, and what each
 * one implies. Names that match no rule are dropped, which is what keeps
 * Letterboxd's comments.csv and profile.csv out of the pipeline.
 */
export function selectFiles(sourceId, entries) {
  const source = getSource(sourceId);
  if (!source) throw new Error(`Unknown import source: ${sourceId}`);
  const rules = source.files || [];
  const selected = [];

  for (const entry of entries) {
    for (const rule of rules) {
      if (rule.match.test(entry.name)) {
        selected.push({ ...entry, flags: rule.flags || {}, kind: rule.kind });
        break;
      }
    }
  }

  return selected;
}
