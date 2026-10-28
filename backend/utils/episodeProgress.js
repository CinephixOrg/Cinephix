// Which episodes of a series a user has watched, and when (TC-141).
//
// One document per user and series (models/EpisodeProgress.js), small enough
// to keep every episode a heavy watcher ever marks, with the date it was
// marked, for monthly reports ("12 episodes this month"):
//
//   eps: [{ s, e, at }]  episodes marked one by one or a season at a time;
//                        `at` is when. Short keys on purpose: a 300-episode
//                        series is ~12 KB this way.
//   all: { s, e }        "I've watched it all", up to and including that
//                        episode — the last one aired when it was said. No
//                        date: it's past viewing, and must not count as
//                        hundreds of episodes watched this month.
//
// An episode is watched if either says so. Unmarking one that `all` covers
// turns `all` into undated `eps` entries (no `at`) minus that one, so
// nothing else changes.
//
// Season 0 (TMDB's "Specials") is never part of "all": specials are extras,
// often unaired or unnumbered, not the series. They can still be marked one
// by one.
//
// Pure, so it runs under `node --test` (episodeProgress.test.js).

const before = (a, b) => a.s < b.s || (a.s === b.s && a.e <= b.e);

/** Whether episode `e` of season `s` counts as watched. */
export function isWatched(progress, s, e) {
  if (!progress) return false;
  if (progress.all && s > 0 && before({ s, e }, progress.all)) return true;
  return (progress.eps ?? []).some((ep) => ep.s === s && ep.e === e);
}

/**
 * Every regular episode up to and including `until`, as undated entries.
 * `seasons` is TMDB's season list: [{ season_number, episode_count }].
 */
export function episodesUpTo(until, seasons) {
  const out = [];
  for (const season of seasons) {
    const s = season.season_number;
    if (s < 1 || s > until.s) continue;
    const last = s === until.s ? Math.min(until.e, season.episode_count) : season.episode_count;
    for (let e = 1; e <= last; e++) out.push({ s, e });
  }
  return out;
}

/** `progress` with `all` spelled out as undated episodes, so one of them can be taken back. */
function withoutAll(progress, seasons) {
  if (!progress.all) return progress;
  const eps = [...(progress.eps ?? [])];
  for (const ep of episodesUpTo(progress.all, seasons)) {
    if (!eps.some((x) => x.s === ep.s && x.e === ep.e)) eps.push(ep);
  }
  return { eps, all: null };
}

/**
 * Marks (or unmarks) the given episodes — one, or a whole season's — and
 * returns the new { eps, all }. Episodes already watched keep their date.
 */
export function markEpisodes(progress, episodes, watched, { now = new Date(), seasons = [] } = {}) {
  let next = { eps: [...(progress?.eps ?? [])], all: progress?.all ?? null };
  if (watched) {
    for (const { s, e } of episodes) {
      if (!isWatched(next, s, e)) next.eps.push({ s, e, at: now });
    }
    return next;
  }
  if (next.all && episodes.some(({ s, e }) => s > 0 && before({ s, e }, next.all))) next = withoutAll(next, seasons);
  next.eps = next.eps.filter((ep) => !episodes.some(({ s, e }) => ep.s === s && ep.e === e));
  return next;
}

/**
 * "I've watched every episode" (up to `lastAired`), or, unmarked, nothing
 * at all. Dated entries already there stay: they are when those episodes
 * were really watched.
 */
export function markAll(progress, lastAired, watched) {
  if (!watched) return { eps: [], all: null };
  return { eps: [...(progress?.eps ?? [])], all: lastAired ? { s: lastAired.s, e: lastAired.e } : null };
}

/**
 * How far along the user is: watched and aired regular episodes, overall and
 * per season. `seasons` as above; `lastAired` is the newest aired episode.
 */
export function progressSummary(progress, seasons, lastAired) {
  const aired = lastAired ? episodesUpTo(lastAired, seasons) : [];
  const perSeason = {};
  let watched = 0;
  for (const { s, e } of aired) {
    perSeason[s] ??= { watched: 0, aired: 0 };
    perSeason[s].aired += 1;
    if (isWatched(progress, s, e)) {
      perSeason[s].watched += 1;
      watched += 1;
    }
  }
  return { watched, aired: aired.length, perSeason };
}
