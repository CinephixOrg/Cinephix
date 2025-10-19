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
import MoviesPage from "./pages/MoviesPage.jsx";
import SeriesPage from "./pages/SeriesPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import ContentDetailPage from "./pages/ContentDetailPage.jsx";
import ProfileSidebar from "./components/ProfileSidebar.jsx"; // ← EKLENDİ
import ListPage from "./pages/ListPage.jsx";

// 1. GİRİŞ YAPMAMIŞ KULLANICI İÇİN NAVİGASYON
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
const UserNav = ({ user, logout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success("Successfully logged out! 👋", {
      style: { background: "#1a1a1a", color: "#fff", border: "1px solid #333" },
      iconTheme: { primary: "#22c55e", secondary: "#1a1a1a" },
    });
    navigate("/login");
  };

  const handleProfileClick = (e) => {
    e.preventDefault();
    setSidebarOpen(true);
  };

  const handleSelect = (section) => {
    console.log("Selected:", section);
    setSidebarOpen(false);
  };

  // Sidebar dışına tıklayınca kapat
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (sidebarOpen && !e.target.closest(".sidebar")) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [sidebarOpen]);

  return (
    <>
      <nav className="navbar bg-base-300 shadow-lg sticky top-0 z-40">
        <div className="flex-1">
          <NavLink to="/home" className="btn btn-ghost text-xl">
            🎬 Cinephix
          </NavLink>
          <ul className="menu menu-horizontal p-0">
            <li><NavLink to="/home">Home</NavLink></li>
            <li><NavLink to="/movies">Movies</NavLink></li>
            <li><NavLink to="/series">Series</NavLink></li>
            <li><NavLink to="/list">List</NavLink></li>
          </ul>
        </div>

        <div className="flex-none gap-4 items-center">
          <button onClick={handleProfileClick} className="btn btn-ghost">
            Profile
          </button>
          <button onClick={handleLogout} className="btn btn-error btn-sm">
            Log out
          </button>
        </div>
      </nav>

      <ProfileSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        onSelect={handleSelect}
      />
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
          <Route path="/movies" element={<ProtectedRoute><MoviesPage /></ProtectedRoute>} />
          <Route path="/series" element={<ProtectedRoute><SeriesPage /></ProtectedRoute>} />
          <Route path="/list" element={<ProtectedRoute><ListPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
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


