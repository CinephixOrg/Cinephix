// backend/routes/movies.js
import mongoose from "mongoose";
import authMiddleware from "../middleware/authMiddleware.js";

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

      const safeQ = q.replace(/[^\w\s]/gi, '');
      const queryTokens = safeQ.split(/\s+/).filter(w => w);
      const queryStr = queryTokens.length > 0 ? queryTokens.map(w => `${w}*`).join(" AND ") : "";

      const shouldArray = [
        {
          autocomplete: {
            query: q,
            path: "title"
          }
        },
        {
          text: {
            query: q,
            path: "title",
            fuzzy: {
              maxEdits: 1,
              prefixLength: 2 // Sadece 3 harf ve üstü kelimelerde harf hatasına izin verir
            }
          }
        }
      ];

      if (queryStr) {
        shouldArray.push({
          queryString: {
            defaultPath: "title",
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
            title: 1,
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
        const safeTitle = title.replace(/[^\w\s]/gi, '');
        const titleTokens = safeTitle.split(/\s+/).filter(w => w);
        const titleQueryStr = titleTokens.length > 0 ? titleTokens.map(w => `${w}*`).join(" AND ") : "";

        const shouldArray = [
          {
            autocomplete: {
              query: title,
              path: "title"
            }
          },
          {
            text: {
              query: title,
              path: "title",
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
              defaultPath: "title",
              query: titleQueryStr
            }
          });
        }

        pipeline.push({
          $search: {
            index: "default", // Atlas index name
            compound: {
              should: shouldArray
            }
          }
        });
        pipeline.push({ $limit: 200 }); // Fast limit for Atlas Search
      }

      // Apply other filters
      if (years) {
        const yearArray = years.split(",");
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
      if (hasPoster) {
        pipeline.push({
          $match: {
            poster_path: hasPoster === "yes" ? { $ne: null } : null // Poster filteri
          }
        });
      }

      // If no filter exists, get all movies
      if (!title && !years && !genres && !hasPoster) {
        pipeline.push({ $match: {} });
      }

      if (title) {
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
          $sort: { popularity: -1, vote_count: -1, release_date: -1 }
        });
      }

      // 🔹 Prevent $facet memory issues by capping results to top 2000
      pipeline.push({ $limit: 2000 });

      // 🔹 Optimize: Only select needed fields for search results
      pipeline.push({
        $project: {
          _id: 1,
          title: 1,
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
        query = query.select("_id title name poster_path vote_average first_air_date release_date tvdb id genre_ids");
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
      const doc = await movieModel.findById(req.params.id).lean();
      if (!doc) {
        return res.status(404).json({
          success: false,
          message: 'Movie not found'
        });
      }
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
