import React from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";

// 🧭 Tema uyumlu navigation bar
const Nav = ({ children }) => (
  <nav className="flex justify-center bg-base-200 shadow-md p-4">
    <div role="tablist" className="tabs tabs-boxed bg-base-100">
      {children}
    </div>
  </nav>
);

export default function App() {
  return (
    <div className="min-h-screen bg-base-100">
      <header className="navbar bg-base-300 shadow-lg sticky top-0 z-50">
        <div className="flex-1">
          <NavLink to="/home" className="btn btn-ghost text-xl">
            🎬 Cinephix
          </NavLink>
          <NavLink
            to="/login"
            role="tab"
            className={({ isActive }) => (isActive ? "tab tab-active text-primary" : "tab")}
          >
            Login
          </NavLink>
          <NavLink
            to="/register"
            role="tab"
            className={({ isActive }) => (isActive ? "tab tab-active text-primary" : "tab")}
          >
            Register
          </NavLink>
        </div>
      </header>

      <main className="flex flex-col items-center justify-center p-8">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={<h1 className="text-3xl font-bold text-primary">🎬 Welcome to Cinephix!</h1>}
          />
          <Route path="/home" element={<HomePage />} />
        </Routes>
      </main>

      <Toaster position="top-center" />
    </div>
  );
}