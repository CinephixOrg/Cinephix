// models/User.js
import mongoose from 'mongoose';

const { Schema } = mongoose;

const WatchItemSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true }, // veya eğer id'ler string ise String
  itemType: { type: String, enum: ["movie", "series"], required: true },
  addedAt: { type: Date, default: Date.now },
});


const userSchema = new Schema({
  username: {
    type: String,
    required: [true, 'Kullanıcı adı zorunludur.'],
    unique: true,
    trim: true // Başındaki ve sonundaki boşlukları temizler
  },
  email: {
    type: String,
    required: [true, 'E-posta zorunludur.'],
    unique: true,
    match: [/.+\@.+\..+/, 'Lütfen geçerli bir e-posta adresi girin.'] // E-posta format kontrolü
  },
  password: {
    type: String,
    required: [true, 'Parola zorunludur.'],
    minlength: 6 // Minimum parola uzunluğu
  },
  watchlist: { type: [WatchItemSchema], default: [] }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

export default User;