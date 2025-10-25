// src/App.jsx
import React, { useContext, useState, useEffect } from "react";
import {
  Routes,
  Route,
  NavLink,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { toast, Toaster } from "react-hot-toast";

import { AuthContext } from "./context/AuthContext.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import WelcomePage from "./pages/WelcomePage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import ContentDetailPage from "./pages/ContentDetailPage.jsx";
import ProfileMenu from "./components/ProfileMenu.jsx";
import ListPage from "./pages/ListPage.jsx";

// --- SİLİNDİ (1. Değişiklik) ---
// Artık bu sayfalara ihtiyacımız yok.
import MoviesPage from "./pages/MoviesPage.jsx";
import SeriesPage from "./pages/SeriesPage.jsx";

// --- YENİ NETWORK SAYFASINI İMPORT EDİN ---
import NetworkPage from "./pages/NetworkPage.jsx";
// --- BİTİŞ ---

// 1. GİRİŞ YAPMAMIŞ KULLANICI İÇİN NAVİGASYON
// (Değişiklik yok)
const GuestNav = () => (
  <nav className="navbar bg-base-300 shadow-lg sticky top-0 z-50">
    <div className="flex-1">
      <NavLink to="/" className="btn btn-ghost text-xl">
        🎬 Cinephix
      </NavLink>
    </div>
    <div className="flex-none">
      <ul className="menu menu-horizontal p-0">
        <li><NavLink to="/login" className="btn btn-ghost">Login</NavLink></li>
        <li><NavLink to="/register" className="btn btn-primary">Register</NavLink></li>
      </ul>
    </div>
  </nav>
);

// 2. GİRİŞ YAPMIŞ KULLANICI İÇİN NAVİGASYON
// (Değişiklik yok)
const UserNav = ({ user, logout }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success("Successfully logged out! 👋", {
      style: { background: "#1a1a1a", color: "#fff", border: "1px solid #333" },
      iconTheme: { primary: "#22c55e", secondary: "#1a1a1a" },
    });
    navigate("/login");
  };

  return (
    <>
      <nav className="navbar bg-base-300 shadow-lg sticky top-0 z-40">
        <div className="flex-1">
          <NavLink to="/home" className="btn btn-ghost text-xl">
            🎬 Cinephix
          </NavLink>
          <ul className="menu menu-horizontal p-0">
            <li><NavLink to="/home">Home</NavLink></li>
            {/* --- SİLİNDİ (2. Değişiklik) --- */}
            {/* Artık bu linklere ihtiyacımız yok. */}
            {<li><NavLink to="/movies">Movies</NavLink></li>}
            {<li><NavLink to="/series">Series</NavLink></li>}
            <li><NavLink to="/list">List</NavLink></li>
          </ul>
        </div>
        <div className="flex-none gap-4 items-center">
          <ProfileMenu user={user} onLogout={handleLogout} />
        </div>
      </nav>
    </>
  );
};

// 3. KORUMALI ROTA COMPONENT'İ
// (Değişiklik yok)
const ProtectedRoute = ({ children }) => {
  const { user } = useContext(AuthContext);
  if (!user) {
    return <Navigate to="/login" />;
  }
  return children;
};

// 4. ANA UYGULAMA COMPONENT'İ
export default function App() {
  const { user, logout } = useContext(AuthContext);

  return (
    <div className="min-h-screen bg-base-200" data-theme="forest">
      {user ? <UserNav user={user} logout={logout} /> : <GuestNav />}

      <main>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route
            path="/"
            element={user ? <Navigate to="/home" /> : <WelcomePage />}
          />

          <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
          <Route path="/list" element={<ProtectedRoute><ListPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          
          {/* --- YENİ ROTAYI BURAYA EKLEYİN (ProtectedRoute ile sarılmış) --- */}
          <Route path="/network" element={<ProtectedRoute><NetworkPage /></ProtectedRoute>} />
          {/* --- BİTİŞ --- */}
          
          <Route
            path="/content/:type/:contentId"
            element={<ProtectedRoute><ContentDetailPage /></ProtectedRoute>}
          />
          
          {/* --- SİLİNDİ (3. Değişiklik) --- */}
          {/* Artık bu route'lara ihtiyacımız yok. */}
          {<Route path="/movies" element={<ProtectedRoute><MoviesPage /></ProtectedRoute>} />}
          {<Route path="/series" element={<ProtectedRoute><SeriesPage /></ProtectedRoute>} />}
          
        </Routes>
      </main>

      <Toaster position="top-center" />
    </div>
  );
}