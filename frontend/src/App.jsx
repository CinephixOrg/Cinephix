// App.jsx
import React from "react";
import styled, { createGlobalStyle } from "styled-components";
import { Routes, Route, Link } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";

// 🌍 Global stiller
const GlobalStyle = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: "Poppins", sans-serif;
    background-color: #f7f8fa;
    color: #333;
  }

  a {
    text-decoration: none;
    color: #0077ff;
  }

  a:hover {
    text-decoration: underline;
  }
`;



// 🧱 Navigation (geçici)
const Nav = styled.nav`
  display: flex;
  gap: 1rem;
  justify-content: center;
  padding: 1rem;
  background: radial-gradient(circle at top, #eef2f3, #8e9eab);
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.1);
`;

export default function App() {
  return (
    <>
      <GlobalStyle />
      <Nav>
        <Link to="/">Home</Link>
        <Link to="/login">Login</Link>
        <Link to="/register">Register</Link>
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
