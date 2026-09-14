import mongoose from "mongoose";
import { MOVIE_GENRE_MAP, SERIES_GENRE_MAP } from "./genreConstants.js";

// A user's CineGraph, per genre:
//   count       titles on their Watched List in this genre
//   ratedCount  how many of those titles they rated
//   avgRating   the average of those ratings (Rating.value's 1-10 scale; 0 when none)
//
// This is the same definition the CineGraph pie is drawn from
// (userController.getUserCineGraph computes it live), so the stored graph
// CineMatch reads can't disagree with what the user sees.
//
// It used to be maintained incrementally by four code paths with two
// definitions of `count`: +1 on adding a title, +1 again on rating it, -1 on
// removing it, and rebuilds that counted ratings instead of titles. Every
// rated title that was removed left a +1 behind, and a rating stored with an
// ObjectId contentId was never found on removal at all. Every write path now
// recomputes the graph from the Watched List and the ratings instead — a few
// indexed queries, and nothing left to drift.

const key = (id) => String(id);
const timeOf = (doc) => new Date(doc.updatedAt ?? doc.createdAt ?? 0).getTime();

/**
 * Pure: builds both graphs.
 *
 * watchlist     [{ itemId, itemType }]
 * ratings       [{ contentId, value, updatedAt?, createdAt? }] — contentId as
 *               a String or an ObjectId; both refer to the same title
 * movieGenres   Map<movie id string, genre_ids>
 * seriesGenres  Map<series id string, genre_ids>
 *
 * Returns { movie, series }, each a Map<genre name, { count, ratedCount, avgRating }>.
 */
export function computeCineGraphs({ watchlist, ratings, movieGenres, seriesGenres }) {
  // One rating per title. Where both id forms exist for the same title, the
  // most recently written one is the user's current opinion.
  const ratingByTitle = new Map();
  for (const rating of ratings) {
    const id = key(rating.contentId);
    const current = ratingByTitle.get(id);
    if (!current || timeOf(rating) >= timeOf(current)) ratingByTitle.set(id, rating);
  }

  const graphs = { movie: new Map(), series: new Map() };
  const sums = { movie: new Map(), series: new Map() };
  const seen = new Set();

  for (const item of watchlist) {
    const type = item.itemType === "movie" ? "movie" : item.itemType === "series" ? "series" : null;
    if (!type) continue;
    const id = key(item.itemId);
    if (seen.has(`${type}:${id}`)) continue;
    seen.add(`${type}:${id}`);

    const genreIds = (type === "movie" ? movieGenres : seriesGenres).get(id);
    if (!genreIds || genreIds.length === 0) continue;
    const names = type === "movie" ? MOVIE_GENRE_MAP : SERIES_GENRE_MAP;
    const rating = ratingByTitle.get(id);

    for (const genreId of new Set(genreIds)) {
      const genre = names[genreId];
      if (!genre) continue;
      const node = graphs[type].get(genre) ?? { count: 0, ratedCount: 0, avgRating: 0 };
      node.count += 1;
      if (rating && typeof rating.value === "number") {
        node.ratedCount += 1;
        sums[type].set(genre, (sums[type].get(genre) ?? 0) + rating.value);
      }
      graphs[type].set(genre, node);
    }
  }

  for (const type of ["movie", "series"]) {
    for (const [genre, node] of graphs[type]) {
      node.avgRating = node.ratedCount > 0 ? Number((sums[type].get(genre) / node.ratedCount).toFixed(2)) : 0;
    }
  }
  return graphs;
}

/**
 * Recomputes and stores a user's CineGraph. Call after anything that changes
 * their Watched List or their ratings.
 *
 * Writes only the two graph fields, so it can't overwrite a concurrent change
 * to anything else on the user document.
 */
export async function rebuildUserCineGraph(userId) {
  const User = mongoose.model("User");
  const Rating = mongoose.model("Rating");
  const Movie = mongoose.model("Movie");
  const Series = mongoose.model("Series");

  const user = await User.findById(userId).select("watchlist").lean();
  if (!user) return;
  const watchlist = user.watchlist ?? [];

  const movieIds = [];
  const seriesIds = [];
  for (const item of watchlist) {
    if (item.itemType === "movie") movieIds.push(item.itemId);
    else if (item.itemType === "series") seriesIds.push(item.itemId);
  }

  // Only genre_ids is ever read, so only genre_ids is fetched.
  const [movies, series, ratings] = await Promise.all([
    movieIds.length ? Movie.find({ _id: { $in: movieIds } }).select("genre_ids").lean() : [],
    seriesIds.length ? Series.find({ _id: { $in: seriesIds } }).select("genre_ids").lean() : [],
    Rating.find({ user: userId }).select("contentId value updatedAt createdAt").lean(),
  ]);

  const graphs = computeCineGraphs({
    watchlist,
    ratings,
    movieGenres: new Map(movies.map((doc) => [key(doc._id), doc.genre_ids || []])),
    seriesGenres: new Map(series.map((doc) => [key(doc._id), doc.genre_ids || []])),
  });

  await User.updateOne(
    { _id: userId },
    { $set: { movieCineGraph: Object.fromEntries(graphs.movie), seriesCineGraph: Object.fromEntries(graphs.series) } }
  );
}

/**
 * For request handlers: the user's own change has already been saved, so a
 * failed recompute is logged rather than turning a successful request into
 * an error. The next change recomputes the graph from scratch anyway.
 */
export async function refreshUserCineGraph(userId) {
  try {
    await rebuildUserCineGraph(userId);
  } catch (error) {
    console.error(`CineGraph rebuild failed for user ${userId}:`, error.message);
  }
}
