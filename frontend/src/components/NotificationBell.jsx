import React, { useContext, useState, useEffect } from "react";
import { NotificationContext } from "../context/NotificationContext";
import { BiBell } from "react-icons/bi";
import NotificationDropdown from "./NotificationDropdown";

export default function NotificationBell() {
  const { unreadCount, notifications, markAsRead, deleteNotification, markAllAsRead } = useContext(NotificationContext);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleMarkAsRead = async (notificationId) => {
    await markAsRead(notificationId);
  };

  const handleDelete = async (notificationId) => {
    await deleteNotification(notificationId);
  };

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 hover:bg-base-200 rounded-full transition"
        title="Notifications"
      >
        <BiBell size={24} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-error text-error-content text-[10px] font-bold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <NotificationDropdown
          notifications={notifications}
          onMarkAsRead={handleMarkAsRead}
          onDelete={handleDelete}
          onMarkAllAsRead={markAllAsRead}
          onClose={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
}
