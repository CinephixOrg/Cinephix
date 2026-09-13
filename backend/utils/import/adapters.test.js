import test from "node:test";
import assert from "node:assert/strict";
import { normalizeFiles, selectFiles, flattenRow, toArray } from "./adapters.js";
import { SOURCES, getSource, resolveMap } from "./sources.js";

// Runs the real flow: pick the files a source cares about, then normalize.
const run = (sourceId, files) => normalizeFiles(sourceId, selectFiles(sourceId, files));
const find = (items, title) => items.find((i) => i.title === title);

// ---------------------------------------------------------------------------
// Letterboxd
// ---------------------------------------------------------------------------

const LETTERBOXD = [
  { name: "watched.csv", text: "Date,Name,Year,Letterboxd URI\n2024-01-02,Dune,2021,x\n2024-01-03,Amélie,2001,y\n" },
  { name: "ratings.csv", text: "Date,Name,Year,Letterboxd URI,Rating\n2024-01-02,Dune,2021,x,4.5\n" },
  { name: "watchlist.csv", text: "Date,Name,Year,Letterboxd URI\n2024-02-01,Sicario,2015,z\n" },
  { name: "likes/films.csv", text: "Date,Name,Year,Letterboxd URI\n2024-01-05,Dune,2021,x\n" },
  { name: "comments.csv", text: "Date,Comment\n2024-01-01,ignored\n" },
  { name: "profile.csv", text: "Username\nsomeone\n" },
];

test("letterboxd: merges one film across watched, ratings and likes", () => {
  const { items } = run("letterboxd", LETTERBOXD);
  const dune = find(items, "Dune");
  assert.ok(dune);
  assert.equal(dune.watched, true);
  assert.equal(dune.favorite, true);
  assert.equal(dune.rating, 9); // 4.5 of 5 stars
  assert.equal(dune.year, 2021);
  assert.equal(dune.type, "movie");
});

test("letterboxd: watchlist entries stay unwatched", () => {
  const { items } = run("letterboxd", LETTERBOXD);
  const sicario = find(items, "Sicario");
  assert.equal(sicario.watchlist, true);
  assert.equal(sicario.watched, false);
});

test("letterboxd: ignores files that are not part of the library", () => {
  const selected = selectFiles("letterboxd", LETTERBOXD).map((f) => f.name);
  assert.ok(!selected.includes("comments.csv"));
  assert.ok(!selected.includes("profile.csv"));
  assert.equal(selected.length, 4);
});

test("letterboxd: three files, three titles, no duplicates", () => {
  const { items, stats } = run("letterboxd", LETTERBOXD);
  assert.equal(items.length, 3);
  assert.equal(stats.rows, 5); // 2 watched + 1 rating + 1 watchlist + 1 like
  assert.equal(stats.ratingScale, 5);
});

// ---------------------------------------------------------------------------
// TV Time
// ---------------------------------------------------------------------------

const TVTIME = [
  {
    name: "movies.json",
    text: JSON.stringify([
      { id: { tvdb: 1234, imdb: "tt1160419" }, title: "Dune", is_watched: true, watched_at: "2024-01-02", rating: 9 },
      { id: { tvdb: 5678, imdb: "-1" }, title: "Sicario", is_watched: false },
    ]),
  },
  {
    name: "shows.json",
    text: JSON.stringify([
      {
        id: { tvdb: 121361 },
        name: "Game of Thrones",
        seasons: [
          { episodes: [{ is_watched: true, watched_at: "2023-05-01", rating: 8 }, { is_watched: true, watched_at: "2023-04-01", rating: 10 }] },
          { episodes: [{ is_watched: false, rating: 0 }] },
        ],
      },
    ]),
  },
];

test("tvtime: counts watched episodes and averages episode ratings", () => {
  const { items } = run("tvtime", TVTIME);
  const got = find(items, "Game of Thrones");
  assert.equal(got.type, "series");
  assert.equal(got.episodes, 2);
  assert.equal(got.watched, true);
  assert.equal(got.rating, 9); // mean of 8 and 10
  assert.equal(got.watchedAt.getUTCMonth(), 3); // April, the earliest
});

test("tvtime: an unwatched movie is the watchlist", () => {
  const { items } = run("tvtime", TVTIME);
  assert.equal(find(items, "Sicario").watchlist, true);
  assert.equal(find(items, "Dune").watchlist, false);
});

test("tvtime: drops the -1 placeholder imdb id", () => {
  const { items } = run("tvtime", TVTIME);
  assert.equal(find(items, "Sicario").ids.imdb, undefined);
  assert.equal(find(items, "Sicario").ids.tvdb, 5678);
  assert.equal(find(items, "Dune").ids.imdb, "tt1160419");
});

