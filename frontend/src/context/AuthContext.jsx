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
      
      // Bizim backend'imiz doğrudan kullanıcı nesnesini token ile birlikte döndürüyor.
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
      // API yolunu kendi backend'imize göre kullanıyoruz: /users/register
      const res = await API.post("/users/register", { username, email, password });

      // Bizim backend'imiz doğrudan kullanıcı nesnesini token ile birlikte döndürüyor.
      const userData = res.data;
      
      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);

    } catch (error) {
      console.error("Registration Error:", error.response?.data);
      throw error; // Hatayı component'in yakalayabilmesi için fırlat
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

