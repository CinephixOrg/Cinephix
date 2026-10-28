// A film or series shows under its own name when it is in the app's
// language, and under its English name otherwise: in Turkish, "Kurtlar
// Vadisi" and "Breaking Bad"; in German, a German film's German name and
// still "Breaking Bad". The catalogue stores the English name in `title`
// (`name` for series) and, where TMDB gave one, the original name with its
// language (`original_title` / `original_name`, `original_language` —
// backend/utils/catalogTitles.js), so every title the API returns can be
// switched here, once, instead of in each of the screens that show one.

const baseLanguage = (code: string) => code.split("-")[0].toLowerCase();

/**
 * Rewrites, in place, the title of every film or series in `data` whose
 * original language is `language`. Anything else — including titles with no
 * original name stored — keeps its English name.
 */
export function localizeTitles<T>(data: T, language: string): T {
  const lang = baseLanguage(language);
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    const original = record.original_title || record.original_name;
    if (typeof original === "string" && typeof record.original_language === "string" && baseLanguage(record.original_language) === lang) {
      if (typeof record.title === "string") record.title = original;
      if (typeof record.name === "string") record.name = original;
    }
    for (const child of Object.values(record)) {
      if (child && typeof child === "object") visit(child);
    }
  };
  visit(data);
  return data;
}
