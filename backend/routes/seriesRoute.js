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

      const pipeline = [
        {
          $search: {
            index: "default",
            compound: {
              should: [
                {
                  autocomplete: {
                    query: q,
                    path: "name",
                    fuzzy: {
                      maxEdits: 2,
                      prefixLength: 1
                    }
                  }
                },
                {
                  text: {
                    query: q,
                    path: "name",
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
            title: "$name",
            posterUrl: "$poster_path",
            releaseYear: { $substr: ["$first_air_date", 0, 4] },
            genres: "$genre_ids",
            overview: 1,
            vote_average: 1
          }
        },
        {
          $limit: 20
        }
      ];

      const results = await seriesModel.aggregate(pipeline);
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
        pipeline.push({
          $search: {
            index: "default", // your index name
            compound: {
              should: [
                {
                  autocomplete: {
                    query: query,
                    path: "name",
                    fuzzy: { maxEdits: 2, prefixLength: 1 },
                  },
                },
                {
                  text: {
                    query: query,
                    path: "name",
                    fuzzy: { maxEdits: 2 },
                  },
                },
              ],
            },
          },
        });
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
      const result = await seriesModel.aggregate(pipeline);
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

  // GET /api/series/:id
  router.get("/:id", async (req, res) => {
    try {
      const doc = await seriesModel.findById(req.params.id);
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
