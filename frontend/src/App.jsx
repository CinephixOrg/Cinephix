import React from "react";
import { Routes, Route, NavLink } from "react-router-dom";
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
        </Routes>
      </main>
    </div>
  );
}
