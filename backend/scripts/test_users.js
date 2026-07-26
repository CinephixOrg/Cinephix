// insert_test_users.js

import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User from "../models/User.js"; // change to your model path (e.g., ./models/userModel.js)

dotenv.config(); // reads MONGO_URI etc. from .env file

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/test";
const SALT_ROUNDS = 10;
const PLAIN_PASSWORD = "test123";

async function main() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB connection successful.");

    // Delete existing test users (optional)
    
    //await User.deleteMany({ email: /test\d+@email\.com/ });
    //console.log("🧹 Old test users deleted.");

    const users = [];
    console.log("🔄 Adding test users...");
    for (let i = 1; i <= 10; i++) {
      console.log(`⏳ Preparing test${i} user...`);  
      const hashed = await bcrypt.hash(PLAIN_PASSWORD, SALT_ROUNDS);
      users.push({
        username: `test${i}`,
        email: `test${i}@email.com`,
        password: hashed,
        isEmailVerified: true,
      });
      console.log(`➕ test${i} user prepared.`);
    }

    const result = await User.insertMany(users);
    console.log(`✅ ${result.length} test users added.`);
  } catch (err) {
    console.error("❌ Hata:", err);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 MongoDB connection closed.");
  }
}

main();
