import { Link } from "react-router-dom";
import cinephixLogo from "../../assets/cinephix_logo.svg";
import Footer from "../Footer";

// Shared chrome for the 3 pages that stayed public after the web app's
// retirement (About/Privacy/Terms) — a minimal header (just a logo back to
// the landing page, none of the full LandingNavbar's download CTA) plus the
// same Footer the landing page uses, so these read as part of the same
// marketing site instead of orphaned pages with no way back. Forces the
// same "black" theme as LandingPage.jsx for the same reason.
export default function LegalPageLayout({ children }) {
  return (
    <div data-theme="black" className="min-h-screen bg-zinc-950">
      <header className="border-b border-white/5">
        <div className="mx-auto flex max-w-6xl items-center px-6 py-5">
          <Link to="/" className="flex items-center gap-2">
            <img src={cinephixLogo} alt="Cinephix" className="h-7 w-7" />
            <span className="text-base font-bold text-white">Cinephix</span>
          </Link>
        </div>
      </header>

      <main>{children}</main>

      <Footer />
    </div>
  );
}
