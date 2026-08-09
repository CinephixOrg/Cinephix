import { useCallback, useState } from "react";
import { View, Text, Image, FlatList, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { SkeletonRow } from "../src/components/Skeleton";
import { Redirect, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import i18n from "../src/i18n";
import { useAuth } from "../src/context/AuthContext";
import { useNotifications } from "../src/context/NotificationContext";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearAllNotifications,
} from "../src/api/notificationService";
import type { Notification, NotificationType } from "../src/types";
import { colors } from "../src/theme/colors";
import { fonts } from "../src/theme/typography";

// Tap-to-navigate is intentionally NOT ported: web routes each type to a DM
// screen, another user's profile, or follow-request management — none of
// which exist on mobile yet. Tapping a row here only marks it read.
function getNotificationMeta(type: NotificationType): { icon: string; text: string } {
  switch (type) {
    case "message":
      return { icon: "💬", text: i18n.t("sent you a message") };
    case "follow":
      return { icon: "👤", text: i18n.t("started following you") };
    case "follow_request":
      return { icon: "🛎️", text: i18n.t("New follow request") };
    case "follow_accepted":
      return { icon: "👤", text: i18n.t("Follow request accepted") };
    default:
      return { icon: "📌", text: i18n.t("New notification") };
  }
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { unreadCount, decrementUnreadCount, clearUnreadCount } = useNotifications();

  const [items, setItems] = useState<Notification[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (pageNum: number, append: boolean) => {
    try {
      const { items: newItems, pagination } = await getNotifications(pageNum, 20);
      setItems((prev) => (append ? [...prev, ...newItems] : newItems));
      setHasMore(pagination ? pageNum < pagination.pages : newItems.length > 0);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to load notifications."));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setPage(1);
      loadPage(1, false).finally(() => setLoading(false));
    }, [loadPage])
  );

  const loadMore = async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    await loadPage(nextPage, true);
    setPage(nextPage);
    setLoadingMore(false);
  };

  const handleMarkRead = async (item: Notification) => {
    if (item.read) return;
    setItems((prev) => prev.map((n) => (n._id === item._id ? { ...n, read: true } : n)));
    decrementUnreadCount(1);
    try {
      await markNotificationRead(item._id);
    } catch {
      // Optimistic update already applied — a stale read-state on failure
      // is low-stakes and self-corrects next time this screen loads.
    }
  };

  const handleDelete = async (item: Notification) => {
    setItems((prev) => prev.filter((n) => n._id !== item._id));
    if (!item.read) decrementUnreadCount(1);
    try {
      await deleteNotification(item._id);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to delete notification."));
    }
  };

  const handleMarkAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    clearUnreadCount();
    try {
      await markAllNotificationsRead();
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to mark all as read."));
    }
  };

  const handleClearAll = async () => {
    setItems([]);
    clearUnreadCount();
    try {
      await clearAllNotifications();
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to clear notifications."));
    }
  };

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <View style={styles.container}>
      {(unreadCount > 0 || items.length > 0) && (
        <View style={styles.actionRow}>
          {unreadCount > 0 ? (
            <Pressable onPress={handleMarkAllRead}>
              <Text style={styles.actionText}>{t("Mark all read")}</Text>
            </Pressable>
          ) : (
            <View />
          )}
          {items.length > 0 && (
            <Pressable onPress={handleClearAll}>
              <Text style={styles.actionTextDanger}>{t("Clear all")}</Text>
            </Pressable>
          )}
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <View style={styles.list}>
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonRow key={i} lines={2} />
          ))}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const { icon, text } = getNotificationMeta(item.type);
            return (
              <View style={[styles.row, !item.read && styles.rowUnread]}>
                <Pressable style={styles.rowMain} onPress={() => handleMarkRead(item)}>
                  {item.sender.profile_pic_url ? (
                    <Image source={{ uri: item.sender.profile_pic_url }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarFallbackText}>
                        {item.sender.username.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.rowText}>
                    <Text style={styles.senderRow}>
                      {icon} {item.sender.username}
                    </Text>
                    <Text style={styles.notifText}>{text}</Text>
                    <Text style={styles.timestamp}>
                      {new Date(item.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  {!item.read && <View style={styles.unreadDot} />}
                </Pressable>
                <Pressable
                  style={styles.deleteButton}
                  onPress={() => handleDelete(item)}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.placeholder} />
                </Pressable>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>{t("No notifications yet.")}</Text>}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.base100 },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionText: { color: colors.primary, fontFamily: fonts.medium, fontSize: 13 },
  actionTextDanger: { color: colors.error, fontFamily: fonts.medium, fontSize: 13 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    marginBottom: 8,
  },
  rowUnread: { backgroundColor: colors.base200 },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.base200 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  rowText: { flex: 1 },
  senderRow: { fontFamily: fonts.bold, fontSize: 14, color: colors.baseContent },
  notifText: { fontSize: 13, color: colors.baseContent, marginTop: 2 },
  timestamp: { fontSize: 11, color: colors.placeholder, marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginLeft: 8 },
  deleteButton: { padding: 12 },
  empty: { textAlign: "center", color: colors.placeholder, marginTop: 40 },
  error: { color: colors.error, textAlign: "center", marginBottom: 8, paddingHorizontal: 16 },
});