// ---------------------------------------------------------------------------
// Trakt
// ---------------------------------------------------------------------------

const TRAKT = [
  {
    name: "watched_movies.json",
    text: JSON.stringify([
      { plays: 2, last_watched_at: "2024-03-01T00:00:00Z", movie: { title: "Dune", year: 2021, ids: { trakt: 1, imdb: "tt1160419", tmdb: 438631 } } },
    ]),
  },
  {
    name: "watched_shows.json",
    text: JSON.stringify([
      {
        show: { title: "Severance", year: 2022, ids: { trakt: 9, tvdb: 371980 } },
        seasons: [{ number: 1, episodes: [{ number: 1, plays: 1, last_watched_at: "2024-02-02T00:00:00Z" }, { number: 2, plays: 1 }] }],
      },
    ]),
  },
  { name: "watchlist_movies.json", text: JSON.stringify([{ movie: { title: "Sicario", year: 2015, ids: { trakt: 3 } } }]) },
];

test("trakt: unwraps the movie/show wrapper and its nested ids", () => {
  const { items } = run("trakt", TRAKT);
  const dune = find(items, "Dune");
  assert.equal(dune.type, "movie");
  assert.equal(dune.watched, true);
  assert.deepEqual(dune.ids, { imdb: "tt1160419", tmdb: 438631, trakt: 1 });
});

test("trakt: counts played episodes on a show", () => {
  const { items } = run("trakt", TRAKT);
  const severance = find(items, "Severance");
  assert.equal(severance.type, "series");
  assert.equal(severance.episodes, 2);
  assert.equal(severance.watched, true);
});

test("trakt: watchlist file marks items unwatched", () => {
  const { items } = run("trakt", TRAKT);
  assert.equal(find(items, "Sicario").watchlist, true);
  assert.equal(find(items, "Sicario").watched, false);
});

// ---------------------------------------------------------------------------
// IMDb
// ---------------------------------------------------------------------------

const IMDB_RATINGS = [
  {
    name: "ratings.csv",
    text: [
      "Const,Your Rating,Date Rated,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors",
      'tt0111161,10,2024-01-02,The Shawshank Redemption,The Shawshank Redemption,http://x,movie,9.3,142,1994,Drama,2000000,1994-10-14,Frank Darabont',
      'tt0944947,9,2024-01-03,Game of Thrones,Game of Thrones,http://y,tvSeries,9.2,60,2011,"Action, Adventure",2000000,2011-04-17,',
    ].join("\n"),
  },
];

test("imdb: reads the Const id, 10-point rating and title type", () => {
  const { items } = run("imdb", IMDB_RATINGS);
  const shawshank = find(items, "The Shawshank Redemption");
  assert.equal(shawshank.ids.imdb, "tt0111161");
  assert.equal(shawshank.rating, 10);
  assert.equal(shawshank.type, "movie");
  assert.equal(shawshank.year, 1994);
  assert.equal(shawshank.watched, true);
});

test("imdb: tvSeries rows become series, not movies", () => {
  const { items } = run("imdb", IMDB_RATINGS);
  assert.equal(find(items, "Game of Thrones").type, "series");
});

test("imdb: a watchlist.csv is a watchlist, not a watch history", () => {
  const { items } = run("imdb", [
    { name: "watchlist.csv", text: "Position,Const,Title,Title Type,Year\n1,tt1160419,Dune,movie,2021\n" },
  ]);
  assert.equal(items[0].watchlist, true);
  assert.equal(items[0].watched, false);
});

// ---------------------------------------------------------------------------
// Simkl
// ---------------------------------------------------------------------------

test("simkl: reads its multi-provider id columns", () => {
  const { items } = run("simkl", [
    {
      name: "SimklBackup.csv",
      text: [
        "SIMKL_ID,Type,Title,Year,Watchlist,LastEpWatched,WatchedDate,Rating,TVDB,TMDB,IMDB,MAL,AniList",
        "1234,movie,Dune,2021,completed,,2024-01-02,9,,438631,tt1160419,,",
        "5678,tv,Severance,2022,plantowatch,,,,371980,,,,",
      ].join("\n"),
    },
  ]);
  const dune = find(items, "Dune");
  assert.equal(dune.ids.simkl, 1234);
  assert.equal(dune.ids.imdb, "tt1160419");
  assert.equal(dune.ids.tmdb, 438631);
  assert.equal(dune.rating, 9);
  assert.equal(dune.watched, true);
  assert.equal(find(items, "Severance").type, "series");
});

// ---------------------------------------------------------------------------
// Plex / Jellyfin / Kodi
// ---------------------------------------------------------------------------

