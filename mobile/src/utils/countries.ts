// A title's production countries on its detail page: as flags, and by name
// when a flag is tapped. The names come from constants/countryNames.ts,
// handed in by the caller.
//
// Pure and React-free so it runs under `node --test` (countries.test.mts).

export type CountryNames = Record<string, { en: string; tr: string }>;

/** At most this many flags; a co-production with more shows the first few. */
export const MAX_FLAGS = 3;

/**
 * The countries worth a flag, in order: known ISO codes, once each. A code
 * with no country of today behind it (a former one, like SU) is left out
 * rather than shown as a stray pair of letters or someone else's flag.
 */
export function flagCountries(codes: readonly unknown[] | null | undefined, names: CountryNames, max = MAX_FLAGS): string[] {
  const known = (codes ?? [])
    .map((code) => String(code ?? "").toUpperCase())
    .filter((code, i, all) => code in names && all.indexOf(code) === i);
  return known.slice(0, max);
}

/** A country's flag emoji: the two regional-indicator letters of its code ("KR" → 🇰🇷). */
export function flagEmoji(code: string): string {
  return String.fromCodePoint(...[...code.toUpperCase()].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));
}

type DisplayNamesCtor = new (locales: string[], options: { type: "region" }) => { of(code: string): string | undefined };

/**
 * A country's name in the app's language. English and Turkish come from the
 * table; other languages from the device's own Intl when it has names for
 * them (Hermes doesn't always), else English.
 */
export function countryName(code: string, language: string | undefined, names: CountryNames): string {
  const known = names[code];
  const lang = (language ?? "en").split("-")[0];
  if (lang === "en" || lang === "tr") return known?.[lang] ?? code;
  try {
    const DisplayNames = (Intl as { DisplayNames?: DisplayNamesCtor }).DisplayNames;
    const name = DisplayNames ? new DisplayNames([lang], { type: "region" }).of(code) : undefined;
    if (name && name !== code) return name;
  } catch {
    // No names for this language on this device: English instead.
  }
  return known?.en ?? code;
}
