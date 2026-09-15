import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { PUSH_PHRASES, pushLanguage, pushPhrase } from "./pushCopy.js";

const KEYS = Object.keys(PUSH_PHRASES.en);

test("every language has every phrase, with its placeholders", () => {
  for (const [language, phrases] of Object.entries(PUSH_PHRASES)) {
    assert.deepEqual(Object.keys(phrases).sort(), [...KEYS].sort(), language);
    for (const key of KEYS) {
      assert.ok(phrases[key].trim().length > 0, `${language}: ${key}`);
      if (key.includes("{{count}}")) assert.ok(phrases[key].includes("{{count}}"), `${language}: ${key}`);
    }
  }
});

test("a locale tag maps to its language, and anything unsupported to English", () => {
  assert.equal(pushLanguage("pt-BR"), "pt");
  assert.equal(pushLanguage("zh_Hans"), "zh");
  assert.equal(pushLanguage("TR"), "tr");
  assert.equal(pushLanguage("nl"), "en");
  assert.equal(pushLanguage(undefined), "en");
  assert.equal(pushLanguage("constructor"), "en");
});

test("placeholders are filled, and left alone when there's no value", () => {
  assert.equal(pushPhrase("de", "{{count}} users liked your share", { count: 4 }), "4 Nutzern gefällt dein Beitrag");
  assert.equal(pushPhrase("en", "{{count}} users liked your share"), "{{count}} users liked your share");
  assert.equal(pushPhrase("en", "no such phrase"), "no such phrase");
});

// The app's locale table sits next to the backend in this repository, but not
// in a backend-only deployment, so this check runs only where it exists.
const localesFile = fileURLToPath(new URL("../../mobile/src/locales/index.ts", import.meta.url));

test("the phrases match the app's own translations", { skip: !fs.existsSync(localesFile) && "mobile locales not present" }, async () => {
  const { resources } = await import(localesFile);
  for (const [language, phrases] of Object.entries(PUSH_PHRASES)) {
    const app = resources[language]?.translation;
    assert.ok(app, `the app has no "${language}" locale`);
    for (const key of KEYS) assert.equal(phrases[key], app[key], `${language}: ${key}`);
  }
  assert.deepEqual(Object.keys(PUSH_PHRASES).sort(), Object.keys(resources).sort());
});
