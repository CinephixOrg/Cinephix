// One-off (but re-runnable) content-population script for the dev/test
// database — NOT for production. Populates realistic-looking activity
// across existing test accounts (never fabricates new fake user accounts —
// that's a deliberately different, higher-risk thing this session's own
// discussion ruled out) so Medya's feed and Discover's podiums/rails don't
// read as empty while testing. Idempotent-ish: checks for existing
// ratings/watchlist/favorite entries before adding, so re-running it just
// tops things up rather than duplicating.
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import User from "../models/User.js";
import Rating from "../models/Rating.js";
import Review from "../models/Review.js";
import Share from "../models/Share.js";
import CustomList from "../models/CustomList.js";

await mongoose.connect(process.env.MONGO_URI);
const Movie = mongoose.connection.model("Movie", new mongoose.Schema({}, { strict: false }), "movies");
const Series = mongoose.connection.model("Series", new mongoose.Schema({}, { strict: false }), "series");

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function sample(arr, n) {
  const copy = [...arr];
  const out = [];
  while (copy.length && out.length < n) {
    out.push(copy.splice(randInt(0, copy.length - 1), 1)[0]);
  }
  return out;
}
function choice(arr) {
  return arr[randInt(0, arr.length - 1)];
}

async function hydrateContentData(contentId, contentType) {
  const model = contentType === "movie" ? Movie : Series;
  const doc = await model.findById(contentId).select("title name poster_path release_date first_air_date").lean();
  if (!doc) return null;
  const date = contentType === "movie" ? doc.release_date : doc.first_air_date;
  return { title: doc.title || doc.name, posterUrl: doc.poster_path || null, releaseYear: date ? new Date(date).getFullYear() : undefined };
}

// ── 1. Curated, real, recent, recognizable pool (not "çok eski") ──
// Resolved to real _ids below by exact title+date match — avoids ambiguity
// in a 578k-movie/166k-series dataset with many same-named entries.
const MOVIE_PICKS = [
  ["Avengers: Infinity War", "2018-04-25"],
  ["Ready Player One", "2018-03-28"],
  ["Deadpool 2", "2018-05-15"],
  ["Pacific Rim: Uprising", "2018-03-21"],
  ["The Odyssey", "2026-07-15"],
  ["Disclosure Day", "2026-06-10"],
  ["Moana", "2026-07-08"],
  ["Minions & Monsters", "2026-06-24"],
  ["Toy Story 5", "2026-06-17"],
  ["The Mandalorian and Grogu", "2026-05-20"],
  ["Masters of the Universe", "2026-06-03"],
  ["Project Hail Mary", "2026-03-15"],
  ["The Devil Wears Prada 2", "2026-04-29"],
  ["Spider-Man: Brand New Day", "2026-07-28"],
  ["Deep Water", "2026-04-30"],
  ["Michael", "2026-04-22"],
  ["Mortal Kombat II", "2026-05-06"],
  ["The Super Mario Galaxy Movie", "2026-04-01"],
];
const SERIES_PICKS = [
  ["House of the Dragon", "2022-08-21"],
  ["Silo", "2023-05-04"],
  ["FROM", "2022-02-20"],
  ["The Boys", "2019-07-25"],
  ["Reacher", "2022-02-03"],
  ["Avatar: The Last Airbender", "2024-02-22"],
  ["JUJUTSU KAISEN", "2020-10-03"],
  ["X-Men '97", "2024-03-20"],
];

const movieDocs = [];
for (const [title, date] of MOVIE_PICKS) {
  const doc = await Movie.findOne({ title, release_date: date }).select("_id title poster_path").lean();
  if (doc) movieDocs.push({ _id: doc._id.toString(), title: doc.title, itemType: "movie", poster_path: doc.poster_path });
}
const seriesDocs = [];
for (const [name, date] of SERIES_PICKS) {
  const doc = await Series.findOne({ name, first_air_date: date }).select("_id name poster_path").lean();
  if (doc) seriesDocs.push({ _id: doc._id.toString(), title: doc.name, itemType: "series", poster_path: doc.poster_path });
}
const CONTENT_POOL = [...movieDocs, ...seriesDocs];
console.log(`Resolved content pool: ${movieDocs.length} movies, ${seriesDocs.length} series`);

