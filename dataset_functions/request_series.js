import fetch from "node-fetch";
import fs from "fs";
import pLimit from "p-limit";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.TMDB_API_KEY;
const BASE_URL = "https://api.themoviedb.org/3";
const limit = pLimit(5);

const startYear = 1900;
const endYear = 2025;

const folder = "all_series";
if (!fs.existsSync(folder)) fs.mkdirSync(folder);

async function getSeriesByYear(year, page=1) {
    const url = `${BASE_URL}/discover/tv?api_key=${API_KEY}&language=en-US&first_air_date_year=${year}&page=${page}`;
    const res = await fetch(url);
    return res.json();
}

async function fetchSeriesYear(year) {
    let page = 1;
    let totalPages = 1;
    const allSeries = [];

    do {
        const data = await getSeriesByYear(year, page);
        if (!data || !data.results) break;

        allSeries.push(...data.results);
        totalPages = data.total_pages || 1;
        console.log(`Year ${year} - Page ${page}/${totalPages} fetched`);
        page++;
    } while (page <= totalPages);

    fs.writeFileSync(`${folder}/series_${year}.json`, JSON.stringify(allSeries, null, 2));
    console.log(`Year ${year} saved with ${allSeries.length} series`);
}

(async () => {
    const tasks = [];
    for (let year = startYear; year <= endYear; year++) {
        tasks.push(limit(() => fetchSeriesYear(year)));
    }
    await Promise.all(tasks);
    console.log("All years fetched and saved in 'all_series' folder!");
})();
