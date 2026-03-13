// main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { RatingsProvider } from "./context/RatingsContext.jsx";
import "./index.css";

// Initialize cache debugging utilities (available in browser console)
import './api/cacheDebug';

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <RatingsProvider>
          <App />
        </RatingsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
