import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

// Koleksiyon şeması (dinamik)
const seriesSchema = new mongoose.Schema({}, { strict: false });
const Series = mongoose.model("Series", seriesSchema);

// Klasör yolu
const folderPath = path.join(process.cwd(), "all_series");

async function main() {
  try {
    // Yeni database adı: "cinephix_series"
    await mongoose.connect(process.env.MONGO_URI_S, { dbName: "cleaned_db" });
    console.log("Connected to MongoDB (cleaned_db)");

    const files = fs.readdirSync(folderPath).filter(f => f.endsWith(".json"));
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const content = fs.readFileSync(filePath, "utf8");
      const data = JSON.parse(content);

      if (Array.isArray(data)) {
        await Series.insertMany(data);
        console.log(`${file} uploaded (${data.length} records)`);
      } else {
        console.warn(`${file} skipped (not array)`);
      }
    }

    console.log("All series files uploaded successfully");
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await mongoose.disconnect();
    console.log("Connection closed");
  }
}

main();
