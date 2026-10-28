// Whether an episode counts as watched — the same rule as the server's
// (backend/utils/episodeProgress.js), so the list can answer a tap at once
// instead of waiting for the server's reply. `all` is "everything up to here",
// never including Specials (season 0).
import type { EpisodeProgress } from "../api/episodeService";

export function isEpisodeWatched(progress: EpisodeProgress | null | undefined, s: number, e: number): boolean {
  if (!progress) return false;
  const { all } = progress;
  if (all && s > 0 && (s < all.s || (s === all.s && e <= all.e))) return true;
  return progress.eps.some((ep) => ep.s === s && ep.e === e);
}
