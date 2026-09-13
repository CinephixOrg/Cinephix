import test from "node:test";
import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import { gzipSync } from "node:zlib";
import { extractFiles, hashBuffer } from "./archive.js";
import { normalizeFiles, selectFiles } from "./adapters.js";
import { buildCatalogIndex, matchAll } from "./match.js";

function zipOf(entries) {
  const zip = new AdmZip();
  for (const [name, text] of Object.entries(entries)) zip.addFile(name, Buffer.from(text, "utf8"));
  return zip.toBuffer();
}

test("unpacks a zip into its text entries", () => {
  const buffer = zipOf({ "watched.csv": "Name,Year\nDune,2021\n", "ratings.csv": "Name,Rating\nDune,4.5\n" });
  const files = extractFiles(buffer, "letterboxd.zip");
  assert.equal(files.length, 2);
  assert.deepEqual(files.map((f) => f.name).sort(), ["ratings.csv", "watched.csv"]);
});

test("skips macOS resource forks that would parse as duplicate garbage", () => {
  const buffer = zipOf({
    "watched.csv": "Name\nDune\n",
    "__MACOSX/._watched.csv": "junk",
    "._watched.csv": "junk",
  });
  const files = extractFiles(buffer, "x.zip");
  assert.deepEqual(files.map((f) => f.name), ["watched.csv"]);
});

test("skips non-text entries such as bundled images", () => {
  const buffer = zipOf({ "watched.csv": "Name\nDune\n", "poster.jpg": "binary", "readme.md": "hi" });
  assert.deepEqual(extractFiles(buffer, "x.zip").map((f) => f.name), ["watched.csv"]);
});

test("normalizes Windows path separators so nested rules still match", () => {
  const zip = new AdmZip();
  zip.addFile("likes\\films.csv", Buffer.from("Name,Year\nDune,2021\n", "utf8"));
  const files = extractFiles(zip.toBuffer(), "x.zip");
  assert.equal(files[0].name, "likes/films.csv");
  assert.equal(selectFiles("letterboxd", files).length, 1);
});

test("ungzips a MyAnimeList export", () => {
  const xml = "<myanimelist><anime><series_title>Death Note</series_title></anime></myanimelist>";
  const files = extractFiles(gzipSync(Buffer.from(xml, "utf8")), "animelist.xml.gz");
  assert.equal(files.length, 1);
  assert.equal(files[0].name, "animelist.xml");
  assert.ok(files[0].text.includes("Death Note"));
});

test("passes a bare CSV straight through", () => {
  const files = extractFiles(Buffer.from("Title,Year\nDune,2021\n", "utf8"), "ratings.csv");
  assert.equal(files.length, 1);
  assert.equal(files[0].name, "ratings.csv");
});

test("sniffs the format rather than trusting the extension", () => {
  // A zip that a picker renamed to .csv still unpacks as a zip.
  const files = extractFiles(zipOf({ "watched.csv": "Name\nDune\n" }), "export.csv");
  assert.equal(files[0].name, "watched.csv");
});

test("an empty upload yields no files instead of throwing", () => {
  assert.deepEqual(extractFiles(Buffer.alloc(0), "x.zip"), []);
  assert.deepEqual(extractFiles(null, ""), []);
});

test("the fingerprint is content-addressed, not name-addressed", () => {
  const a = Buffer.from("Title,Year\nDune,2021\n");
  const b = Buffer.from("Title,Year\nDune,2021\n");
  const c = Buffer.from("Title,Year\nSicario,2015\n");
  assert.equal(hashBuffer(a), hashBuffer(b));
  assert.notEqual(hashBuffer(a), hashBuffer(c));
});

test("end to end: a Letterboxd zip becomes matched catalogue documents", () => {
  const buffer = zipOf({
    "watched.csv": "Date,Name,Year,Letterboxd URI\n2024-01-02,Dune,2021,x\n2024-01-03,The Thing,1982,y\n",
    "ratings.csv": "Date,Name,Year,Letterboxd URI,Rating\n2024-01-02,Dune,2021,x,4.5\n",
    "likes/films.csv": "Date,Name,Year,Letterboxd URI\n2024-01-05,Dune,2021,x\n",
    "comments.csv": "Date,Comment\n2024-01-01,ignored\n",
  });

  // Stage 0-2
  const files = extractFiles(buffer, "letterboxd.zip");
  const { items, stats } = normalizeFiles("letterboxd", selectFiles("letterboxd", files));
  assert.equal(items.length, 2);
  assert.equal(stats.favorites, 1);

  // Stage 3
  const catalog = [
    { _id: "m1", title: "Dune", release_date: "2021-10-22" },
    { _id: "m3", title: "The Thing", release_date: "1982-06-25" },
    { _id: "m9", title: "Unrelated", release_date: "1999-01-01" },
  ];
  const { matched, unmatched } = matchAll(items, buildCatalogIndex(catalog, "movie"));
  assert.equal(unmatched.length, 0);
  assert.equal(matched.length, 2);

  const dune = matched.find((m) => m.doc._id === "m1");
  assert.equal(dune.item.watched, true);
  assert.equal(dune.item.favorite, true);
  assert.equal(dune.item.rating, 9);
});

test("end to end: a MyAnimeList gzip becomes matched series documents", () => {
  const xml = `<myanimelist>
    <anime><series_animedb_id>1535</series_animedb_id><series_title><![CDATA[Death Note]]></series_title>
      <series_type>TV</series_type><my_score>9</my_score><my_status>Completed</my_status>
      <my_watched_episodes>37</my_watched_episodes></anime>
  </myanimelist>`;
  const files = extractFiles(gzipSync(Buffer.from(xml, "utf8")), "animelist.xml.gz");
  const { items } = normalizeFiles("myanimelist", selectFiles("myanimelist", files));
  assert.equal(items.length, 1);

  const { matched } = matchAll(items, buildCatalogIndex([{ _id: "s1", name: "Death Note", first_air_date: "2006-10-04" }], "series"));
  assert.equal(matched.length, 1);
  assert.equal(matched[0].item.rating, 9);
  assert.equal(matched[0].item.episodes, 37);
});
