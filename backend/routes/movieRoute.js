// backend/routes/movies.js
export default async function(movieModel) {
  const router = (await import("express")).Router();

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
            index: "default", // Atlas'ta oluşturduğun index ismini yaz
            compound: {
              should: [
                {
                  autocomplete: {
                    query: title,
                    path: "title",
                    fuzzy: {
                      maxEdits: 2, // 2 harf hatasına kadar izin verir
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

      // Diğer filtreleri uygula
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
          $match: { genre_ids: { $in: genreArray } } // Genre ID eşleştirmesi
        });
      }
      if (hasPoster) {
        pipeline.push({
          $match: {
            poster_path: hasPoster === "yes" ? { $ne: null } : null // Poster filtresi
          }
        });
      }

      // Eğer hiçbir filtre yoksa tüm filmleri getir
      if (!title && !years && !genres && !hasPoster) {
        pipeline.push({ $match: {} });
      }

      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: Number(limit) });

      const docs = await movieModel.aggregate(pipeline);

      // toplam doküman sayısı
      const countPipeline = pipeline.filter(p => !('$skip' in p || '$limit' in p));
      countPipeline.push({ $count: "total" });
      const countResult = await movieModel.aggregate(countPipeline);
      const total = countResult[0]?.total || docs.length;

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
