// backend/routes/movies.js
import mongoose from "mongoose";
import authMiddleware from "../middleware/authMiddleware.js";
import { buildFuzzyTitleSearchStage, combinedScoreSortStages } from "../utils/atlasSearch.js";
import { ORIGINAL_TITLE_PROJECTION } from "../utils/catalogTitles.js";
import { productionCountries } from "../services/tmdbTitles.js";

// User text going into a hand-built $regex must be escaped first — an
// unescaped string lets a caller inject regex metacharacters (at best
// unintended matches, at worst a ReDoS-shaped pattern). Same helper as
// customListRoute.js/reviewController.js already use, duplicated locally
// rather than shared, matching this codebase's existing convention for this
// exact one-liner.
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default async function(movieModel) {
  const router = (await import("express")).Router();

  // GET /api/movies/search?q=query
  router.get("/search", async (req, res) => {
    try {
      const { q } = req.query;
      
      if (!q || q.trim().length === 0) {
        return res.json({
          success: true,
          data: []
        });
      }

      const pipeline = [
        buildFuzzyTitleSearchStage(q, "title"),
        { $limit: 150 },
        ...combinedScoreSortStages(),
        { $limit: 20 },
        {
          $project: {
            _id: 1,
            title: 1,
            ...ORIGINAL_TITLE_PROJECTION,
            posterUrl: {
              $cond: [
                { $ifNull: ["$poster_path", false] },
                { $concat: ["https://image.tmdb.org/t/p/w154", "$poster_path"] },
                null
              ]
            },
            releaseYear: { $substr: ["$release_date", 0, 4] },
            genres: "$genre_ids",
            overview: 1,
            vote_average: 1
          }
        },

      ];

      const results = await movieModel.aggregate(pipeline).allowDiskUse(true);
      res.json({
        success: true,
        data: results
      });
    } catch (e) {
      res.status(500).json({
        success: false,
        message: "Search failed",
        error: e.message
      });
    }
  });

  // GET /api/movies?years=2020,2021&genres=Drama,Action&title=star&page=1&limit=20
  router.get("/", async (req, res) => {
    try {
      const { page = 1, limit = 18, years, genres, title, hasPoster } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const pipeline = [];

      // 🔹 Atlas Search fuzzy query
      if (title) {
        pipeline.push(buildFuzzyTitleSearchStage(title, "title"));
        // Real bug this order used to have: years/genres/hasPoster were
        // $matched *after* this $limit, so a title that fuzzy-matches more
        // than 200 documents could have valid genre/year matches silently
        // dropped just because they ranked outside the top 200 by pure text
        // relevance — filters now apply first, against the full $search
        // result set, before it's ever truncated.
      }

      // Apply other filters
      if (years) {
        const yearArray = years.split(",").map((y) => escapeRegex(y));
        pipeline.push({
          $match: {
            release_date: { $regex: new RegExp(`^(${yearArray.join("|")})`) }
          }
        });
      }
      if (genres) {
        const genreArray = genres.split(",").map(Number);
        pipeline.push({
          $match: { genre_ids: { $in: genreArray } } // Genre ID matching
        });
      }
      // Explicit "yes"/"no" check (matches seriesRoute.js's own handling) —
      // any *other* truthy value used to silently fall into the "no poster"
      // branch instead of being ignored.
      if (hasPoster === "yes") {
        pipeline.push({ $match: { poster_path: { $ne: null } } });
      } else if (hasPoster === "no") {
        pipeline.push({ $match: { poster_path: null } });
      }

      if (title) {
        pipeline.push({ $limit: 200 }); // Fast limit for Atlas Search, now after filters
        pipeline.push(...combinedScoreSortStages());
      } else {
        // Sort results by popularity and newest when no search query
        pipeline.push({
          $sort: { popularity: -1, vote_count: -1, release_date: -1 }
        });
      }

      // Real bug this cap used to cause: it ran *before* $facet's own
      // $count, so `pagination.total`/`pages` were silently capped at 2000
      // regardless of how many documents actually matched — verified live
      // against this exact dataset (578k movies): genre 35 (Comedy) alone
      // has 113,938 real matches, every one of them past the first 2000 was
      // completely unreachable no matter how far a viewer paginated.
      // $facet already runs under `.allowDiskUse(true)` below, which is the
      // actual mechanism for the memory concern this cap was trying to
      // guard against — removed rather than shrunk.

      // 🔹 Optimize: Only select needed fields for search results
      pipeline.push({
        $project: {
          _id: 1,
          title: 1,
          ...ORIGINAL_TITLE_PROJECTION,
          poster_path: 1,
          release_date: 1,
          overview: 1,
          vote_average: 1,
          genre_ids: 1
        }
      });

      // 🔹 Use $facet to get both data AND count in ONE aggregation (much faster!)
      pipeline.push({
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $skip: skip },
            { $limit: Number(limit) }
          ]
        }
      });

      const result = await movieModel.aggregate(pipeline).allowDiskUse(true);
      const total = result[0]?.metadata[0]?.total || 0;
      const docs = result[0]?.data || [];

      res.json({
        success: true,
        message: 'Movies fetched',
        data: docs,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Math.max(Number(limit), 1))
        }
      });
    } catch (e) {
      res.status(500).json({
        success: false,
        message: 'Error fetching movies',
        error: e.message
      });
    }
  });

  // POST /api/movies/bulk
  router.post("/bulk", authMiddleware, async (req, res) => {
    try {
      const { ids, lightweight } = req.body;
      if (!ids || !Array.isArray(ids)) {
        return res.status(400).json({
          success: false,
          message: "IDs must be provided as an array"
        });
      }

      const objectIds = ids.map(id => new mongoose.Types.ObjectId(id));
      
      let query = movieModel.find({ _id: { $in: objectIds } });
      if (lightweight) {
        query = query.select("_id title name poster_path vote_average popularity first_air_date release_date tvdb id genre_ids");
      }
      
      console.time("movie_bulk_query");
      const movies = await query.lean();
      console.timeEnd("movie_bulk_query");

      return res.json({
        success: true,
        data: movies
      });
    } catch (e) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch bulk movies",
        error: e.message
      });
    }
  });

  // GET /api/movies/:id
  router.get("/:id", async (req, res) => {
    try {
      const found = await movieModel.findById(req.params.id).lean();
      if (!found) {
        return res.status(404).json({
          success: false,
          message: 'Movie not found'
        });
      }
      // The detail page shows where it was made, which the catalog doesn't
      // carry: from TMDB, never stored (services/tmdbTitles.js).
      const doc = { ...found, production_countries: await productionCountries(movieModel, found, "movie") };
      res.json({
        success: true,
        message: 'Movie fetched',
        data: doc
      });
    } catch (e) {
      res.status(500).json({
        success: false,
        message: 'Error fetching movie',
        error: e.message
      });
    }
  });

  return router;
}
