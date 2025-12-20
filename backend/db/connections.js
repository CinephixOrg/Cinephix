// backend/db/connection.js
import mongoose from "mongoose";

export const conn = mongoose.createConnection(process.env.MONGO_URI);

conn.on("connected", () => {
  console.log("MongoDB connected");
});
