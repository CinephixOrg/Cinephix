import mongoose from "mongoose";
import authMiddleware from "../middleware/authMiddleware.js";

export default async function (seriesModel) {
  const router = (await import("express")).Router();

  // GET /api/series/search?q=query
  router.get("/search", async (req, res) => {
    try {
      const { q } = req.query;
      
      if (!q || q.trim().length === 0) {
        return res.json({
          success: true,
          data: []
        });
      }

      const safeQ = q.replace(/[^\w\s]/gi, '');
      const queryTokens = safeQ.split(/\s+/).filter(w => w);
      const queryStr = queryTokens.length > 0 ? queryTokens.map(w => `${w}*`).join(" AND ") : "";

      const shouldArray = [
        {
          autocomplete: {
            query: q,
            path: "name"
          }
        },
        {
          text: {
            query: q,
            path: "name",
            fuzzy: {
              maxEdits: 1,
              prefixLength: 2
            }
          }
        }
      ];

      if (queryStr) {
        shouldArray.push({
          queryString: {
            defaultPath: "name",
            query: queryStr
          }
        });
      }

      const pipeline = [
        {
          $search: {
            index: "default",
            compound: {
              should: shouldArray
            }
          }
        },
        { $limit: 150 },
        {
          $addFields: {
            combinedScore: {
              $multiply: [
                { $meta: "searchScore" },
                { $add: [{ $ifNull: ["$popularity", 1] }, 1] }
              ]
            }
          }
        },
        { $sort: { combinedScore: -1 } },
        { $limit: 20 },
        {
          $project: {
            _id: 1,
            title: "$name",
            posterUrl: {
              $cond: [
                { $ifNull: ["$poster_path", false] },
                { $concat: ["https://image.tmdb.org/t/p/w154", "$poster_path"] },
                null
              ]
            },
            releaseYear: { $substr: ["$first_air_date", 0, 4] },
            genres: "$genre_ids",
            overview: 1,
            vote_average: 1
          }
        },

      ];

      const results = await seriesModel.aggregate(pipeline).allowDiskUse(true);
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

  // GET /api/series?year=2025&genre=Drama&query=breaking&page=1&limit=18
  router.get("/", async (req, res) => {
    try {
      const { page = 1, limit = 18, years, genres, query, hasPoster } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const pipeline = [];

      // 🔹 Atlas Search: fuzzy + autocomplete
      if (query) {
        const safeTitle = query.replace(/[^\w\s]/gi, '');
        const titleTokens = safeTitle.split(/\s+/).filter(w => w);
        const titleQueryStr = titleTokens.length > 0 ? titleTokens.map(w => `${w}*`).join(" AND ") : "";

        const shouldArray = [
          {
            autocomplete: {
              query: query,
              path: "name"
            }
          },
          {
            text: {
              query: query,
              path: "name",
              fuzzy: {
                maxEdits: 1,
                prefixLength: 2
              }
            }
          }
        ];

        if (titleQueryStr) {
          shouldArray.push({
            queryString: {
              defaultPath: "name",
              query: titleQueryStr
            }
          });
        }

        pipeline.push({
          $search: {
            index: "default", // your index name
            compound: {
              should: shouldArray
            }
          }
        });
        pipeline.push({ $limit: 200 }); // Fast limit for Atlas Search
      }

      // 🔹 Ek filtreler
      const match = {};
      if (years) {
        const yearsArray = years.split(",");
        match.first_air_date = {
          $in: yearsArray.map((year) => new RegExp(`^${year}`)),
        };
      }
      if (genres) {
        const genresArray = genres.split(",");
        match.genre_ids = {
          $in: genresArray.map((id) => Number(id)),
        };
      }
      if (hasPoster === "yes") match.poster_path = { $ne: null };
      if (hasPoster === "no") match.poster_path = null;
      if (Object.keys(match).length > 0) pipeline.push({ $match: match });

      if (query) {
        pipeline.push({
          $addFields: {
            combinedScore: {
              $multiply: [
                { $meta: "searchScore" },
                { $add: [{ $ifNull: ["$popularity", 1] }, 1] } // Score * Popularity
              ]
            }
          }
        });
        pipeline.push({ $sort: { combinedScore: -1 } });
      } else {
        // Sort results by popularity and newest when no search query
        pipeline.push({
          $sort: { popularity: -1, vote_count: -1, first_air_date: -1 }
        });
      }

      // 🔹 Prevent $facet memory issues by capping results to top 2000
      pipeline.push({ $limit: 2000 });

      // 🔹 Optimize: Only select needed fields for search results
      pipeline.push({
        $project: {
          _id: 1,
          name: 1,
          poster_path: 1,
          first_air_date: 1,
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

      // 🔹 Execute optimized pipeline
      const result = await seriesModel.aggregate(pipeline).allowDiskUse(true);
      const total = result[0]?.metadata[0]?.total || 0;
      const docs = result[0]?.data || [];

      res.json({
        success: true,
        message: 'Series fetched',
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
        message: 'Error fetching series',
        error: e.message
      });
    }
  });

  // POST /api/series/bulk
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
      
      let query = seriesModel.find({ _id: { $in: objectIds } });
      if (lightweight) {
        query = query.select("_id title name poster_path vote_average first_air_date release_date tvdb id genre_ids");
      }
      
      const series = await query.lean();

      return res.json({
        success: true,
        data: series
      });
    } catch (e) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch bulk series",
        error: e.message
      });
    }
  });

  // GET /api/series/:id
  router.get("/:id", async (req, res) => {
    try {
      const doc = await seriesModel.findById(req.params.id).lean();
      if (!doc) {
        return res.status(404).json({
          success: false,
          message: 'Series not found'
        });
      }
      res.json({
        success: true,
        message: 'Series fetched',
        data: doc
      });
    } catch (e) {
      res.status(500).json({
        success: false,
        message: 'Error fetching series',
        error: e.message
      });
    }
  });

  return router;
}
