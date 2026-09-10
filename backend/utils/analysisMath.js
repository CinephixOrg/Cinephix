// Pure helpers behind Profile Analysis's numbers, pulled out of
// userController.js's getProfileAnalysis so they can be unit-tested without a
// database, an LLM key, or an Express request. Nothing in here touches
// Mongoose or `req` — every function takes plain data and returns plain data.
//
// These exist because the analysis UI makes explicit, checkable claims to
// the user ("37 of your 45 rated titles are tagged Drama", "31% of all 118
// genre tags", "12% more than last month"). Numbers that have to add up are
// exactly the numbers worth testing.

// The movies collection stores a film's name under `title`; the series
// collection is inconsistent — some documents carry `name` (TMDB's own field
// for shows), others `title`, depending on which importer wrote them. Both
// content routes already select the pair defensively, and this is the same
// defensiveness in one place: prefer the type's canonical field, fall back to
// the other rather than rendering a poster with no name under it.
export function resolveDisplayName(doc, type) {
  if (!doc) return undefined;
  return type === "series" ? doc.name || doc.title : doc.title || doc.name;
}

// Tally genre-name occurrences across a set of content documents. A title
// with 3 genres contributes 3 tags, which is why the totals these produce
// are always >= the number of titles.
export function tallyGenres(docs, genreMap, into = {}) {
  for (const doc of docs) {
    const ids = doc?.genre_ids;
    if (!Array.isArray(ids)) continue;
    for (const id of ids) {
      const name = genreMap[id];
      if (name) into[name] = (into[name] || 0) + 1;
    }
  }
  return into;
}

export function sumCounts(counts) {
  return Object.values(counts).reduce((sum, c) => sum + c, 0);
}

// Merges the per-type tallies into one all-time breakdown.
//
// `percentage` is each genre's share of the TAG total, not of the title
// count — those are different denominators, and conflating them is what made
// an earlier version show "37 of your 45 titles" next to "31%" with no
// explanation. `tagTotal` ships alongside so the UI can name the remainder
// ("Other") instead of leaving the listed slices summing to 69%.
export function buildGenreBreakdown(movieGenreCounts, seriesGenreCounts, limit = 6) {
  const combined = {};
  for (const [genre, count] of Object.entries(movieGenreCounts)) {
    combined[genre] = (combined[genre] || 0) + count;
  }
  for (const [genre, count] of Object.entries(seriesGenreCounts)) {
    combined[genre] = (combined[genre] || 0) + count;
  }

  const tagTotal = sumCounts(combined);
  const percentByName = {};
  for (const [genre, count] of Object.entries(combined)) {
    percentByName[genre] = tagTotal ? Math.round((count / tagTotal) * 100) : 0;
  }

  const genreBreakdown = Object.entries(combined)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([genre, count]) => ({ genre, count, percentage: percentByName[genre] || 0 }));

  return { combined, tagTotal, percentByName, genreBreakdown };
}

// The last 30 days, with each genre's swing against the 30 days before it.
//
// deltaVsPreviousPeriod is null (never 0) when there's no earlier window to
// compare against: "unchanged" and "nothing to compare with" are different
// statements, and the UI draws them differently.
export function buildRecentGenres(recentCounts, previousCounts, allTimePercentByName, limit = 5) {
  const recentTotal = sumCounts(recentCounts);
  const previousTotal = sumCounts(previousCounts);

  return Object.entries(recentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([genre, count]) => {
      const percentage = recentTotal ? Math.round((count / recentTotal) * 100) : 0;
      const previousPercentage = previousTotal
        ? Math.round(((previousCounts[genre] || 0) / previousTotal) * 100)
        : 0;
      return {
        genre,
        count,
        percentage,
        deltaVsAllTime: percentage - (allTimePercentByName[genre] || 0),
        deltaVsPreviousPeriod: previousTotal ? percentage - previousPercentage : null
      };
    });
}

// Favorite-genre weighting. Same tag-vs-title denominator caveat as
// buildGenreBreakdown, hence the tagTotal for the "Other" remainder.
export function buildFavoriteGenres(favGenreCounts, limit = 5) {
  const tagTotal = sumCounts(favGenreCounts);
  const items = Object.entries(favGenreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([genre, count]) => ({
      genre,
      count,
      percentage: tagTotal ? Math.round((count / tagTotal) * 100) : 0
    }));
  return { items, tagTotal };
}

// 1-10 histogram of the scores a user hands out. Values are clamped rather
// than dropped: a malformed rating still belongs somewhere, and silently
// discarding it would make the histogram disagree with totalRatings.
export function buildRatingCurve(ratings) {
  const counts = new Array(10).fill(0);
  for (const rating of ratings) {
    const score = Math.min(10, Math.max(1, Math.round(rating.value)));
    counts[score - 1] += 1;
  }
  return counts.map((count, i) => ({ value: i + 1, count }));
}

// The 6 calendar months ending with the current one, oldest first. Month
// starts are returned as Dates; the caller serializes them to ISO so the
// client can format the label in the viewer's own locale.
export function buildMonthBuckets(now, months = 6) {
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: `${start.getFullYear()}-${start.getMonth()}`, start, count: 0 });
  }
  return buckets;
}

export function monthKeyOf(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

// Window boundaries for the monthly-stats card.
//
// `monthEnd` is midnight on the 1st of NEXT month — an exclusive bound, so
// events on the final day of the month still count. `periodEnd` is the last
// day itself, purely for the "1-31 August" label. Using the label date as a
// query bound silently dropped that whole day.
export function monthWindows(now) {
  return {
    monthStart: new Date(now.getFullYear(), now.getMonth(), 1),
    monthEnd: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    periodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    prevMonthStart: new Date(now.getFullYear(), now.getMonth() - 1, 1)
  };
}

export function isWithin(date, start, end) {
  if (!date) return false;
  const d = new Date(date);
  return d >= start && d < end;
}

export function averageRating(ratings) {
  if (!ratings.length) return 0;
  const total = ratings.reduce((sum, r) => sum + r.value, 0);
  return Math.round((total / ratings.length) * 10) / 10;
}
