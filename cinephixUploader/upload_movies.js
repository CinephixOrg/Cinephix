import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

const movieSchema = new mongoose.Schema({}, { strict: false });
const Movie = mongoose.model("Movie", movieSchema);

const folderPath = path.join(process.cwd(), "all_movies");

async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI_M, { dbName: "cleaned_db" });
    console.log("Connected to MongoDB");

    const files = fs.readdirSync(folderPath);
    for (const file of files) {
      if (file.endsWith(".json")) {
        const data = JSON.parse(fs.readFileSync(path.join(folderPath, file)));
        if (Array.isArray(data)) {
          await Movie.insertMany(data);
          console.log(`${file} uploaded (${data.length} records)`);
        } else {
          console.warn(`${file} skipped (not array)`);
        }
      }
    }
    console.log("All files uploaded");
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.connection.close();
  }
}

main();
