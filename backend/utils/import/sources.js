// The source catalogue.
//
// Adding a platform means adding an entry here — not a new controller, route,
// parser or screen. That is the whole point of the generic pipeline: the
// per-platform knowledge is data, and the code that consumes it is written
// once.
//
// A profile declares:
//   accepts   file extensions the picker will allow
//   kinds     whether this source can carry movies, series, or both
//   files     for archives: which entries matter and what each one implies
//   map       where each normalized field lives in a row
//   adapter   "profile" for anything column-shaped; a named adapter for the
//             handful of formats that are structurally nested instead
//
// Column candidates are matched case- and punctuation-insensitively (see
// normalize.buildHeaderIndex), so "Your Rating", "your_rating" and
// "YOUR RATING" all resolve to the same column without being listed thrice.

import { foldCandidates } from "./normalize.js";

// Column names common enough to be worth trying on every source. A specific
// profile's own candidates are tried first; these catch the rest, and are
// what make the Generic CSV option work on a file nobody has seen before.
const COMMON = {
  title: ["Title", "Name", "Series Title", "Movie", "Film", "series_title", "Show"],
  originalTitle: ["Original Title", "Original Name", "originalTitle"],
  year: ["Year", "Release Year", "Release Date", "First Aired", "Premiered", "startDate"],
  type: ["Type", "Title Type", "Media Type", "Content Type", "Category", "format"],
  rating: ["Rating", "Your Rating", "My Rating", "User Rating", "Score", "my_score", "userRating"],
  watched: ["Watched", "Is Watched", "Seen", "Play Count", "Playcount", "Plays", "is_watched"],
  watchlist: ["Watchlist", "In Watchlist", "Plan To Watch", "Want To Watch"],
  // A single column carrying the library state as a word. When one is
  // present and recognised it is authoritative, because the same column
  // would otherwise also be read as a boolean and set both flags at once.
  status: ["Status", "My Status", "Watch Status", "my_status", "State"],
  // Columns where merely having a value means the thing was watched.
  watchedIfPresent: [
    "Watched Date", "Date Watched", "WatchedDate", "Last Watched",
    "Last Played", "Last Viewed At", "lastplayed", "last_watched_at",
  ],
  favorite: ["Favorite", "Favourite", "Liked", "Is Favorite"],
  watchedAt: [
    "Watched Date", "Date Watched", "Last Watched", "Last Played", "Last Viewed At",
    "Date Rated", "Date", "WatchedDate", "last_watched_at", "my_finish_date",
  ],
  episodes: ["Episodes Watched", "Watched Episodes", "LastEpWatched", "Progress", "my_watched_episodes"],
  ids: {
    imdb: ["IMDB", "IMDb ID", "Const", "imdb_id", "imdbId"],
    tmdb: ["TMDB", "TMDb ID", "tmdb_id", "tmdbId"],
    tvdb: ["TVDB", "TVDb ID", "tvdb_id", "tvdbId"],
    mal: ["MAL", "MAL ID", "series_animedb_id", "malId", "idMal"],
    anilist: ["AniList", "AniList ID", "anilist_id"],
    kitsu: ["Kitsu", "Kitsu ID", "kitsu_id"],
    trakt: ["Trakt", "Trakt ID", "trakt_id"],
    simkl: ["Simkl", "SIMKL_ID", "Simkl ID", "simkl_id"],
  },
};

