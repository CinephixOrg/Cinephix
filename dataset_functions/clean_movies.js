import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const folder = path.join(__dirname, 'all_movies');
const startYear = 1900;
const endYear = 2025;
const removeAttrs = [
  'adult',
  'backdrop_path',
  'original_title',
  'popularity',
  'video',
  'vote_average',
  'vote_count'
];

for (let year = startYear; year <= endYear; year++) {
  const file = path.join(folder, `movies_${year}.json`);
  if (fs.existsSync(file)) {
    console.log(`Temizleniyor: movies_${year}.json`);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const cleaned = data.map(movie => {
      removeAttrs.forEach(attr => delete movie[attr]);
      return movie;
    });
    fs.writeFileSync(file, JSON.stringify(cleaned, null, 2), 'utf8');
    console.log(`Temizlendi: movies_${year}.json`);
  }
}