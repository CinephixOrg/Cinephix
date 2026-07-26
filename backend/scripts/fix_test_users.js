import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function run() {
  try {
    await mongoose.connect(MONGO_URI, { dbName: "cleaned_db" });
    const res = await User.updateMany(
      {}, // Bütün kullanıcıları seç
      { $set: { isEmailVerified: true } }
    );
    console.log(`Updated ${res.modifiedCount} test users.`);
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
    process.exit(0);
  }
}

run();
