import { useState, useEffect, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { NotificationContext } from '../context/NotificationContext';
import { BiTrash, BiCheck } from 'react-icons/bi';
import notificationService from '../api/notificationService';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const { user } = useContext(AuthContext);
  const { markAsRead, deleteNotification, markAllAsRead } = useContext(NotificationContext);
  const navigate = useNavigate();
  const limit = 20;

  useEffect(() => {
    fetchNotifications();
  }, [page]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await notificationService.getNotifications(page, limit);
      setNotifications(response || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification._id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notification._id ? { ...n, read: true } : n))
      );
    }

    // Navigate based on type
    if (notification.type === 'message' && notification.conversationId) {
      navigate(`/dm/${notification.conversationId._id || notification.conversationId}`);
    } else if (notification.type === 'follow') {
      navigate(`/profile/${notification.sender._id}`);
    }
  };

  const handleDelete = async (notificationId, e) => {
    e.stopPropagation();
    await deleteNotification(notificationId);
    setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
  };

  const getNotificationText = (notification) => {
    if (notification.type === 'message') {
      return `${notification.sender.username} sent you a message`;
    } else if (notification.type === 'follow') {
      return `${notification.sender.username} started following you`;
    }
    return 'New notification';
  };

  const getNotificationIcon = (notification) => {
    if (notification.type === 'message') {
      return '💬';
    } else if (notification.type === 'follow') {
      return '👤';
    }
    return '📌';
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-base-200 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Notifications</h1>
            <p className="text-base-content/70">
              {unreadCount > 0
                ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
                : 'All caught up!'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="btn btn-primary btn-sm gap-2"
            >
              <BiCheck size={16} />
              Mark all read
            </button>
          )}
        </div>

        {/* Notifications List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">📭</p>
            <h2 className="text-lg font-semibold text-base-content mb-2">No notifications</h2>
            <p className="text-base-content/70">You're all caught up! Come back later.</p>
          </div>
        ) : (
          <div className="bg-base-100 rounded-lg shadow divide-y divide-base-300 overflow-hidden">
            {notifications.map((notification) => (
              <div
                key={notification._id}
                className={`p-6 transition cursor-pointer hover:bg-base-200 ${
                  !notification.read ? 'bg-base-200/50' : ''
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex gap-4 items-start">
                  {/* Avatar */}
                  <Link
                    to={`/profile/${notification.sender._id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0 hover:opacity-80 transition-opacity"
                  >
                    <img
                      src={notification.sender.profile_pic_url || 'https://via.placeholder.com/48'}
                      alt={notification.sender.username}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  </Link>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-base flex items-center gap-2">
                        <span className="text-lg">{getNotificationIcon(notification)}</span>
                        <Link
                          to={`/profile/${notification.sender._id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline hover:text-primary transition-all"
                        >
                          {notification.sender.username}
                        </Link>
                      </h3>
                      {!notification.read && (
                        <span className="w-3 h-3 rounded-full bg-primary flex-shrink-0"></span>
                      )}
                    </div>
                    <p className="text-sm text-base-content/80">
                      {getNotificationText(notification)}
                    </p>
                    <time className="text-xs text-base-content/50 block mt-2">
                      {new Date(notification.createdAt).toLocaleDateString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </time>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => handleDelete(notification._id, e)}
                    className="p-2 hover:bg-base-300 rounded transition flex-shrink-0"
                    title="Delete notification"
                  >
                    <BiTrash size={18} className="text-error" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && notifications.length > 0 && (
          <div className="flex justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="btn btn-sm btn-outline"
            >
              Previous
            </button>
            <span className="flex items-center px-4">Page {page}</span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={notifications.length < 20}
              className="btn btn-sm btn-outline"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
