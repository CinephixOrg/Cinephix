import React from "react";
import { BiTrash, BiCheck } from "react-icons/bi";
import { useNavigate } from "react-router-dom";

export default function NotificationDropdown({
  notifications,
  onMarkAsRead,
  onDelete,
  onMarkAllAsRead,
  onClose
}) {
  const navigate = useNavigate();

  const unreadNotifications = notifications.filter((n) => !n.read);

  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      onMarkAsRead(notification._id);
    }

    // Navigate based on notification type
    if (notification.type === "message" && notification.conversationId) {
      navigate(`/dm/${notification.conversationId._id || notification.conversationId}`);
    } else if (notification.type === "follow") {
      navigate(`/profile/${notification.sender._id}`);
    } else if (notification.type === "follow_request") {
      navigate('/network?tab=requests');
    } else if (notification.type === "follow_accepted") {
      navigate(`/profile/${notification.sender._id}`);
    }

    onClose();
  };

  const getNotificationText = (notification) => {
    switch (notification.type) {
      case "follow_request":
        return "New follow request";
      case "follow_accepted":
        return "Follow request accepted";
      case "message":
        return "sent you a message";
      case "follow":
        return "started following you";
      default:
        return "New notification";
    }
  };

  const getNotificationIcon = (notification) => {
    if (notification.type === "message") {
      return "💬";
    } else if (notification.type === "follow" || notification.type === "follow_accepted") {
      return "👤";
    } else if (notification.type === "follow_request") {
      return "🛎️";
    }
    return "📌";
  };

  return (
    <div className="absolute top-full right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-lg shadow-xl bg-base-100 border border-base-300 z-50">
      {/* Header */}
      <div className="sticky top-0 bg-base-100 border-b border-base-300 p-4 flex items-center justify-between">
        <h3 className="font-semibold text-sm">
          Notifications {unreadNotifications.length > 0 && `(${unreadNotifications.length})`}
        </h3>
        {unreadNotifications.length > 0 && (
          <button
            onClick={onMarkAllAsRead}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <BiCheck size={14} />
            Mark all read
          </button>
        )}
      </div>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <div className="p-6 text-center text-base-content/50 text-sm">
          <p>No notifications yet</p>
        </div>
      ) : (
        <ul className="divide-y divide-base-300">
          {notifications.map((notification) => (
            <li
              key={notification._id}
              className={`p-4 cursor-pointer transition hover:bg-base-200 ${
                !notification.read ? "bg-base-200/50" : ""
              }`}
            >
              <div
                onClick={() => handleNotificationClick(notification)}
                className="flex gap-3 items-start"
              >
                {/* Avatar */}
                <img
                  src={notification.sender.profile_pic_url || "https://via.placeholder.com/40"}
                  alt={notification.sender.username}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-base-content flex items-center gap-1">
                    <span>{getNotificationIcon(notification)}</span>
                    {notification.sender.username}
                  </p>
                  <p className="text-xs text-base-content/70 mt-1">
                    {getNotificationText(notification)}
                  </p>
                  <time className="text-xs text-base-content/50 mt-1 block">
                    {new Date(notification.createdAt).toLocaleDateString("tr-TR", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </time>
                </div>

                {/* Unread Dot & Delete */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!notification.read && (
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(notification._id);
                    }}
                    className="p-1 hover:bg-base-300 rounded transition"
                  >
                    <BiTrash size={14} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="sticky bottom-0 bg-base-100 border-t border-base-300 p-3 text-center">
          <button
            onClick={() => navigate("/notifications")}
            className="text-xs text-primary hover:underline font-medium"
          >
            View all notifications →
          </button>
        </div>
      )}
    </div>
  );
}
