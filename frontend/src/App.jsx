// App.jsx
import React from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";

// 🌍 Global stiller
// Tailwind will handle base/reset and fonts via its base styles and your global CSS.



// 🧱 Navigation (geçici)
const Nav = ({ children }) => (
  <nav className="flex gap-4 justify-center p-4 bg-[radial-gradient(circle_at_top,_#eef2f3,_#8e9eab)] shadow-sm">
    {children}
  </nav>
);

export default function App() {
  return (
    <>
      <Nav>
        <div role="tablist" className="tabs tabs-boxed">
          <NavLink
            to="/"
            end
            role="tab"
            className={({ isActive }) => (isActive ? "tab tab-active" : "tab")}
          >
            Home
          </NavLink>
          <NavLink
            to="/login"
            role="tab"
            className={({ isActive }) => (isActive ? "tab tab-active" : "tab")}
          >
            Login
          </NavLink>
          <NavLink
            to="/register"
            role="tab"
            className={({ isActive }) => (isActive ? "tab tab-active" : "tab")}
          >
            Register
          </NavLink>
        </div>
      </Nav>

      <Routes>
        <Route path="/" element={<h1>🎬 Cinephix'e Hoş Geldin!</h1>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/home" element={<HomePage />} />
      </Routes>
    </>
  );
}
