// insert_test_users.js

import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User from "../models/User.js"; // kendi model yoluna göre değiştir (örneğin ./models/userModel.js)

dotenv.config(); // .env dosyasından MONGO_URI vs. okur

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/test";
const SALT_ROUNDS = 10;
const PLAIN_PASSWORD = "test123";

async function main() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB bağlantısı başarılı.");

    // Mevcut test kullanıcılarını sil (opsiyonel)
    
    //await User.deleteMany({ email: /test\d+@email\.com/ });
    //console.log("🧹 Eski test kullanıcıları silindi.");

    const users = [];
    console.log("🔄 Test kullanıcıları ekleniyor...");
    for (let i = 1; i <= 10; i++) {
      console.log(`⏳ test${i} kullanıcısı hazırlanıyor...`);  
      const hashed = await bcrypt.hash(PLAIN_PASSWORD, SALT_ROUNDS);
      users.push({
        username: `test${i}`,
        email: `test${i}@email.com`,
        password: hashed,
      });
      console.log(`➕ test${i} kullanıcısı hazırlandı.`);
    }

    const result = await User.insertMany(users);
    console.log(`✅ ${result.length} test kullanıcısı eklendi.`);
  } catch (err) {
    console.error("❌ Hata:", err);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 MongoDB bağlantısı kapatıldı.");
  }
}

main();
