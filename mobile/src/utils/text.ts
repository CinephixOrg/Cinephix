import i18next from "../i18n";

// Locale-correct uppercasing.
//
// Three ways to uppercase text in this app, only one of which is right:
//
//   textTransform: "uppercase"  — applied natively, honours the *device*
//     locale. On a Turkish-locale phone it turns "i" into "İ" even when the
//     app is in English, so "Security" renders as "SECURİTY".
//
//   .toUpperCase()              — locale-invariant. Fixes the above, but is
//     then wrong for Turkish itself: "gizlilik" becomes "GIZLILIK" when it
//     should be "GİZLİLİK".
//
//   this                        — uppercases for the language the *app* is
//     set to, which is the only one that is correct in both directions.
//
// Turkish (and Azerbaijani) are special-cased explicitly rather than left to
// toLocaleUpperCase, because Hermes does not ship full ICU on every platform
// and would silently fall back to the invariant mapping.
const DOTTED_I_LOCALES = new Set(["tr", "az"]);

export function localeUpper(text: string, language?: string): string {
  if (!text) return "";
  const lang = (language ?? i18next.language ?? "en").slice(0, 2).toLowerCase();
  if (DOTTED_I_LOCALES.has(lang)) {
    // i -> İ. Dotless ı already uppercases to I under the invariant mapping.
    return text.replace(/i/g, "İ").toUpperCase();
  }
  return text.toUpperCase();
}
