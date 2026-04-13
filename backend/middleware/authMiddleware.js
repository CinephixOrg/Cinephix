// middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

export default async function authMiddleware(req, res, next) {
  try {
    // Authorization header: "Bearer <token>"
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Yetkilendirme gerekiyor" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Token bulunamadı" });

    // Token'ı doğrula
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id) return res.status(401).json({ message: "Geçersiz token" });

    // Kullanıcıyı bul
    // YENİ HALİ:
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı" });

    // req.user içine ekle
    req.user = user;

    next();
  } catch (err) {
    return res.status(401).json({ message: "Token doğrulanamadı" });
  }
}