export const SOURCES = [
  {
    id: "letterboxd",
    label: "Letterboxd",
    accepts: [".zip", ".csv"],
    kinds: ["movie"],
    ratingScale: 5,
    adapter: "profile",
    // Letterboxd splits one film across several CSVs; each contributes a
    // different flag and the normalizer merges them back into one item.
    files: [
      { match: /(^|\/)watched\.csv$/i, flags: { watched: true } },
      { match: /(^|\/)diary\.csv$/i, flags: { watched: true } },
      { match: /(^|\/)ratings\.csv$/i, flags: { watched: true } },
      { match: /(^|\/)watchlist\.csv$/i, flags: { watchlist: true } },
      { match: /likes[/\\]films\.csv$/i, flags: { favorite: true } },
    ],
    map: {
      title: ["Name"],
      year: ["Year"],
      rating: ["Rating"],
      watchedAt: ["Watched Date", "Date"],
      defaultType: "movie",
    },
  },
  {
    id: "tvtime",
    label: "TV Time",
    accepts: [".zip", ".json", ".csv"],
    kinds: ["movie", "series"],
    ratingScale: 10,
    // shows.json nests seasons inside shows and episodes inside seasons —
    // no column mapping can express that, so it gets a real adapter.
    adapter: "tvtime",
    files: [
      { match: /(^|\/)movies\.json$/i, kind: "movies" },
      { match: /(^|\/)shows\.json$/i, kind: "shows" },
      { match: /(^|\/)tv-?shows\.json$/i, kind: "shows" },
    ],
    map: { defaultType: "series" },
  },
  {
    id: "trakt",
    label: "Trakt",
    accepts: [".zip", ".json", ".csv"],
    kinds: ["movie", "series"],
    ratingScale: 10,
    // Every Trakt payload wraps the real record in a `movie`/`show` key and
    // carries its ids in a nested `ids` object.
    adapter: "trakt",
    files: [
      { match: /watched[_-]?movies?\.json$/i, kind: "movies", flags: { watched: true } },
      { match: /watched[_-]?shows?\.json$/i, kind: "shows", flags: { watched: true } },
      { match: /ratings?[_-]?movies?\.json$/i, kind: "movies", flags: { watched: true } },
      { match: /ratings?[_-]?shows?\.json$/i, kind: "shows", flags: { watched: true } },
      { match: /watchlist[_-]?movies?\.json$/i, kind: "movies", flags: { watchlist: true } },
      { match: /watchlist[_-]?shows?\.json$/i, kind: "shows", flags: { watchlist: true } },
      { match: /(^|\/)history\.json$/i, kind: "mixed", flags: { watched: true } },
      { match: /(^|\/)ratings\.json$/i, kind: "mixed", flags: { watched: true } },
      { match: /(^|\/)watchlist\.json$/i, kind: "mixed", flags: { watchlist: true } },
      { match: /\.csv$/i, kind: "csv" },
    ],
    map: { defaultType: "movie" },
  },
  {
    id: "imdb",
    label: "IMDb",
    accepts: [".csv", ".zip"],
    kinds: ["movie", "series"],
    ratingScale: 10,
    adapter: "profile",
    files: [
      { match: /ratings\.csv$/i, flags: { watched: true } },
      { match: /watchlist\.csv$/i, flags: { watchlist: true } },
      // Any other CSV in an IMDb export is a custom list.
      { match: /\.csv$/i, flags: { watchlist: true } },
    ],
    map: {
      title: ["Title", "Original Title"],
      year: ["Year", "Release Date"],
      rating: ["Your Rating"],
      type: ["Title Type"],
      watchedAt: ["Date Rated"],
      ids: { imdb: ["Const"] },
      defaultType: "movie",
    },
  },
  {
    id: "simkl",
    label: "Simkl",
    accepts: [".csv", ".json", ".zip"],
    kinds: ["movie", "series"],
    ratingScale: 10,
    adapter: "profile",
    files: [{ match: /\.(csv|json)$/i, flags: {} }],
    map: {
      title: ["Title"],
      year: ["Year"],
      rating: ["Rating"],
      type: ["Type"],
      status: ["Watchlist"],
      watchedIfPresent: ["WatchedDate"],
      watchedAt: ["WatchedDate", "LastWatched"],
      episodes: ["LastEpWatched"],
      ids: {
        simkl: ["SIMKL_ID", "SimklID"],
        imdb: ["IMDB"],
        tmdb: ["TMDB"],
        tvdb: ["TVDB"],
        mal: ["MAL"],
        anilist: ["AniList"],
      },
      defaultType: "movie",
    },
  },
  {
    id: "plex",
    label: "Plex",
    accepts: [".csv", ".json", ".zip"],
    kinds: ["movie", "series"],
    ratingScale: 10,
    adapter: "profile",
    files: [{ match: /\.(csv|json)$/i, flags: {} }],
    // Plex has no single official export; these are the column names its
    // common export tools emit. Anything else falls through to COMMON.
    map: {
      title: ["Title", "Sort Title"],
      year: ["Year"],
      type: ["Type", "Library Type"],
      rating: ["User Rating", "Rating"],
      watched: ["View Count", "Play Count", "Watched"],
      watchedAt: ["Last Viewed At", "Last Played"],
      ids: { imdb: ["IMDB"], tmdb: ["TMDB"], tvdb: ["TVDB"] },
      defaultType: "movie",
    },
  },
  {
    id: "jellyfin",
    label: "Jellyfin",
    accepts: [".csv", ".json", ".zip"],
    kinds: ["movie", "series"],
    ratingScale: 10,
    adapter: "profile",
    files: [{ match: /\.(csv|json)$/i, flags: {} }],
    map: {
      title: ["Name", "Title"],
      year: ["ProductionYear", "Year"],
      type: ["Type", "ItemType"],
      rating: ["UserRating", "CommunityRating", "Rating"],
      watched: ["Played", "PlayCount", "IsPlayed"],
      watchedAt: ["LastPlayedDate", "DatePlayed", "DateCreated"],
      ids: {
        imdb: ["Imdb", "ProviderIds.Imdb"],
        tmdb: ["Tmdb", "ProviderIds.Tmdb"],
        tvdb: ["Tvdb", "ProviderIds.Tvdb"],
      },
      defaultType: "movie",
    },
  },
  {
    id: "kodi",
    label: "Kodi",
    accepts: [".csv", ".json", ".zip"],
    kinds: ["movie", "series"],
    ratingScale: 10,
    adapter: "profile",
    files: [{ match: /\.(csv|json)$/i, flags: {} }],
    map: {
      title: ["title", "label", "originaltitle"],
      year: ["year", "premiered"],
      type: ["type", "mediatype"],
      rating: ["userrating", "rating"],
      watched: ["playcount"],
      watchedAt: ["lastplayed"],
      ids: { imdb: ["imdbnumber", "uniqueid.imdb"], tmdb: ["uniqueid.tmdb"], tvdb: ["uniqueid.tvdb"] },
      defaultType: "movie",
    },
  },
  {
    id: "myanimelist",
    label: "MyAnimeList",
    accepts: [".xml", ".gz", ".zip", ".csv"],
    kinds: ["series"],
    ratingScale: 10,
    // MAL exports gzipped XML, which is neither CSV nor JSON.
    adapter: "mal",
    files: [{ match: /\.(xml|gz|csv)$/i, flags: {} }],
    map: { defaultType: "series" },
  },
  {
    id: "anilist",
    label: "AniList",
    accepts: [".json", ".zip", ".csv"],
    kinds: ["series"],
    // AniList lets each user pick their scoring scale, so it is inferred
    // from the data rather than declared here.
    ratingScale: null,
    adapter: "anilist",
    files: [{ match: /\.(json|csv)$/i, flags: {} }],
    map: { defaultType: "series" },
  },
  {
    id: "kitsu",
    label: "Kitsu",
    accepts: [".json", ".csv", ".zip"],
    kinds: ["series"],
    // Kitsu's own library export scores out of 20 (its half-star UI over 10).
    ratingScale: 20,
    adapter: "kitsu",
    files: [{ match: /\.(json|csv)$/i, flags: {} }],
    map: { defaultType: "series" },
  },
  {
    id: "generic",
    label: "Generic CSV / JSON",
    accepts: [".csv", ".json", ".zip"],
    kinds: ["movie", "series"],
    // Nothing is known about the file, so the scale is inferred from the
    // values actually present.
    ratingScale: null,
    adapter: "profile",
    files: [{ match: /\.(csv|json)$/i, flags: {} }],
    map: { defaultType: "movie" },
  },
];