// ── 2. Working set of active users — Zachary's network + more, per
// explicit permission to go beyond just his followers ──
const zachary = await User.findById("691f53a845194a18bc31db24").select("username following favoriteMovies favoriteSeries").lean();
const zacharyFavoriteIds = [...(zachary.favoriteMovies || []), ...(zachary.favoriteSeries || [])].map((id) => id.toString());

const followingIds = (zachary.following || []).map((id) => id.toString());
const extraUsers = await User.find({ _id: { $nin: [...followingIds, zachary._id.toString()] } })
  .select("_id")
  .limit(15)
  .lean();
const activeUserIds = [...followingIds, ...extraUsers.map((u) => u._id.toString())];
console.log(`Active user set: ${activeUserIds.length} users`);

const REVIEW_SNIPPETS = [
  "Honestly didn't expect to like this as much as I did — the pacing really pulled me in.",
  "A solid watch. Not perfect, but the performances carry it.",
  "This one's going to stick with me for a while. Genuinely well done.",
  "Mixed feelings — great first half, lost me a bit toward the end.",
  "Exactly what I needed this week. Comfort watch material.",
  "The visuals alone are worth it, but the story holds up too.",
  "Rewatched this and it's even better the second time around.",
  "Not for everyone, but if you're into this genre, don't skip it.",
];

let ratingsAdded = 0,
  reviewsAdded = 0,
  recommendsAdded = 0,
  favoritesAdded = 0,
  listsAdded = 0;

for (const userId of activeUserIds) {
  const user = await User.findById(userId).select("watchlist favoriteMovies favoriteSeries").lean();
  if (!user) continue;

  const alreadyWatchedIds = new Set((user.watchlist || []).map((w) => w.itemId.toString()));
  const alreadyFavoriteIds = new Set([...(user.favoriteMovies || []), ...(user.favoriteSeries || [])].map((id) => id.toString()));
  const alreadyRated = new Set((await Rating.find({ user: userId }).select("contentId").lean()).map((r) => r.contentId));

  // Bias picks toward the shared pool (concentration for podiums/trending)
  // with a couple of extra random-pool picks thrown in per user so it
  // doesn't look like literally everyone watched the exact same 26 things.
  const picksForThisUser = sample(CONTENT_POOL, randInt(2, 4));

  // A. Rated watch — ~75% of active users
  if (Math.random() < 0.75) {
    for (const item of picksForThisUser) {
      if (alreadyRated.has(item._id)) continue;
      const value = randInt(6, 10); // skews positive — these are curated, well-known picks
      await Rating.create({ user: userId, contentId: item._id, contentType: item.itemType, value });
      alreadyRated.add(item._id);
      ratingsAdded++;

      if (!alreadyWatchedIds.has(item._id)) {
        await User.updateOne(
          { _id: userId },
          { $push: { watchlist: { itemId: item._id, itemType: item.itemType, addedAt: new Date(Date.now() - randInt(0, 20) * 86400000) } } }
        );
        alreadyWatchedIds.add(item._id);
      }
    }
  }

  // B. Review + share it — ~35%
  if (Math.random() < 0.35 && picksForThisUser.length) {
    const item = choice(picksForThisUser);
    const existingReview = await Review.findOne({ user: userId, contentId: item._id }).lean();
    if (!existingReview) {
      const review = await Review.create({ user: userId, contentId: item._id, contentType: item.itemType, text: choice(REVIEW_SNIPPETS) });
      const contentData = await hydrateContentData(item._id, item.itemType);
      const rating = await Rating.findOne({ user: userId, contentId: item._id }).select("value").lean();
      if (contentData) {
        await Share.create({
          user: userId,
          type: "review",
          reviewText: review.text,
          reviewRating: rating?.value ?? null,
          contentId: item._id,
          contentType: item.itemType,
          contentData,
        });
        reviewsAdded++;
      }
    }
  }

  // C. Recommendation post — ~35%
  if (Math.random() < 0.35) {
    const item = choice(CONTENT_POOL);
    const contentData = await hydrateContentData(item._id, item.itemType);
    if (contentData) {
      await Share.create({ user: userId, type: "recommendation", contentId: item._id, contentType: item.itemType, contentData });
      recommendsAdded++;
    }
  }

  // D. Favorites — ~50%, sometimes deliberately overlapping Zachary's own
  // (real similarity signal, not just coincidence) rather than always
  // random.
  if (Math.random() < 0.5) {
    const useZacharyOverlap = zacharyFavoriteIds.length > 0 && Math.random() < 0.4 && userId !== zachary._id.toString();
    const favoriteCandidates = useZacharyOverlap
      ? sample(
          CONTENT_POOL.filter((c) => zacharyFavoriteIds.includes(c._id)),
          randInt(1, 2)
        )
      : sample(CONTENT_POOL, randInt(1, 3));
    for (const item of favoriteCandidates) {
      if (alreadyFavoriteIds.has(item._id)) continue;
      const field = item.itemType === "movie" ? "favoriteMovies" : "favoriteSeries";
      await User.updateOne({ _id: userId }, { $addToSet: { [field]: item._id } });
      alreadyFavoriteIds.add(item._id);
      favoritesAdded++;
    }
  }

  // E. Create + share a public list — ~25%
  if (Math.random() < 0.25) {
    const items = sample(CONTENT_POOL, randInt(3, 6)).map((item) => ({ itemId: item._id, itemType: item.itemType }));
    if (items.length) {
      const list = await CustomList.create({
        owner: userId,
        name: choice(["My Current Watchlist Picks", "Weekend Watch Party", "Underrated Gems", "Can't Stop Recommending These", "Late Night Favorites"]),
        description: "",
        isPublic: true,
        items,
      });
      const listLean = await CustomList.findById(list._id).lean();
      const previewSlice = listLean.items.slice(0, 5);
      const previewItems = previewSlice
        .map((pi) => {
          const doc = CONTENT_POOL.find((c) => c._id === pi.itemId.toString());
          return doc ? { itemId: pi.itemId.toString(), itemType: pi.itemType, title: doc.title, poster_path: doc.poster_path } : null;
        })
        .filter(Boolean);
      await Share.create({
        user: userId,
        type: "list",
        listId: list._id,
        listData: { name: list.name, description: list.description, itemCount: list.items.length, previewItems },
      });
      listsAdded++;
    }
  }
}

