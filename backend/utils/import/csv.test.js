import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, splitRows, detectDelimiter, stripBom } from "./csv.js";

test("splits plain rows and fields", () => {
  assert.deepEqual(splitRows("a,b\nc,d"), [["a", "b"], ["c", "d"]]);
});

test("handles CRLF, which is what Windows exporters emit", () => {
  assert.deepEqual(splitRows("a,b\r\nc,d\r\n"), [["a", "b"], ["c", "d"]]);
});

test("keeps delimiters that live inside quoted fields", () => {
  assert.deepEqual(splitRows('a,"b,1",c'), [["a", "b,1", "c"]]);
});

test("collapses doubled quotes into one", () => {
  assert.deepEqual(splitRows('"say ""hi""",x'), [['say "hi"', "x"]]);
});

test("keeps newlines that live inside quoted fields", () => {
  assert.deepEqual(splitRows('a,"multi\nline",c'), [["a", "multi\nline", "c"]]);
});

test("a trailing delimiter produces a final empty field", () => {
  assert.deepEqual(splitRows("a,"), [["a", ""]]);
});

test("a trailing newline does not produce a phantom row", () => {
  assert.deepEqual(splitRows("a,b\n"), [["a", "b"]]);
});

test("empty input yields no rows", () => {
  assert.deepEqual(splitRows(""), []);
  assert.deepEqual(parseCsv(""), []);
});

test("strips a UTF-8 BOM so the first column name is usable", () => {
  const rows = parseCsv("﻿Name,Year\nDune,2021");
  assert.deepEqual(Object.keys(rows[0]), ["Name", "Year"]);
  assert.equal(stripBom("﻿x"), "x");
});

test("maps rows onto header names", () => {
  assert.deepEqual(parseCsv("Name,Year\nDune,2021\n"), [{ Name: "Dune", Year: "2021" }]);
});

test("short rows are padded rather than dropped", () => {
  assert.deepEqual(parseCsv("a,b,c\n1,2"), [{ a: "1", b: "2", c: "" }]);
});

test("blank lines between records are skipped", () => {
  assert.deepEqual(parseCsv("a\n1\n\n2\n"), [{ a: "1" }, { a: "2" }]);
});

test("detects semicolon and tab delimiters from the header", () => {
  assert.equal(detectDelimiter("a;b;c\n1;2;3"), ";");
  assert.equal(detectDelimiter("a\tb\tc"), "\t");
  assert.equal(detectDelimiter("a,b,c"), ",");
});

test("a delimiter inside a quoted header does not win the vote", () => {
  assert.equal(detectDelimiter('"a;b",c,d'), ",");
});

test("parses a realistic Letterboxd ratings.csv", () => {
  const csv = [
    "Date,Name,Year,Letterboxd URI,Rating",
    "2024-01-02,Dune,2021,https://boxd.it/x,4.5",
    '2024-02-03,"Everything Everywhere All at Once",2022,https://boxd.it/y,5',
  ].join("\n");
  const rows = parseCsv(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[1].Name, "Everything Everywhere All at Once");
  assert.equal(rows[1].Rating, "5");
});
