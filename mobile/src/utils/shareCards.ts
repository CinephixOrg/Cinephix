// What the premium chat cards show for shared profiles, Syncs and CineGraph
// analyses — worked out from the message's stored data.
//
// Pure and React-free so it runs under `node --test` (shareCards.test.mts).

import type { CineGraphData } from "../types";

/**
 * A person's top genres by how many titles they've rated in each, movies
 * and series combined — the CineGraph's own numbers, sent with a profile
 * share so the card can say what they're into.
 */
export function topGenresFrom(cineGraph: CineGraphData | null | undefined, limit = 3): string[] {
  if (!cineGraph) return [];
  const totals = new Map<string, number>();
  for (const stats of [cineGraph.movieStats, cineGraph.seriesStats]) {
    for (const [genre, count] of Object.entries(stats ?? {})) {
      if (count > 0) totals.set(genre, (totals.get(genre) ?? 0) + count);
    }
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([genre]) => genre);
}

/** Text short enough for a chat card (a bio, a list description): whitespace collapsed, cut at a word with an ellipsis. */
export function snippet(text: string | null | undefined, max = 140): string | undefined {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return undefined;
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:!?-]+$/, "")}…`;
}

export type MatchTone = "high" | "medium" | "low";

/** Green from 70%, amber from 45%, a warm red below. */
export function matchTone(percentage: number): MatchTone {
  if (percentage >= 70) return "high";
  if (percentage >= 45) return "medium";
  return "low";
}

export const MATCH_TONE_COLOR: Record<MatchTone, string> = {
  high: "#34D399",
  medium: "#FBBF24",
  low: "#F87171",
};

export interface GenreSlice {
  genre: string;
  percentage: number;
}

/**
 * The CineGraph snapshot: the top genres by share, plus one "other" slice
 * for the rest so the ring always closes at 100%. Percentages are rounded
 * and the leftover never goes negative.
 */
export function cineGraphSlices(
  breakdown: readonly { genre: string; percentage: number }[] | null | undefined,
  limit = 3
): { top: GenreSlice[]; other: number } {
  const valid = (breakdown ?? []).filter((row) => row && row.genre && row.percentage > 0);
  const top = [...valid]
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, limit)
    .map((row) => ({ genre: row.genre, percentage: Math.round(row.percentage) }));
  const used = top.reduce((sum, slice) => sum + slice.percentage, 0);
  return { top, other: top.length > 0 ? Math.max(0, 100 - used) : 0 };
}
