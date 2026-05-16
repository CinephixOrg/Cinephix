// backend/routes/movies.js
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
        {
          $search: {
            index: "default",
            compound: {
              should: [
                {
                  autocomplete: {
                    query: q,
                    path: "title",
                    fuzzy: {
                      maxEdits: 2,
                      prefixLength: 1
                    }
                  }
                },
                {
                  text: {
                    query: q,
                    path: "title",
                    fuzzy: {
                      maxEdits: 2
                    }
                  }
                }
              ]
            }
          }
        },
        {
          $project: {
            _id: 1,
            title: 1,
            posterUrl: "$poster_path",
            releaseYear: { $substr: ["$release_date", 0, 4] },
            genres: "$genre_ids",
            overview: 1,
            vote_average: 1
          }
        },
        {
          $limit: 20
        }
      ];

      const results = await movieModel.aggregate(pipeline);
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
        pipeline.push({
          $search: {
            index: "default", // Atlas index name
            compound: {
              should: [
                {
                  autocomplete: {
                    query: title,
                    path: "title",
                    fuzzy: {
                      maxEdits: 2, // Tolerates up to 2 character errors
                      prefixLength: 1
                    }
                  }
                },
                {
                  text: {
                    query: title,
                    path: "title",
                    fuzzy: {
                      maxEdits: 2
                    }
                  }
                }
              ]
            }
          }
        });
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

      const result = await movieModel.aggregate(pipeline);
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

  // GET /api/movies/:id
  router.get("/:id", async (req, res) => {
    try {
      const doc = await movieModel.findById(req.params.id);
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
