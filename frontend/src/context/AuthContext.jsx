import React, { createContext, useState, useEffect } from "react";
import API from "../api/axios.js"; // Oluşturduğumuz merkezi API'yi import ediyoruz

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // Uygulama açıldığında localStorage'ı kontrol et
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  // --- NEW: updateUser helper to keep context + localStorage in sync ---
  const updateUser = (updatedFields) => {
    setUser((prev) => {
      const next = { ...(prev || {}), ...updatedFields };
      try { localStorage.setItem("user", JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };
  // --- END NEW ---

  const login = async (email, password) => {
    try {
      // API yolunu kendi backend'imize göre kullanıyoruz: /users/login
      const res = await API.post("/users/login", { email, password });
      
      // Response interceptor otomatik olarak { success, message, data } yapısını açıyor
      // res.data artık doğrudan user objesini içeriyor
      const userData = res.data;

      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);

    } catch (error) {
      console.error("Login Error:", error.response?.data);
      throw error; // Hatayı component'in yakalayabilmesi için fırlat
    }
  };

  const register = async (username, email, password) => {
    try {
      await API.post("/users/register", { username, email, password });
      // Backend no longer returns a token on register — user must verify email first
    } catch (error) {
      console.error("Registration Error:", error.response?.data);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem("user");
    setUser(null);
  };

  const value = {
    user,
    setUser,
    updateUser,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}