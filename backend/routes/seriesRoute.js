export default async function (seriesModel) {
  const router = (await import("express")).Router();

  // GET /api/series?year=2025&genre=Drama&name=breaking&page=1&limit=18
  router.get("/", async (req, res) => {
    try {
      const { page = 1, limit = 18, year, genre, name } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const pipeline = [];

      // 🔹 Atlas Search: fuzzy + autocomplete
      if (name) {
        pipeline.push({
          $search: {
            index: "default", // kendi index adın
            compound: {
              should: [
                {
                  autocomplete: {
                    query: name,
                    path: "name",
                    fuzzy: { maxEdits: 2, prefixLength: 1 },
                  },
                },
                {
                  text: {
                    query: name,
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
      if (year) match.first_air_date = { $regex: `^${year}` };
      if (genre) match.genre = { $regex: genre, $options: "i" };
      if (Object.keys(match).length > 0) pipeline.push({ $match: match });

      // 🔹 Sayfalama
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: Number(limit) });

      // 🔹 Asıl veri
      const docs = await seriesModel.aggregate(pipeline);

      // 🔹 Toplam kayıt sayısı (pagination için)
      const countPipeline = pipeline.filter(
        (p) => !("$skip" in p || "$limit" in p)
      );
      countPipeline.push({ $count: "total" });
      const countResult = await seriesModel.aggregate(countPipeline);
      const total = countResult[0]?.total || docs.length;

      res.json({ total, page: Number(page), limit: Number(limit), results: docs });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/series/:id
  router.get("/:id", async (req, res) => {
    try {
      const doc = await seriesModel.findById(req.params.id);
      if (!doc) return res.status(404).json({ error: "Not found" });
      res.json(doc);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
