import fs from "fs";

// Filmlerin olduğu klasör
const folder = "./cinephixUploader/all_movies";

let totalMovies = 0;
let totalFiles = 0;

// Klasördeki her dosyayı gez
const files = fs.readdirSync(folder).filter(f => f.endsWith(".json"));
for (const file of files) {
  const data = JSON.parse(fs.readFileSync(`${folder}/${file}`, "utf-8"));
  totalMovies += data.length;
  totalFiles++;
}

console.log(`📂 Dosya sayısı: ${totalFiles}`);
console.log(`🎬 Toplam film sayısı: ${totalMovies}`);
