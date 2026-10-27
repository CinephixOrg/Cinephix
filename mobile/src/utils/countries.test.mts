import test from "node:test";
import assert from "node:assert/strict";
import { countryName, flagCountries, flagEmoji } from "./countries.ts";

const NAMES = {
  KR: { en: "South Korea", tr: "Güney Kore" },
  US: { en: "United States", tr: "Amerika Birleşik Devletleri" },
  FR: { en: "France", tr: "Fransa" },
  DE: { en: "Germany", tr: "Almanya" },
};

test("flags: known countries only, once each, the first few", () => {
  assert.deepEqual(flagCountries(["kr", "US", "KR", "SU", null], NAMES), ["KR", "US"]);
  assert.deepEqual(flagCountries(["KR", "US", "FR", "DE"], NAMES), ["KR", "US", "FR"]);
  assert.deepEqual(flagCountries(undefined, NAMES), []);
});

test("a flag is the code's two regional-indicator letters", () => {
  assert.equal(flagEmoji("KR"), "🇰🇷");
  assert.equal(flagEmoji("tr"), "🇹🇷");
});

test("names follow the app's language, English when there's nothing better", () => {
  assert.equal(countryName("KR", "tr", NAMES), "Güney Kore");
  assert.equal(countryName("KR", "en-US", NAMES), "South Korea");
  assert.equal(countryName("XX", "tr", NAMES), "XX", "unknown: the code itself");
  const other = countryName("KR", "de", NAMES);
  assert.ok(other === "Südkorea" || other === "South Korea", `de: ${other}`);
});
