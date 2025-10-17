// backend/routes/movies.js
export default async function(movieModel) {
  const router = (await import("express")).Router();

  // GET /api/movies?year=2020&genre=Drama&title=star&page=1&limit=20
 router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 50, year, genre, title } = req.query;
    const filter = {};

    // --- DÜZELTME BURADA ---
    // Eğer bir 'year' parametresi geldiyse, 'release_date' alanında
    // bu yılla başlayan kayıtları bulmak için bir regular expression (regex) kullan.
    if (year) {
      filter.release_date = { $regex: `^${year}` };
    }
    
    if (genre) filter.genre = { $regex: genre, $options: "i" }; // Bu satırlar doğru varsayılıyor
    if (title) filter.title = { $regex: title, $options: "i" };

    const skip = (Number(page) - 1) * Number(limit);
    const docs = await movieModel.find(filter).skip(skip).limit(Number(limit));
    const total = await movieModel.countDocuments(filter);
    
    res.json({ total, page: Number(page), limit: Number(limit), results: docs });
  } catch (e) {
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
