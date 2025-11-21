// backend/seedData.js

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { faker } from '@faker-js/faker';

// Modelleri import et (Yolların doğruluğundan emin ol)
import User from './models/User.js';
import Rating from './models/Rating.js';
import { createMovieModel } from './models/Movie.js';
import { createSeriesModel } from './models/Series.js';

dotenv.config();

// Ayarlar
const USER_COUNT = 70; // Kaç kullanıcı oluşturulsun?
const MIN_ITEMS_PER_USER = 10;
const MAX_ITEMS_PER_USER = 25;

// Veritabanı bağlantısı
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, { dbName: "cleaned_db" });
        console.log(`MongoDB Bağlandı: ${conn.connection.host}`);
        return conn.connection;
    } catch (error) {
        console.error(`Hata: ${error.message}`);
        process.exit(1);
    }
};

// Rastgele sayı üretici
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

// Rastgele dizi elemanı seçici
const getRandomItems = (array, count) => {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
};

const seedData = async () => {
    const connection = await connectDB();

    // 1. Modelleri Kaydet
    const Movie = createMovieModel(connection);
    const Series = createSeriesModel(connection);

    console.log('--- Veriler Temizleniyor ---');
    // İstersen mevcut kullanıcıları silebilirsin (Admin hariç tutmak için filtre ekle)
    await User.deleteMany({ email: { $ne: 'admin@admin.com' } });
    await Rating.deleteMany({}); 
    // DİKKAT: Şimdilik silme kodunu kapalı tutuyorum, üzerine ekleme yapacak.
    // Silmek istersen üstteki yorumları aç.

    console.log('--- Filmler ve Diziler Çekiliyor ---');
    // Veritabanındaki tüm film ve dizi ID'lerini alalım
    // Sadece _id ve genre_ids çekiyoruz, gerisine gerek yok
    const allMovies = await Movie.find({}).select('_id genre_ids');
    const allSeries = await Series.find({}).select('_id genre_ids');

    if (allMovies.length === 0 || allSeries.length === 0) {
        console.error("HATA: Veritabanında hiç film veya dizi yok! Önce film/dizi eklemelisin.");
        process.exit(1);
    }

    console.log(`DB'de ${allMovies.length} film ve ${allSeries.length} dizi bulundu.`);
    console.log(`--- ${USER_COUNT} Kullanıcı Oluşturuluyor ---`);

    const salt = await bcrypt.genSalt(10);
    const genericPassword = await bcrypt.hash('123456', salt); // Hepsinin şifresi 123456 olsun

    for (let i = 0; i < USER_COUNT; i++) {
        // A. Kullanıcı Oluştur
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();
        const username = faker.internet.username({ firstName, lastName }) + randomInt(1, 999);
        const email = faker.internet.email({ firstName, lastName });

        // B. Rastgele Film ve Dizi Seç
        const itemCount = randomInt(MIN_ITEMS_PER_USER, MAX_ITEMS_PER_USER);
        const randomMovies = getRandomItems(allMovies, Math.floor(itemCount / 2));
        const randomSeries = getRandomItems(allSeries, Math.ceil(itemCount / 2));
        const combinedContent = [...randomMovies.map(m => ({ ...m.toObject(), type: 'movie' })), 
                                 ...randomSeries.map(s => ({ ...s.toObject(), type: 'series' }))];

        // C. Watchlist ve Rating Hazırla
        const watchlist = [];
        const ratingPromises = [];
        
        // Kullanıcıyı önce kaydetmemiz lazım ki ID'si olsun
        const user = await User.create({
            username,
            email,
            password: genericPassword,
            bio: faker.person.bio(),
            profile_pic_url: `https://ui-avatars.com/api/?name=${username}&background=random`,
            watchlist: [] // Şimdilik boş, aşağıda dolduracağız
        });

        for (const item of combinedContent) {
            // 1. Watchlist'e ekle
            watchlist.push({
                itemId: item._id,
                itemType: item.type,
                addedAt: faker.date.past()
            });

            // 2. Rating (Puan) Oluştur (1-10 arası)
            const randomRating = randomInt(1, 10);
            
            ratingPromises.push(
                Rating.create({
                    user: user._id,
                    contentId: item._id.toString(), // Rating modelin string mi ObjectId mi bekliyor? String demiştik.
                    contentType: item.type,
                    value: randomRating
                })
            );
        }

        // D. Kullanıcıyı Watchlist ile Güncelle
        user.watchlist = watchlist;
        await user.save();

        // E. Ratingleri Kaydet
        await Promise.all(ratingPromises);

        console.log(`✅ Kullanıcı oluşturuldu: ${username} (${watchlist.length} içerik)`);
    }

    console.log('🎉 TOHUMLAMA TAMAMLANDI! 🎉');
    process.exit();
};

seedData();