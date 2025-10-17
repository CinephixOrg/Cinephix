import React, { useContext } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";
import ProfileSidebar from "./components/ProfileSidebar";
import { AuthContext } from "./context/AuthContext";

// 🧭 Tema uyumlu navigation bar
const Nav = ({ children }) => (
  <nav className="flex justify-between items-center bg-base-200 shadow-md p-4">
    <div className="flex items-center">
      <div className="ml-4">
        <NavLink to="/" className="btn btn-ghost normal-case text-xl">Cinephix</NavLink>
      </div>
    </div>
    <div className="flex-1 flex justify-center">
      <div role="tablist" className="tabs tabs-boxed bg-base-100">
        {children}
      </div>
    </div>
    <div className="mr-4">
        {/* Placeholder for right-side controls (profile/avatar) - rendered by parent */}
    </div>
  </nav>
);

export default function App() {
  const { user } = useContext(AuthContext);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const handleProfileClick = () => {
    setSidebarOpen(true);
  };

  const handleCloseSidebar = () => setSidebarOpen(false);

  const handleSidebarSelect = (key) => {
    // Basit davranış: seçime göre route veya modal açılabilir. Şimdilik console.log
    console.log('Profile sidebar select:', key);
  };
  return (
    <div data-theme="forest" className="min-h-screen bg-base-200 text-base-content">
      <Nav>
        <NavLink
          to="/"
          end
          role="tab"
          className={({ isActive }) =>
            isActive ? "tab tab-active text-primary" : "tab"
          }
        >
          Home
        </NavLink>
        <NavLink
          to="/login"
          role="tab"
          className={({ isActive }) =>
            isActive ? "tab tab-active text-primary" : "tab"
          }
        >
          Login
        </NavLink>
        <NavLink
          to="/register"
          role="tab"
          className={({ isActive }) =>
            isActive ? "tab tab-active text-primary" : "tab"
          }
        >
          Register
        </NavLink>

      </Nav>
      {/* right-side profile button */}
      <div className="absolute right-6 top-4">
        {user ? (
          <button onClick={handleProfileClick} className="flex items-center gap-2">
            <div className="avatar">
              <div className="ring-primary ring-offset-base-100 w-9 rounded-full ring ring-offset-2">
                <img src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp" />
                {user.username?.[0]?.toUpperCase()}
              </div>
            </div>
            <span className="hidden sm:inline">{user.username}</span>
          </button>
        ) : null}
      </div>

      <ProfileSidebar open={sidebarOpen} onClose={handleCloseSidebar} user={user} onSelect={handleSidebarSelect} />

      <main className="flex flex-col items-center justify-center p-8">
        <Routes>
          <Route
            path="/"
            element={
              <h1 className="text-3xl font-bold text-primary">
                🎬 Welcome to Cinephix!
              </h1>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/home" element={<HomePage />} />
          {/* Profile route removed: using sidebar for profile UI */}
        </Routes>
      </main>
    </div>
  );
}
