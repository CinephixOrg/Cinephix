import mongoose from "mongoose";
import User from "../models/User.js";
import Rating from "../models/Rating.js";

/* ---------- yardımcı matematik ---------- */

const cosineSimilarity = (a, b) => {
  let dot = 0, normA = 0, normB = 0;
  for (const k in a) {
    dot += (a[k] || 0) * (b[k] || 0);
    normA += (a[k] || 0) ** 2;
    normB += (b[k] || 0) ** 2;
  }
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
};

const avgRatingSimilarity = (a, b) => {
  let diff = 0, count = 0;
  for (const k in a) {
    if (b[k] !== undefined) {
      diff += Math.abs(a[k] - b[k]);
      count++;
    }
  }
  if (!count) return 0;
  return 1 - diff / (count * 10); // normalize
};

/* ---------- MAIN ---------- */

export const findMatches = async (req, res) => {
  const {
    type,                 // movie | series
    genres = [],          // [] or ["Drama", "Action"]
    useCount = true,
    useAvgRating = true
  } = req.body;

  const meId = req.user.id;
  const cineKey = type === "movie" ? "movieCineGraph" : "seriesCineGraph";

  try {
    const me = await User.findById(meId).lean();
    if (!me || !me[cineKey]) return res.json([]);

    const myGraph = me[cineKey];

    const others = await User.find({ _id: { $ne: meId } })
      .select(`username profile_pic_url ${cineKey}`)
      .lean();

    const results = [];

    for (const u of others) {
      if (!u[cineKey]) continue;

      const g1 = {};
      const g2 = {};
      const r1 = {};
      const r2 = {};

      for (const [genre, v] of Object.entries(myGraph)) {
        if (genres.length && !genres.includes(genre)) continue;
        if (useCount) g1[genre] = v.count;
        if (useAvgRating) r1[genre] = v.avgRating;
      }

      for (const [genre, v] of Object.entries(u[cineKey])) {
        if (genres.length && !genres.includes(genre)) continue;
        if (useCount) g2[genre] = v.count;
        if (useAvgRating) r2[genre] = v.avgRating;
      }

      const genreScore = useCount ? cosineSimilarity(g1, g2) : 0;
      const ratingScore = useAvgRating ? avgRatingSimilarity(r1, r2) : 0;

      const finalScore =
        (useCount ? 0.4 * genreScore : 0) +
        (useAvgRating ? 0.4 * ratingScore : 0);

      results.push({
        user: {
          _id: u._id,
          username: u.username,
          profile_pic_url: u.profile_pic_url,
        },
        matchPercentage: Math.round(finalScore * 100),
      });
    }

    results.sort((a, b) => b.matchPercentage - a.matchPercentage);
    res.json(results.slice(0, 10));

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Hybrid match failed" });
  }
};
