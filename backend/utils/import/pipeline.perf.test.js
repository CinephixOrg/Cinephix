import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv } from "./csv.js";
import { normalizeFiles, selectFiles } from "./adapters.js";
import { buildCatalogIndex, matchAll } from "./match.js";

// Speed tests for the three stages that scale with library size.
//
// The thresholds are deliberately loose — several times the measured cost on
// a modest machine — because a perf test that fails on a busy CI box teaches
// people to ignore it. They are here to catch an algorithmic regression (a
// nested scan reintroduced into a matching loop, per-row header folding, a
// stream reinstated over the buffer parser), not to police milliseconds.

const LIBRARY = 20000;
const CATALOG = 40000;

function buildLetterboxdCsv(rows) {
  const out = ["Date,Name,Year,Letterboxd URI,Rating"];
  for (let i = 0; i < rows; i += 1) {
    // A quoted field with an embedded comma on every tenth row, so the
    // quote path is exercised rather than only the fast one.
    const name = i % 10 === 0 ? `"Film ${i}, Part Two"` : `Film ${i}`;
    out.push(`2024-01-02,${name},${1950 + (i % 70)},https://boxd.it/${i},${((i % 10) + 1) / 2}`);
  }
  return out.join("\n");
}

function buildCatalog(count) {
  const docs = new Array(count);
  for (let i = 0; i < count; i += 1) {
    docs[i] = {
      _id: `doc${i}`,
      title: i % 10 === 0 ? `Film ${i}, Part Two` : `Film ${i}`,
      release_date: `${1950 + (i % 70)}-05-01`,
      id: { tmdb: 100000 + i },
    };
  }
  return docs;
}

const elapsed = (fn) => {
  const start = process.hrtime.bigint();
  const value = fn();
  return { value, ms: Number(process.hrtime.bigint() - start) / 1e6 };
};

test(`parses ${LIBRARY} CSV rows well under a second`, () => {
  const csv = buildLetterboxdCsv(LIBRARY);
  const { value: rows, ms } = elapsed(() => parseCsv(csv));
  assert.equal(rows.length, LIBRARY);
  assert.equal(rows[0].Name, "Film 0, Part Two");
  assert.ok(ms < 1000, `parse took ${ms.toFixed(1)}ms`);
  console.log(`    parse:      ${LIBRARY} rows in ${ms.toFixed(1)}ms`);
});

test(`normalizes a ${LIBRARY}-row Letterboxd export well under two seconds`, () => {
  const files = [
    { name: "watched.csv", text: buildLetterboxdCsv(LIBRARY) },
    { name: "ratings.csv", text: buildLetterboxdCsv(LIBRARY) },
  ];
  const { value, ms } = elapsed(() => normalizeFiles("letterboxd", selectFiles("letterboxd", files)));
  // Both files describe the same library, so dedupe must collapse them.
  assert.equal(value.items.length, LIBRARY);
  assert.equal(value.stats.rows, LIBRARY * 2);
  assert.ok(ms < 2000, `normalize took ${ms.toFixed(1)}ms`);
  console.log(`    normalize:  ${LIBRARY * 2} rows -> ${value.items.length} items in ${ms.toFixed(1)}ms`);
});

test(`indexes a ${CATALOG}-document catalogue well under a second`, () => {
  const docs = buildCatalog(CATALOG);
  const { value: index, ms } = elapsed(() => buildCatalogIndex(docs, "movie"));
  assert.equal(index.size, CATALOG);
  assert.ok(ms < 1000, `index build took ${ms.toFixed(1)}ms`);
  console.log(`    index:      ${CATALOG} docs in ${ms.toFixed(1)}ms`);
});

test(`matches ${LIBRARY} items against ${CATALOG} documents well under a second`, () => {
  const index = buildCatalogIndex(buildCatalog(CATALOG), "movie");
  const { items } = normalizeFiles("letterboxd", [
    { name: "watched.csv", text: buildLetterboxdCsv(LIBRARY), flags: { watched: true } },
  ]);
  const { value: result, ms } = elapsed(() => matchAll(items, index));
  // Every generated title exists in the generated catalogue, so anything
  // unmatched is a matcher regression rather than missing data.
  assert.equal(result.unmatched.length, 0, `${result.unmatched.length} items failed to match`);
  assert.equal(result.matched.length, LIBRARY);
  assert.ok(ms < 1000, `match took ${ms.toFixed(1)}ms`);
  console.log(`    match:      ${LIBRARY} items in ${ms.toFixed(1)}ms`);
});

test("matching cost stays linear as the catalogue grows", () => {
  // The guard against someone reintroducing a scan inside the match loop:
  // a 4x larger catalogue must not cost meaningfully more per item, since
  // every lookup is a Map hit.
  const { items } = normalizeFiles("letterboxd", [
    { name: "watched.csv", text: buildLetterboxdCsv(5000), flags: { watched: true } },
  ]);
  const small = buildCatalogIndex(buildCatalog(10000), "movie");
  const large = buildCatalogIndex(buildCatalog(40000), "movie");

  matchAll(items, small); // warm the JIT so the first run isn't penalised
  const a = elapsed(() => matchAll(items, small)).ms;
  const b = elapsed(() => matchAll(items, large)).ms;

  console.log(`    scaling:    10k catalogue ${a.toFixed(1)}ms vs 40k ${b.toFixed(1)}ms`);
  // Linear would be 1.0x. Anything approaching 4x is a scan.
  assert.ok(b < a * 2.5 + 25, `4x catalogue cost ${(b / a).toFixed(2)}x the time`);
});
