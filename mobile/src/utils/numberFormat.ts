// Numbers as the app's language writes them, without relying on the
// device's Intl (Hermes' support varies): a rating's decimal comma or point,
// and a vote count shortened to thousands or millions.
//
// Pure and React-free so it runs under `node --test` (numberFormat.test.mts).

// Languages that write a decimal comma (7,9) rather than a point (7.9).
const DECIMAL_COMMA = new Set(["tr", "de", "fr", "es", "it", "pt", "ru"]);
// Thousand / million abbreviations; English's for every other language.
const SUFFIXES: Record<string, [string, string]> = { tr: [" B", " Mn"], en: ["K", "M"] };

const baseLanguage = (language: string | undefined) => (language ?? "en").split("-")[0];

/** One decimal place, in the language's own decimal mark: 9 → "9.0", 7.85 → "7,9" in Turkish. */
export function formatDecimal(value: number, language: string | undefined): string {
  const text = (Math.round(value * 10) / 10).toFixed(1);
  return DECIMAL_COMMA.has(baseLanguage(language)) ? text.replace(".", ",") : text;
}

/** A count shortened past a thousand: 950 → "950", 17885 → "17.9K" / "17,9 B", 1234567 → "1.2M" / "1,2 Mn". */
export function formatCompactCount(count: number, language: string | undefined): string {
  const lang = baseLanguage(language);
  const [thousand, million] = SUFFIXES[lang] ?? SUFFIXES.en;
  if (count < 1000) return String(Math.round(count));
  const [scaled, suffix] = count < 1_000_000 ? [count / 1000, thousand] : [count / 1_000_000, million];
  // A whole number reads cleaner without its ".0": "18K", not "18.0K".
  const rounded = Math.round(scaled * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : formatDecimal(rounded, language);
  return `${text}${suffix}`;
}
