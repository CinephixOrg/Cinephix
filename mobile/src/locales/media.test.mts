import test from "node:test";
import assert from "node:assert/strict";
import { resources } from "./index.ts";

// The Media tab is "Medya" in Turkish and "Media" (or the language's own
// word) everywhere else — a translation, not a spelling to replace
// wholesale. These guard both directions.

const tables = resources as Record<string, { translation: Record<string, string> }>;
const MEDIA_KEYS = ["Media", "Media posts", "Share to Media", "Shared to Media", "Save and Share to Media"];

test("keys say Media; no key uses the Turkish spelling", () => {
  for (const [lang, { translation }] of Object.entries(tables)) {
    for (const key of Object.keys(translation)) {
      assert.ok(!/medya/i.test(key), `${lang}: key "${key}"`);
    }
    for (const key of MEDIA_KEYS) assert.ok(key in translation, `${lang}: missing "${key}"`);
  }
});

test("Turkish says Medya", () => {
  const tr = tables.tr.translation;
  assert.equal(tr["Media"], "Medya");
  for (const key of MEDIA_KEYS) assert.match(tr[key], /Medya/, `tr: "${key}" → "${tr[key]}"`);
});

test("English says Media, and no other language shows the Turkish word", () => {
  assert.equal(tables.en.translation["Media"], "Media");
  assert.equal(tables.en.translation["Media posts"], "Media posts");
  for (const [lang, { translation }] of Object.entries(tables)) {
    if (lang === "tr") continue;
    for (const [key, value] of Object.entries(translation)) {
      assert.ok(!value.includes("Medya"), `${lang}: "${key}" → "${value}"`);
    }
  }
});

test("every sentence that names the Media tab keeps its placeholder in every language", () => {
  for (const [key, value] of Object.entries(tables.en.translation)) {
    if (!key.includes("{{media}}")) continue;
    for (const [lang, { translation }] of Object.entries(tables)) {
      assert.ok(translation[key]?.includes("{{media}}"), `${lang}: "${key}" lost {{media}}`);
    }
  }
});
