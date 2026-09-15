import test from "node:test";
import assert from "node:assert/strict";
import {
  findLegacyTwin,
  metadataFromTmdb,
  planCatalogWrites,
  readTmdbId,
} from "./catalogUpsert.js";

const NOW = new Date("2026-09-14T10:00:00Z");
let idCounter = 0;
const createId = () => `new-${++idCounter}`;
const plan = (overrides) =>
  planCatalogWrites({ existingByTmdb: new Map(), legacyCandidates: [], now: NOW, createId, ...overrides });

// The pair from the bug report, as the database actually holds them.
const TRUMAN_LEGACY = {
  _id: "68ed03ce505e6ffb3b237290",
  title: "The Truman Show",
  release_date: "1998-06-04",
  poster_path: "/legacy-poster.jpg",
  overview: "Legacy overview.",
  genre_ids: [35, 18],
  original_language: "en",
};
const TRUMAN_HIT = {
  id: 37165,
  title: "The Truman Show",
  original_title: "The Truman Show",
  release_date: "1998-06-04",
  poster_path: "/tmdb-poster.jpg",
  backdrop_path: "/tmdb-backdrop.jpg",
  overview: "TMDB overview.",
  vote_average: 8.1,
  vote_count: 20000,
  popularity: 42,
  genre_ids: [35, 18],
};

test("reads a TMDB id from every shape the catalogue uses", () => {
  assert.equal(readTmdbId({ id: { tmdb: 37165 } }), 37165);
  assert.equal(readTmdbId({ tmdb_id: 37165 }), 37165);
  assert.equal(readTmdbId({ tmdb: "37165" }), 37165);
  assert.equal(readTmdbId(TRUMAN_LEGACY), null);
  assert.equal(readTmdbId({ tmdb_id: -1 }), null);
});

test("metadata drops blank fields and maps series names", () => {
  const movie = metadataFromTmdb({ title: "X", overview: "", poster_path: null, genre_ids: [] }, "movie");
  assert.deepEqual(movie, { title: "X", type: "movie" });
  const series = metadataFromTmdb({ name: "Silo", first_air_date: "2023-05-04" }, "series");
  assert.equal(series.name, "Silo");
  assert.equal(series.title, "Silo");
  assert.equal(series.first_air_date, "2023-05-04");
});

test("the reported duplicate: the legacy document is enriched, nothing is created", () => {
  const { ops, resolved } = plan({ type: "movie", hits: [TRUMAN_HIT], legacyCandidates: [TRUMAN_LEGACY] });

  assert.deepEqual(resolved.get(37165), { _id: TRUMAN_LEGACY._id, via: "legacy" });
  assert.equal(ops.length, 1);
  assert.ok(ops[0].updateOne, "an update, not an insert");
  assert.equal(ops.some((op) => op.insertOne), false);

  const { filter, update } = ops[0].updateOne;
  assert.equal(filter._id, TRUMAN_LEGACY._id);
  const set = update.$set;
  assert.equal(set.tmdb_id, 37165);
  assert.equal(set["id.tmdb"], 37165);
  // Filled because the legacy document lacked them:
  assert.equal(set.backdrop_path, "/tmdb-backdrop.jpg");
  assert.equal(set.original_title, "The Truman Show");
  assert.equal(set.type, "movie");
  // Never overwritten, because the legacy document already had them:
  assert.equal("poster_path" in set, false);
  assert.equal("overview" in set, false);
  assert.equal("title" in set, false);
  assert.equal("genre_ids" in set, false);
});

test("the enrichment write re-checks at write time that no TMDB id was added meanwhile", () => {
  const { ops } = plan({ type: "movie", hits: [TRUMAN_HIT], legacyCandidates: [TRUMAN_LEGACY] });
  const guards = ops[0].updateOne.filter.$and;
  assert.deepEqual(guards, [{ "id.tmdb": { $exists: false } }, { tmdb_id: { $exists: false } }, { tmdb: { $exists: false } }]);
});

test("a document already carrying the TMDB id wins, and is left alone without refresh fields", () => {
  const rich = { _id: "rich-1", tmdb_id: 37165, title: "The Truman Show", release_date: "1998-06-04" };
  const { ops, resolved } = plan({
    type: "movie",
    hits: [TRUMAN_HIT],
    existingByTmdb: new Map([[37165, rich]]),
    legacyCandidates: [TRUMAN_LEGACY],
  });
  assert.deepEqual(resolved.get(37165), { _id: "rich-1", via: "tmdb" });
  assert.equal(ops.length, 0);
});

test("refresh fields are the only thing overwritten on an existing document", () => {
  const rich = { _id: "rich-1", tmdb_id: 37165 };
  const { ops } = plan({
    type: "movie",
    hits: [TRUMAN_HIT],
    existingByTmdb: new Map([[37165, rich]]),
    refreshFields: ["popularity", "vote_count"],
  });
  assert.deepEqual(ops[0].updateOne.update.$set, { popularity: 42, vote_count: 20000, updated_at: NOW });
});