console.log(`\nAdded: ${ratingsAdded} ratings, ${reviewsAdded} review-shares, ${recommendsAdded} recommend-shares, ${favoritesAdded} favorites, ${listsAdded} list-shares`);

// ── 3. Views + likes on every Share (old and new) — "postlar birçok kişi
// tarafından görülmüş ve beğenilmiş olsun" ──
const allShares = await Share.find({}).select("_id user views likes").lean();
let viewsAdded = 0,
  likesAdded = 0;
for (const share of allShares) {
  const authorId = share.user.toString();
  const candidateViewers = activeUserIds.filter((id) => id !== authorId);
  const existingViewerIds = new Set((share.views || []).map((id) => id.toString()));
  const newViewers = sample(
    candidateViewers.filter((id) => !existingViewerIds.has(id)),
    randInt(2, 12)
  );
  if (newViewers.length === 0) continue;

  const existingLikerIds = new Set((share.likes || []).map((id) => id.toString()));
  const newLikers = sample(newViewers, randInt(0, Math.ceil(newViewers.length * 0.6)));

  const updatedViews = [...existingViewerIds, ...newViewers];
  const updatedLikes = [...existingLikerIds, ...newLikers.filter((id) => !existingLikerIds.has(id))];

  await Share.updateOne({ _id: share._id }, { $set: { views: updatedViews, viewCount: updatedViews.length, likes: updatedLikes, likeCount: updatedLikes.length } });
  viewsAdded += newViewers.length;
  likesAdded += newLikers.length;
}
console.log(`Distributed ${viewsAdded} new views and ${likesAdded} new likes across ${allShares.length} shares`);

await mongoose.disconnect();
console.log("\nDone.");
