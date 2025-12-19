// pages/HomePage.jsx
import React, { useContext } from "react";
import { NavLink } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import ProfileMenu from "../components/ProfileMenu.jsx";
import logo from "../assets/cinephix_logo.svg";

export default function HomePage() {
  const { user } = useContext(AuthContext);

  return (
    <div className="w-full">     
      {/* 🧩 Şimdilik boş içerik */}
      <div className="max-w-7xl mx-auto px-6 py-16 text-center text-base-content/60">
        Homepage feed will live here.
      </div>
    </div>
  );
}
