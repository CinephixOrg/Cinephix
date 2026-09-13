import mongoose from "mongoose";
import { MOVIE_GENRE_MAP, SERIES_GENRE_MAP } from "./genreConstants.js";

// Recomputes a user's genre affinity maps from their ratings.
//
// Lifted out of userController's import handlers, where it issued one
// findById per rating inside a loop — a 900-rating library meant 900
// sequential round trips, which was the dominant cost of finishing an
// import. The work is the same; it is now two queries regardless of size.

export async function rebuildUserCineGraph(userId) {
  const User = mongoose.model("User");
  const Rating = mongoose.model("Rating");
  const Movie = mongoose.model("Movie");
  const Series = mongoose.model("Series");

  const user = await User.findById(userId);
  if (!user) return;

  const ratings = await Rating.find({ user: userId }).select("contentId contentType value").lean();

  const movieIds = [];
  const seriesIds = [];
  for (const rating of ratings) {
    if (rating.contentType === "movie") movieIds.push(rating.contentId);
    else seriesIds.push(rating.contentId);
  }

  // Only genre_ids is ever read, so only genre_ids is fetched.
  const [movies, series] = await Promise.all([
    movieIds.length ? Movie.find({ _id: { $in: movieIds } }).select("genre_ids").lean() : [],
    seriesIds.length ? Series.find({ _id: { $in: seriesIds } }).select("genre_ids").lean() : [],
  ]);

  const movieGenres = new Map(movies.map((doc) => [String(doc._id), doc.genre_ids || []]));
  const seriesGenres = new Map(series.map((doc) => [String(doc._id), doc.genre_ids || []]));

  const movieGraph = new Map();
  const seriesGraph = new Map();

  const accumulate = (graph, genre, value) => {
    const node = graph.get(genre) || { count: 0, avgRating: 0 };
    const count = node.count + 1;
    const avg = (node.avgRating * node.count + value) / count;
    graph.set(genre, { count, avgRating: Number(avg.toFixed(2)) });
  };

  for (const rating of ratings) {
    const isMovie = rating.contentType === "movie";
    const ids = (isMovie ? movieGenres : seriesGenres).get(String(rating.contentId));
    if (!ids || ids.length === 0) continue;
    const nameMap = isMovie ? MOVIE_GENRE_MAP : SERIES_GENRE_MAP;
    const graph = isMovie ? movieGraph : seriesGraph;
    for (const id of ids) {
      const genre = nameMap[id];
      if (genre) accumulate(graph, genre, rating.value);
    }
  }

  user.movieCineGraph = movieGraph;
  user.seriesCineGraph = seriesGraph;
  await user.save();
}
