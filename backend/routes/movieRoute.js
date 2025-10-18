// backend/routes/movies.js
export default async function(movieModel) {
  const router = (await import("express")).Router();

  // GET /api/movies?year=2020&genre=Drama&title=star&page=1&limit=20
 router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 18, year, genre, title } = req.query;
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
    if (year) {
      pipeline.push({
        $match: { release_date: { $regex: `^${year}` } }
      });
    }
    if (genre) {
      pipeline.push({
        $match: { genre: { $regex: genre, $options: "i" } }
      });
    }

    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: Number(limit) });

    const docs = await movieModel.aggregate(pipeline);

    // toplam doküman sayısı
    const countPipeline = pipeline.filter(p => !('$skip' in p || '$limit' in p));
    countPipeline.push({ $count: "total" });
    const countResult = await movieModel.aggregate(countPipeline);
    const total = countResult[0]?.total || docs.length;

    res.json({ total, page: Number(page), limit: Number(limit), results: docs });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

  // GET /api/movies/:id
  router.get("/:id", async (req, res) => {
    try {
      const doc = await movieModel.findById(req.params.id);
      if (!doc) return res.status(404).json({ error: "Not found" });
      res.json(doc);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
