import React, { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useTranslation } from "react-i18next";

export default function ProfileMenu({ onLogout }) {
  const { user } = useContext(AuthContext);
  const { t } = useTranslation();

  const avatarSrc =
    user?.profile_pic_url && user.profile_pic_url !== ""
      ? user.profile_pic_url
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.username || "U")}&size=128`;

  return (
    <div className="dropdown dropdown-end">
      <label tabIndex={0} className="btn btn-ghost btn-circle avatar">
        <div className="w-9 h-9 rounded-full ring ring-primary ring-offset-2 overflow-hidden bg-gray-200">
          <img
            src={avatarSrc}
            alt="avatar"
            className="w-full h-full object-cover object-center"
          />
        </div>
      </label>

      <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52 mt-2">
        <li><a href="/network">{t('Network')}</a></li>
        <li><a href="/watchlist">{t('Watchlist')}</a></li>
        <li><a href="/my-lists">{t('My Lists')}</a></li>
        <li><a href="/list">{t('Watched List')}</a></li>
        <li><a href="/profile">{t('Profile')}</a></li>
        <li><a href="/settings">{t('Settings')}</a></li>
        <li><button className="text-error" onClick={onLogout}>{t('Logout')}</button></li>
      </ul>
    </div>
  );
}