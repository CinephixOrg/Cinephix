import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI, { dbName: "cleaned_db" });
    console.log("Connected.");

    const db = mongoose.connection.db;

    console.log("Creating index on movies collection...");
    await db.collection("movies").createIndex(
      { popularity: -1, vote_count: -1, release_date: -1 },
      { background: true }
    );
    console.log("Movies index created.");

    console.log("Creating index on series collection...");
    await db.collection("series").createIndex(
      { popularity: -1, vote_count: -1, first_air_date: -1 },
      { background: true }
    );
    console.log("Series index created.");

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
    process.exit(0);
  }
}

run();
