// main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { RatingsProvider } from "./context/RatingsContext.jsx";
import { UnreadProvider } from "./context/UnreadContext.jsx";
import { NotificationProvider } from "./context/NotificationContext.jsx";
import "./index.css";

// Initialize cache debugging utilities (available in browser console)
import './api/cacheDebug';

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <RatingsProvider>
            <UnreadProvider>
              <App />
            </UnreadProvider>
          </RatingsProvider>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