test("with no twin at all, a complete new document is created", () => {
  const { ops, resolved } = plan({ type: "movie", hits: [TRUMAN_HIT] });
  const entry = resolved.get(37165);
  assert.equal(entry.via, "created");
  const doc = ops[0].insertOne.document;
  assert.equal(doc._id, entry._id);
  assert.deepEqual(doc.id, { tmdb: 37165 });
  assert.equal(doc.tmdb_id, 37165);
  assert.equal(doc.title, "The Truman Show");
  assert.equal(doc.updated_at, NOW);
});

test("a release date off by days in the same year still finds a single legacy twin", () => {
  const legacy = { ...TRUMAN_LEGACY, release_date: "1998-06-01" };
  assert.equal(findLegacyTwin([legacy], metadataFromTmdb(TRUMAN_HIT, "movie"), "movie")?._id, legacy._id);
});

test("two same-title legacy films in the same year but different dates are refused", () => {
  const a = { _id: "a", title: "Twin Film", release_date: "2001-02-01" };
  const b = { _id: "b", title: "Twin Film", release_date: "2001-11-01" };
  const meta = metadataFromTmdb({ id: 1, title: "Twin Film", release_date: "2001-06-01" }, "movie");
  assert.equal(findLegacyTwin([a, b], meta, "movie"), null);
});

test("a legacy film with the same title but a different year is a different film", () => {
  const remake = { _id: "old", title: "The Truman Show", release_date: "1970-01-01" };
  const { resolved } = plan({ type: "movie", hits: [TRUMAN_HIT], legacyCandidates: [remake] });
  assert.equal(resolved.get(37165).via, "created");
});

test("legacy records duplicated with the same title and date resolve to the oldest", () => {
  const older = { ...TRUMAN_LEGACY, _id: "600000000000000000000001" };
  const newer = { ...TRUMAN_LEGACY, _id: "600000000000000000000002" };
  assert.equal(findLegacyTwin([newer, older], metadataFromTmdb(TRUMAN_HIT, "movie"), "movie")?._id, older._id);
});

test("title comparison ignores case and surrounding whitespace", () => {
  const legacy = { ...TRUMAN_LEGACY, title: "  the truman show " };
  assert.equal(findLegacyTwin([legacy], metadataFromTmdb(TRUMAN_HIT, "movie"), "movie")?._id, legacy._id);
});

test("a candidate that already has a TMDB id is never treated as legacy", () => {
  const enriched = { ...TRUMAN_LEGACY, tmdb_id: 99999 };
  assert.equal(findLegacyTwin([enriched], metadataFromTmdb(TRUMAN_HIT, "movie"), "movie"), null);
});

test("two different TMDB films cannot both claim the same legacy document", () => {
  const second = { ...TRUMAN_HIT, id: 11111 };
  const { resolved } = plan({ type: "movie", hits: [TRUMAN_HIT, second], legacyCandidates: [TRUMAN_LEGACY] });
  assert.equal(resolved.get(37165).via, "legacy");
  assert.equal(resolved.get(11111).via, "created");
});

test("duplicate hits and hits without an id are handled once or skipped", () => {
  const { ops, resolved } = plan({ type: "movie", hits: [TRUMAN_HIT, TRUMAN_HIT, { title: "No id" }, null] });
  assert.equal(resolved.size, 1);
  assert.equal(ops.length, 1);
});

test("series match on name and first_air_date, including legacy series titled in `title`", () => {
  const legacyByName = { _id: "s-legacy", name: "Silo", first_air_date: "2023-05-04" };
  const legacyByTitle = { _id: "s-legacy-2", title: "Severance", first_air_date: "2022-02-18" };
  const { resolved } = plan({
    type: "series",
    hits: [
      { id: 125988, name: "Silo", first_air_date: "2023-05-04" },
      { id: 95396, name: "Severance", first_air_date: "2022-02-18" },
    ],
    legacyCandidates: [legacyByName, legacyByTitle],
  });
  assert.deepEqual(resolved.get(125988), { _id: "s-legacy", via: "legacy" });
  assert.deepEqual(resolved.get(95396), { _id: "s-legacy-2", via: "legacy" });
});

test("a scalar `id` on a legacy document doesn't get a nested id.tmdb written into it", () => {
  const scalar = { ...TRUMAN_LEGACY, id: 37165 };
  const { ops } = plan({ type: "movie", hits: [TRUMAN_HIT], legacyCandidates: [scalar] });
  const set = ops[0].updateOne.update.$set;
  assert.equal(set.tmdb_id, 37165);
  assert.equal("id.tmdb" in set, false);
});

test("an undated TMDB result only matches an undated legacy document", () => {
  const meta = metadataFromTmdb({ id: 5, title: "Mystery" }, "movie");
  assert.equal(findLegacyTwin([{ _id: "d", title: "Mystery", release_date: "1999-01-01" }], meta, "movie"), null);
  assert.equal(findLegacyTwin([{ _id: "u", title: "Mystery" }], meta, "movie")?._id, "u");
});
