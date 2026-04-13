import React, { useContext, useState, useEffect } from "react";
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";

// Import Error Boundary (Issue #19)
import ErrorBoundary from "./components/ErrorBoundary.jsx";

import { AuthContext } from "./context/AuthContext.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import WelcomePage from "./pages/WelcomePage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import ContentDetailPage from "./pages/ContentDetailPage.jsx";
import ListPage from "./pages/ListPage.jsx";
import SplashScreen from "./pages/SplashScreen.jsx";
import MoviePage from "./pages/MoviesPage.jsx";
import SeriesPage from "./pages/SeriesPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import TopBar from "./components/TopBar";

import NetworkPage from "./pages/NetworkPage.jsx";

import MatchPage from "./pages/MatchPage.jsx";
import PublicProfilePage from "./pages/PublicProfilePage.jsx";



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
    <ErrorBoundary>
      <div className="min-h-screen bg-base-200" data-theme="forest">

        {/* 🔥 GLOBAL BAR – HER SAYFADA */}
        <TopBar />

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
            <Route path="/users/:id" element={<PublicProfilePage />} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

            <Route path="/network" element={<ProtectedRoute><NetworkPage /></ProtectedRoute>} />
            <Route path="/movies" element={<ProtectedRoute><MoviePage /></ProtectedRoute>} />
            <Route path="/series" element={<ProtectedRoute><SeriesPage /></ProtectedRoute>} />
            <Route path="/match" element={<ProtectedRoute><MatchPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

            <Route
              path="/content/:type/:contentId"
              element={<ProtectedRoute><ContentDetailPage /></ProtectedRoute>}
            />
          </Routes>
        </main>

        <Toaster position="top-center" />
      </div>
    </ErrorBoundary>
  );

}