test("plex: view count means watched", () => {
  const { items } = run("plex", [
    { name: "plex.csv", text: "Title,Year,Type,User Rating,View Count,Last Viewed At\nDune,2021,movie,8,2,2024-01-02\nSicario,2015,movie,,0,\n" },
  ]);
  assert.equal(find(items, "Dune").watched, true);
  assert.equal(find(items, "Dune").rating, 8);
  assert.equal(find(items, "Sicario").watched, false);
});

test("jellyfin: reads nested ProviderIds from JSON via dotted paths", () => {
  const { items } = run("jellyfin", [
    {
      name: "library.json",
      text: JSON.stringify([
        { Name: "Dune", ProductionYear: 2021, Type: "Movie", UserRating: 9, Played: true, ProviderIds: { Imdb: "tt1160419", Tmdb: "438631" } },
      ]),
    },
  ]);
  assert.equal(items[0].ids.imdb, "tt1160419");
  assert.equal(items[0].ids.tmdb, 438631);
  assert.equal(items[0].watched, true);
});

test("kodi: semicolon-delimited export with playcount", () => {
  const { items } = run("kodi", [
    { name: "kodi.csv", text: "title;year;type;userrating;playcount;imdbnumber\nThing, The;1982;movie;9;1;tt0084787\n" },
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].watched, true);
  assert.equal(items[0].ids.imdb, "tt0084787");
  assert.equal(items[0].rating, 9);
});

// ---------------------------------------------------------------------------
// MyAnimeList
// ---------------------------------------------------------------------------

const MAL_XML = `<?xml version="1.0" encoding="UTF-8" ?>
<myanimelist>
  <myinfo><user_name>someone</user_name></myinfo>
  <anime>
    <series_animedb_id>1535</series_animedb_id>
    <series_title><![CDATA[Death Note]]></series_title>
    <series_type>TV</series_type>
    <my_watched_episodes>37</my_watched_episodes>
    <my_score>9</my_score>
    <my_status>Completed</my_status>
    <my_start_date>2023-01-01</my_start_date>
    <my_finish_date>2023-02-01</my_finish_date>
  </anime>
  <anime>
    <series_animedb_id>5114</series_animedb_id>
    <series_title><![CDATA[Fullmetal Alchemist: Brotherhood]]></series_title>
    <series_type>TV</series_type>
    <my_watched_episodes>0</my_watched_episodes>
    <my_score>0</my_score>
    <my_status>Plan to Watch</my_status>
    <my_finish_date>0000-00-00</my_finish_date>
  </anime>
</myanimelist>`;

test("mal: reads CDATA titles, scores and watched episodes", () => {
  const { items } = run("myanimelist", [{ name: "animelist.xml", text: MAL_XML }]);
  const deathNote = find(items, "Death Note");
  assert.equal(deathNote.ids.mal, 1535);
  assert.equal(deathNote.rating, 9);
  assert.equal(deathNote.episodes, 37);
  assert.equal(deathNote.watched, true);
  assert.equal(deathNote.type, "series");
});

test("mal: Plan to Watch is a watchlist entry with no rating", () => {
  const { items } = run("myanimelist", [{ name: "animelist.xml", text: MAL_XML }]);
  const fmab = find(items, "Fullmetal Alchemist: Brotherhood");
  assert.equal(fmab.watchlist, true);
  assert.equal(fmab.watched, false);
  assert.equal(fmab.rating, null);
});

test("mal: 0000-00-00 does not become a real date", () => {
  const { items } = run("myanimelist", [{ name: "animelist.xml", text: MAL_XML }]);
  assert.equal(find(items, "Fullmetal Alchemist: Brotherhood").watchedAt, null);
});

// ---------------------------------------------------------------------------
// AniList / Kitsu
// ---------------------------------------------------------------------------

test("anilist: infers a /100 scale and prefers the English title", () => {
  const { items, stats } = run("anilist", [
    {
      name: "anilist.json",
      text: JSON.stringify({
        lists: [
          { status: "COMPLETED", score: 87, progress: 24, media: { id: 21, idMal: 21, title: { romaji: "ONE PIECE", english: "One Piece" }, format: "TV", startDate: { year: 1999 } } },
          { status: "PLANNING", score: 0, progress: 0, media: { id: 5114, title: { romaji: "Hagane no Renkinjutsushi" }, format: "TV", startDate: { year: 2009 } } },
        ],
      }),
    },
  ]);
  assert.equal(stats.ratingScale, 100);
  const onePiece = find(items, "One Piece");
  assert.equal(onePiece.rating, 9);
  assert.equal(onePiece.ids.anilist, 21);
  assert.equal(onePiece.ids.mal, 21);
  assert.equal(onePiece.watched, true);
  assert.equal(find(items, "Hagane no Renkinjutsushi").watchlist, true);
});

