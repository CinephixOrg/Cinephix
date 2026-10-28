import test from "node:test";
import assert from "node:assert/strict";
import { countryName, knownCountries } from "./countries.ts";

const NAMES = {
  KR: { en: "South Korea", tr: "Güney Kore" },
  US: { en: "United States", tr: "Amerika Birleşik Devletleri" },
  FR: { en: "France", tr: "Fransa" },
};

test("countries: known ones only, once each, the first few", () => {
  assert.deepEqual(knownCountries(["kr", "US", "KR", "SU", null], NAMES), ["KR", "US"]);
  assert.deepEqual(knownCountries(["KR", "US", "FR"], NAMES), ["KR", "US"]);
  assert.deepEqual(knownCountries(undefined, NAMES), []);
});

test("names follow the app's language, English when there's nothing better", () => {
  assert.equal(countryName("KR", "tr", NAMES), "Güney Kore");
  assert.equal(countryName("KR", "en-US", NAMES), "South Korea");
  assert.equal(countryName("XX", "tr", NAMES), "XX", "unknown: the code itself");
  const other = countryName("KR", "de", NAMES);
  assert.ok(other === "Südkorea" || other === "South Korea", `de: ${other}`);
});
