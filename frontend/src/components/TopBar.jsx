import { NavLink } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import ProfileMenu from "./ProfileMenu";
import logo from "../assets/cinephix_logo.svg";

export default function TopBar() {
  const { user, logout } = useContext(AuthContext);

  if (!user) return null; // login/register sayfalarında görünmesin

  return (
    <div className="w-full border-b border-base-300 bg-base-300/40 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* SOL */}
        <NavLink
          to="/home"
          className="flex items-center gap-3 hover:opacity-90 transition"
        >
          <img src={logo} alt="Cinephix" className="w-7 h-7" />
          <span className="text-xl font-semibold tracking-wide">
            Cinephix
          </span>
        </NavLink>

        {/* ORTA */}
        <nav className="flex items-center gap-6">
          <NavLink to="/movies" className="hover:text-primary">
            Movies
          </NavLink>
          <NavLink to="/series" className="hover:text-primary">
            Series
          </NavLink>
          <NavLink
            to="/match"
            className="text-primary font-semibold hover:underline"
          >
            🔮 CineMatch
          </NavLink>
        </nav>

        {/* SAĞ */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-base-content/70">
            Welcome back, {user.username}
          </span>
          <ProfileMenu onLogout={logout} />
        </div>

      </div>
    </div>
  );
}
