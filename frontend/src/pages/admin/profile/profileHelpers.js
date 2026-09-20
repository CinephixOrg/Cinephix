import { formatDistanceToNow } from "date-fns";

// Plain helpers behind the moderator's profile view (ProfileParts.jsx).

export const POSTER = "https://image.tmdb.org/t/p/w342";

/** A poster path as the app stores it, or an absolute URL a post already carries. */
export const posterUrl = (path) => (!path ? null : path.startsWith("http") ? path : `${POSTER}${path}`);

export const ago = (date) => (date ? formatDistanceToNow(new Date(date), { addSuffix: true }) : "");

/** The three genres they've rated most, as the app's own share cards compute them. */
export function topGenres(cineGraph, limit = 3) {
  if (!cineGraph) return [];
  const totals = new Map();
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