const BY_ID = new Map(SOURCES.map((source) => [source.id, source]));

export function getSource(id) {
  return BY_ID.get(String(id || "").toLowerCase());
}

export function isSupportedSource(id) {
  return BY_ID.has(String(id || "").toLowerCase());
}

// Merges a profile's own column candidates with the common ones, specific
// first. Built per import, not per row.
export function resolveMap(source) {
  const map = source.map || {};
  const ids = {};
  for (const key of Object.keys(COMMON.ids)) {
    ids[key] = foldCandidates([...(map.ids?.[key] || []), ...COMMON.ids[key]]);
  }
  return {
    title: foldCandidates([...(map.title || []), ...COMMON.title]),
    originalTitle: foldCandidates([...(map.originalTitle || []), ...COMMON.originalTitle]),
    year: foldCandidates([...(map.year || []), ...COMMON.year]),
    type: foldCandidates([...(map.type || []), ...COMMON.type]),
    rating: foldCandidates([...(map.rating || []), ...COMMON.rating]),
    watched: foldCandidates([...(map.watched || []), ...COMMON.watched]),
    watchlist: foldCandidates([...(map.watchlist || []), ...COMMON.watchlist]),
    favorite: foldCandidates([...(map.favorite || []), ...COMMON.favorite]),
    watchedAt: foldCandidates([...(map.watchedAt || []), ...COMMON.watchedAt]),
    status: foldCandidates([...(map.status || []), ...COMMON.status]),
    watchedIfPresent: foldCandidates([...(map.watchedIfPresent || []), ...COMMON.watchedIfPresent]),
    episodes: foldCandidates([...(map.episodes || []), ...COMMON.episodes]),
    ids,
    defaultType: map.defaultType || "movie",
  };
}

// The catalogue the mobile client renders. Kept free of regexes and column
// lists — the client only needs identity and what the file picker should
// allow.
export const SOURCE_CATALOG = SOURCES.map(({ id, label, accepts, kinds }) => ({
  id,
  label,
  accepts,
  kinds,
}));