test("anilist: an anime film is typed as a movie", () => {
  const { items } = run("anilist", [
    { name: "a.json", text: JSON.stringify([{ status: "COMPLETED", score: 90, media: { id: 199, title: { english: "Spirited Away" }, format: "MOVIE", startDate: { year: 2001 } } }]) },
  ]);
  assert.equal(items[0].type, "movie");
});

test("kitsu: converts its /20 rating scale", () => {
  const { items } = run("kitsu", [
    {
      name: "kitsu.json",
      text: JSON.stringify([
        { attributes: { status: "completed", progress: 12, ratingTwenty: 14, finishedAt: "2024-01-02" }, media: { id: 7442, titles: { en: "Attack on Titan" } } },
      ]),
    },
  ]);
  assert.equal(items[0].title, "Attack on Titan");
  assert.equal(items[0].rating, 7); // 14/20
  assert.equal(items[0].episodes, 12);
  assert.equal(items[0].watched, true);
});

// ---------------------------------------------------------------------------
// Generic
// ---------------------------------------------------------------------------

test("generic: works off nothing but ordinary column names", () => {
  const { items } = run("generic", [
    { name: "mylist.csv", text: "Title,Year,Type,Rating,Watched\nDune,2021,movie,8,yes\nSeverance,2022,series,9,no\n" },
  ]);
  assert.equal(items.length, 2);
  assert.equal(find(items, "Dune").watched, true);
  assert.equal(find(items, "Severance").watched, false);
  assert.equal(find(items, "Severance").type, "series");
});

test("generic: accepts a JSON array just as readily as a CSV", () => {
  const { items } = run("generic", [
    { name: "mylist.json", text: JSON.stringify([{ title: "Dune", year: 2021, rating: 8, watched: true }]) },
  ]);
  assert.equal(items[0].title, "Dune");
  assert.equal(items[0].rating, 8);
});

test("generic: infers a 5-star scale from half-star values", () => {
  const { stats } = run("generic", [
    { name: "x.csv", text: "Title,Rating\nA,4.5\nB,3\nC,5\n" },
  ]);
  assert.equal(stats.ratingScale, 5);
});

// ---------------------------------------------------------------------------
// Cross-cutting
// ---------------------------------------------------------------------------

test("every declared source is reachable and normalizes an empty upload", () => {
  for (const source of SOURCES) {
    const { items, stats } = normalizeFiles(source.id, []);
    assert.deepEqual(items, [], `${source.id} should yield no items`);
    assert.equal(stats.items, 0);
  }
});

test("every source profile resolves to a usable column map", () => {
  for (const source of SOURCES) {
    const map = resolveMap(source);
    assert.ok(map.title.length > 0, `${source.id} has title candidates`);
    assert.ok(map.ids.imdb.length > 0, `${source.id} has imdb candidates`);
    assert.ok(["movie", "series"].includes(map.defaultType));
  }
});

test("an unknown source is rejected rather than silently importing nothing", () => {
  assert.throws(() => normalizeFiles("myspace", []), /Unknown import source/);
  assert.equal(getSource("MYSPACE"), undefined);
});

test("malformed JSON yields no items instead of throwing", () => {
  const { items } = run("generic", [{ name: "broken.json", text: "{not json" }]);
  assert.deepEqual(items, []);
});

test("a file with no recognisable columns yields no items", () => {
  const { items } = run("generic", [{ name: "x.csv", text: "alpha,beta\n1,2\n" }]);
  assert.deepEqual(items, []);
});

test("misnamed files are sniffed by content rather than failing", () => {
  const { items } = run("generic", [
    { name: "export.csv", text: JSON.stringify([{ title: "Dune", year: 2021 }]) },
  ]);
  assert.equal(items[0]?.title, "Dune");
});

test("stats describe the import truthfully", () => {
  const { stats } = run("letterboxd", LETTERBOXD);
  assert.equal(stats.items, 3);
  assert.equal(stats.movies, 3);
  assert.equal(stats.series, 0);
  assert.equal(stats.rated, 1);
  assert.equal(stats.favorites, 1);
  assert.equal(stats.watchlist, 1);
});

test("flattenRow exposes nested objects as dotted keys", () => {
  assert.deepEqual(flattenRow({ a: 1, b: { c: 2, d: { e: 3 } } }), { a: 1, "b.c": 2, "b.d.e": 3 });
});

test("toArray finds the list wherever an exporter put it", () => {
  assert.deepEqual(toArray([1, 2]), [1, 2]);
  assert.deepEqual(toArray({ items: [1] }), [1]);
  assert.deepEqual(toArray({ data: [2] }), [2]);
  assert.deepEqual(toArray(null), []);
});
