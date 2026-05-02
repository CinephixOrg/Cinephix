import { NavLink } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useUnread } from "../context/UnreadContext";
import ProfileMenu from "./ProfileMenu";
import logo from "../assets/cinephix_logo.svg";

export default function TopBar() {
  const { user, logout } = useContext(AuthContext);
  const { totalUnread } = useUnread();

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
          <NavLink
            to="/movies"
            className={({ isActive }) => isActive ? 'text-primary font-semibold' : 'hover:text-primary'}
          >
            Movies
          </NavLink>
          <NavLink
            to="/series"
            className={({ isActive }) => isActive ? 'text-primary font-semibold' : 'hover:text-primary'}
          >
            Series
          </NavLink>
          <NavLink
            to="/match"
            className={({ isActive }) =>
              isActive ? 'text-primary font-bold underline' : 'text-primary font-semibold hover:underline'
            }
          >
            🔮 CineMatch
          </NavLink>
          <NavLink
            to="/community"
            className={({ isActive }) => isActive ? 'text-primary font-semibold' : 'hover:text-primary'}
          >
            Community
          </NavLink>
          <NavLink
            to="/dm"
            className={({ isActive }) =>
              `relative flex items-center gap-1.5 ${isActive ? 'text-primary font-semibold' : 'hover:text-primary'}`
            }
          >
            Messages
            {totalUnread > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-content text-[10px] font-bold leading-none">
                {totalUnread > 9 ? '9+' : totalUnread}
              </span>
            )}
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
