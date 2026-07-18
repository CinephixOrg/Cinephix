// backend/db/connection.js
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";

if (!process.env.MONGO_URI) {
  console.error("ERROR: MONGO_URI is missing in environment variables.");
  process.exit(1);
}

export const conn = mongoose.createConnection(process.env.MONGO_URI);

conn.on("connected", () => {
  console.log("MongoDB connected");
});

conn.on("error", (err) => {
  console.error("MongoDB connection error:", err);
});
