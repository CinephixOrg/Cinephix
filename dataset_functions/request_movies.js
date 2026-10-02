import fetch from "node-fetch";
import fs from "fs";
import pLimit from "p-limit";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.TMDB_API_KEY;
const BASE_URL = "https://api.themoviedb.org/3";
const limit = pLimit(5); // aynı anda max 5 istek

const startYear = 1900;
const endYear = 2025;

// all_movies klasörü yoksa oluştur
const folder = "all_movies";
if (!fs.existsSync(folder)) {
  fs.mkdirSync(folder);
}

// Sayfa verisini çek
async function getMoviesByYear(year, page = 1) {
  const url = `${BASE_URL}/discover/movie?api_key=${API_KEY}&language=en-US&primary_release_year=${year}&page=${page}`;
  const res = await fetch(url);
  return res.json();
}

async function fetchYear(year) {
  let page = 1;
  let totalPages = 1;
  const allMovies = [];

  do {
    const data = await getMoviesByYear(year, page);

    if (!data || !data.results) {
      console.log(`No results for year ${year}, page ${page}`);
      break;
    }

    allMovies.push(...data.results);
    totalPages = data.total_pages || 1;
    console.log(`Year ${year} - Page ${page}/${totalPages} fetched`);
    page++;
  } while (page <= totalPages);

  // Yıl bazlı JSON dosyası kaydet
  const filePath = `${folder}/movies_${year}.json`;
  fs.writeFileSync(filePath, JSON.stringify(allMovies, null, 2));
  console.log(`Year ${year} saved with ${allMovies.length} movies`);
}

// Tüm yılları paralel sınırlı şekilde çalıştır
(async () => {
  const tasks = [];
  for (let year = startYear; year <= endYear; year++) {
    tasks.push(limit(() => fetchYear(year)));
  }
  await Promise.all(tasks);
  console.log("All years fetched and saved in 'all_movies' folder!");
})();
