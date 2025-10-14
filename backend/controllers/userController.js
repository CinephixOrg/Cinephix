// controllers/userController.js
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// @desc    Yeni bir kullanıcı kaydeder
// @route   POST /api/users/register
export const registerUser = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // 1. Kullanıcı zaten var mı?
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'Bu e-posta adresi zaten kullanılıyor.' });
    }

    // 2. Parolayı hash'le
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Yeni kullanıcıyı oluştur
    const user = await User.create({
      username,
      email,
      password: hashedPassword
    });

    // 4. Kullanıcı oluşturulduysa token oluştur ve geri döndür
    if (user) {
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
      res.status(201).json({
        _id: user._id,
        username: user.username,
        email: user.email,
        token: token
      });
    } else {
      res.status(400).json({ message: 'Geçersiz kullanıcı verisi.' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Kullanıcı girişi yapar ve token döndürür
// @route   POST /api/users/login
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Kullanıcıyı e-postaya göre bul
    const user = await User.findOne({ email });

    // 2. Kullanıcı varsa ve parola eşleşiyorsa
    if (user && (await bcrypt.compare(password, user.password))) {
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
      res.json({
        _id: user._id,
        username: user.username,
        email: user.email,
        token: token
      });
    } else {
      res.status(401).json({ message: 'Geçersiz e-posta veya parola.' }); // 401: Unauthorized
    }
  } catch (error) {
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

export const getUsers = async (req, res) => {
  try {
    // .select('-password') komutu, kullanıcıları çekerken parola alanını GİZLER.
    // Bu, güvenlik için ÇOK ÖNEMLİDİR. Asla parolaları API'de göstermemelisin.
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};