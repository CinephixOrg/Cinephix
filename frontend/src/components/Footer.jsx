import { NavLink } from "react-router-dom";
import cinephixLogo from "../assets/cinephix_logo.svg";
import { BiLogoLinkedin, BiLogoInstagram } from "react-icons/bi";
import { MdOutlineEmail } from "react-icons/md";

const NAV_LINKS = [
  { label: "About Us", to: "/about" },
  { label: "Privacy Policy", to: "/privacy" },
  { label: "Terms of Service", to: "/terms" },
];

const TEAM = [
  { name: "Furkan Gökgöz", url: "https://www.linkedin.com/in/furkan-g%C3%B6kg%C3%B6z-027479336" },
  { name: "Nursena Doksanbir", url: "https://www.linkedin.com/in/nursena-doksanbir" },
];

export default function Footer() {
  return (
    <footer className="border-t border-base-300 bg-base-300 mt-8">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8">

          {/* Logo + Social */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <img src={cinephixLogo} alt="Cinephix" className="w-8 h-8" />
              <span className="text-lg font-bold text-primary">Cinephix</span>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="mailto:cinephix3@gmail.com"
                className="flex items-center gap-1.5 text-sm text-base-content/70 hover:text-primary transition-colors"
                title="cinephix3@gmail.com"
              >
                <MdOutlineEmail className="w-4 h-4" />
                cinephix3@gmail.com
              </a>
            </div>
            <a
              href="https://www.instagram.com/cinephixofficial/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-base-content/70 hover:text-primary transition-colors"
            >
              <BiLogoInstagram className="w-4 h-4 text-secondary" />
              @cinephixofficial
            </a>
          </div>

          {/* Nav Links */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-1">
              Company
            </span>
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.label}
                to={link.to}
                onClick={() => window.scrollTo(0, 0)}
                className="text-sm text-base-content/70 hover:text-primary transition-colors"
              >
                {link.label}
              </NavLink>
            ))}
          </div>

          {/* Developer Team */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-1">
              Developer Team
            </span>
            {TEAM.map((dev) => (
              <a
                key={dev.name}
                href={dev.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-base-content/70 hover:text-primary transition-colors"
              >
                <BiLogoLinkedin className="w-4 h-4 text-info" />
                {dev.name}
              </a>
            ))}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-base-content/10 text-center text-xs text-base-content/40">
          © {new Date().getFullYear()} Cinephix. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
