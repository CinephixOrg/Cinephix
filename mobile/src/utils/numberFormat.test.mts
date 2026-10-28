import test from "node:test";
import assert from "node:assert/strict";
import { formatCompactCount, formatDecimal } from "./numberFormat.ts";

test("a rating keeps one decimal, in the language's own decimal mark", () => {
  assert.equal(formatDecimal(9, "en"), "9.0");
  assert.equal(formatDecimal(7.852, "en-US"), "7.9");
  assert.equal(formatDecimal(7.852, "tr"), "7,9");
  assert.equal(formatDecimal(8.45, "de"), "8,5");
  assert.equal(formatDecimal(8.45, "ja"), "8.5");
});

test("vote counts shorten past a thousand, the language's way", () => {
  assert.equal(formatCompactCount(86, "tr"), "86");
  assert.equal(formatCompactCount(17885, "en"), "17.9K");
  assert.equal(formatCompactCount(17885, "tr"), "17,9 B");
  assert.equal(formatCompactCount(18000, "tr"), "18 B", "no trailing ,0");
  assert.equal(formatCompactCount(1234567, "tr"), "1,2 Mn");
  assert.equal(formatCompactCount(1234567, "ko"), "1.2M", "other languages: English abbreviations");
});
