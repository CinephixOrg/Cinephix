import test from "node:test";
import assert from "node:assert/strict";
import { localizeTitles } from "./localizedTitles.ts";

const kurtlar = () => ({ name: "The Valley of The Wolves", title: "The Valley of The Wolves", original_name: "Kurtlar Vadisi", original_language: "tr" });
const breakingBad = () => ({ name: "Breaking Bad", original_name: "Breaking Bad", original_language: "en" });

test("a Turkish title shows its Turkish name in Turkish, its English name in English", () => {
  const tr = localizeTitles(kurtlar(), "tr");
  assert.equal(tr.name, "Kurtlar Vadisi");
  assert.equal(tr.title, "Kurtlar Vadisi");
  assert.equal(localizeTitles(kurtlar(), "en").name, "The Valley of The Wolves");
});

test("other languages' titles keep their English name", () => {
  assert.equal(localizeTitles(breakingBad(), "tr").name, "Breaking Bad");
  const german = { title: "The Lives of Others", original_title: "Das Leben der Anderen", original_language: "de" };
  assert.equal(localizeTitles({ ...german }, "tr").title, "The Lives of Others");
  assert.equal(localizeTitles({ ...german }, "de-DE").title, "Das Leben der Anderen");
});

test("titles nested anywhere in a response are switched, other fields untouched", () => {
  const response = {
    items: [{ content: { id: "1", title: "Back Streets", original_title: "Arka Sokaklar", original_language: "tr", poster_path: "/p.jpg" } }],
    user: { name: "furkan" },
  };
  localizeTitles(response, "tr");
  assert.equal(response.items[0].content.title, "Arka Sokaklar");
  assert.equal(response.items[0].content.poster_path, "/p.jpg");
  assert.equal(response.user.name, "furkan");
});

test("a title with a language but no original name stays as it is", () => {
  const legacy = { title: "The Demolition of the Russian Monument at St Stephen", original_language: "tr" };
  assert.equal(localizeTitles({ ...legacy }, "tr").title, legacy.title);
  assert.equal(localizeTitles(null, "tr"), null);
  assert.equal(localizeTitles("text", "tr"), "text");
});
