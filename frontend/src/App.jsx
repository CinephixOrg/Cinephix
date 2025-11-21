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
import logo from "./assets/cinephix_logo.svg";
import SplashScreen from "./pages/SplashScreen.jsx";

// --- MEVCUT SAYFALAR ---
// MoviesPage ve SeriesPage silindiği için yorumda veya kaldırılmış olabilir
// import MoviesPage from "./pages/MoviesPage.jsx"; 
// import SeriesPage from "./pages/SeriesPage.jsx";
import NetworkPage from "./pages/NetworkPage.jsx";

// --- 1. YENİ IMPORT: MatchPage'i ekle ---
import MatchPage from "./pages/MatchPage.jsx";
// --- BİTİŞ ---


// 1. GİRİŞ YAPMAMIŞ KULLANICI İÇİN NAVİGASYON
const GuestNav = () => (
  <nav className="navbar bg-base-300 shadow-lg sticky top-0 z-50">
    <div className="flex-1">
      <NavLink to="/home" className="btn btn-ghost normal-case text-xl flex items-center gap-2">
        <img src={logo} alt="Cinephix Logo" className="w-8 h-8" />
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
            <img src={logo} alt="Cinephix Logo" className="w-8 h-8" />
          </NavLink>
          <ul className="menu menu-horizontal p-0">
            <li><NavLink to="/home">Home</NavLink></li>
            <li><NavLink to="/list">List</NavLink></li>
            
            {/* --- 2. YENİ LINK: CineMatch --- */}
            <li>
              <NavLink to="/match" className="text-primary font-bold">
                🔮 CineMatch
              </NavLink>
            </li>
            {/* --- BİTİŞ --- */}

          </ul>
        </div>
        <div className="flex-none gap-4 items-center">
          {/* Kullanıcı adını göster */}
          <span className="text-sm font-medium text-base-content">{user.username}</span>
          <ProfileMenu user={user} onLogout={handleLogout} />
        </div>
      </nav>
    </>
  );
};

// 3. KORUMALI ROTA COMPONENT'İ
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
  const [showSplash, setShowSplash] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Sadece ana route'a ilk girişte splash screen'i göster
    if (window.location.pathname === "/") {
      setShowSplash(true);
      const timer = setTimeout(() => {
        setShowSplash(false);
        navigate("/home"); // Ana route'tan sonra home'a yönlendir
      }, 3500); // 3.5 saniye sonra splash ekranını gizle

      return () => clearTimeout(timer);
    }
  }, [navigate]);

  if (showSplash) {
    return <SplashScreen />;
  }

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
          
          <Route path="/network" element={<ProtectedRoute><NetworkPage /></ProtectedRoute>} />

          {/* --- 3. YENİ ROTA: CineMatch Sayfası --- */}
          <Route path="/match" element={<ProtectedRoute><MatchPage /></ProtectedRoute>} />
          {/* --- BİTİŞ --- */}

          <Route
            path="/content/:type/:contentId"
            element={<ProtectedRoute><ContentDetailPage /></ProtectedRoute>}
          />

        </Routes>
      </main>

      <Toaster position="top-center" />
    </div>
  );
}