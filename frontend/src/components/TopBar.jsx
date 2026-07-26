import { NavLink } from "react-router-dom";
import { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { useUnread } from "../context/UnreadContext";
import { NotificationContext } from "../context/NotificationContext";
import { useTranslation } from "react-i18next";
import ProfileMenu from "./ProfileMenu";
import NotificationBell from "./NotificationBell";
import LanguageSwitcher from "./common/LanguageSwitcher";
import logo from "../assets/cinephix_logo.svg";

export default function TopBar() {
  const { user, logout } = useContext(AuthContext);
  const { totalUnread } = useUnread();
  const { t } = useTranslation();

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
            {t('Movies')}
          </NavLink>
          <NavLink
            to="/series"
            className={({ isActive }) => isActive ? 'text-primary font-semibold' : 'hover:text-primary'}
          >
            {t('Series')}
          </NavLink>
          <NavLink
            to="/match"
            className={({ isActive }) =>
              isActive ? 'text-primary font-bold' : 'text-primary font-semibold'
            }
          >
            <span className="text-base-content">Cine</span>
            <span className="text-primary">Match</span>
          </NavLink>
          <NavLink
            to="/community"
            className={({ isActive }) => isActive ? 'text-primary font-semibold' : 'hover:text-primary'}
          >
            {t('Community')}
          </NavLink>
          <NavLink
            to="/dm"
            className={({ isActive }) =>
              `relative flex items-center gap-1.5 ${isActive ? 'text-primary font-semibold' : 'hover:text-primary'}`
            }
          >
            {t('Messages')}
            {totalUnread > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-content text-[10px] font-bold leading-none">
                {totalUnread > 9 ? '9+' : totalUnread}
              </span>
            )}
          </NavLink>
        </nav>

        {/* SAĞ */}
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <NotificationBell />
          <span className="text-sm text-base-content/70">
            {t('Welcome back', { name: user.username })}
          </span>
          <ProfileMenu onLogout={logout} />
        </div>

      </div>
    </div>
  );
}
