import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import ErrorBoundary from "./components/ErrorBoundary.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import AboutPage from "./pages/AboutPage.jsx";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage.jsx";
import TermsOfServicePage from "./pages/TermsOfServicePage.jsx";
import LegalPageLayout from "./components/landing/LegalPageLayout.jsx";
import AdminPage from "./pages/admin/AdminPage.jsx";

// The web app itself is retired — Cinephix is mobile-only now, and this
// site is a marketing page for it (LandingPage.jsx), not a second client.
// Every route the functional app used to serve (login, home, profile, Sync,
// DMs, ...) is gone from here, but none of those page/component files were
// deleted — only this routing table changed, so re-enabling the web app
// later is a routing change, not a rebuild. Only 3 real routes remain
// (the landing page + the 2 legal pages + About, all public — no login
// required to read a privacy policy) plus a catch-all back to "/" for
// every retired path (old bookmarks, old links) instead of a dead 404.
// The one exception is /admin, the internal moderation dashboard.
export default function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-zinc-950">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/about" element={<LegalPageLayout><AboutPage /></LegalPageLayout>} />
          <Route path="/privacy" element={<LegalPageLayout><PrivacyPolicyPage /></LegalPageLayout>} />
          <Route path="/terms" element={<LegalPageLayout><TermsOfServicePage /></LegalPageLayout>} />
          {/* Moderation dashboard — signed-in admins only (checked by the server). */}
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/users/:id" element={<AdminPage view="user" />} />
          <Route path="/admin/tickets" element={<AdminPage view="tickets" />} />
          <Route path="/admin/grants" element={<AdminPage view="grants" />} />
          <Route path="/admin/signups" element={<AdminPage view="signups" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <Toaster position="top-center" />
      </div>
    </ErrorBoundary>
  );
}
