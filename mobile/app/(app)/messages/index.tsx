import { View, Text, Image, FlatList, Pressable, RefreshControl, StyleSheet } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useCallback, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useChat } from "../../../src/context/ChatContext";
import { SkeletonRow } from "../../../src/components/Skeleton";
import type { Conversation, GroupConversationRow } from "../../../src/types";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

type InboxItem = Conversation | GroupConversationRow;

export default function MessagesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.base100 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.base200 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary },
  rowText: { flex: 1 },
  username: { fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent },
  lastMessage: { fontSize: 13, color: colors.placeholder, marginTop: 2 },
  rowMeta: { alignItems: "flex-end", gap: 6 },
  timestamp: { fontSize: 11, color: colors.placeholder },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 10, fontFamily: fonts.bold, color: "#ffffff" },
  emptyState: { alignItems: "center", marginTop: 60 },
  empty: { textAlign: "center", color: colors.placeholder, marginBottom: 16 },
  newButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  newButtonText: { color: colors.primaryContent, fontFamily: fonts.bold },
}), [colors]);
  const { t } = useTranslation();
  const router = useRouter();
  const { conversations, groupConversations, refreshConversations } = useChat();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const inboxItems = useMemo<InboxItem[]>(
    () =>
      [...conversations, ...groupConversations].sort(
        (a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()
      ),
    [conversations, groupConversations]
  );

  useFocusEffect(
    useCallback(() => {
      refreshConversations().finally(() => setLoading(false));
    }, [])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshConversations();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: InboxItem }) => {
    if (item.type === "group") {
      return (
        <Pressable style={styles.row} onPress={() => router.push(`/community/${item.slug}`)}>
          {item.coverImage ? (
            <Image source={{ uri: item.coverImage }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarFallbackText}>{item.name.slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.rowText}>
            <Text style={styles.username}>{item.name}</Text>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.lastMessage || t("No messages yet")}
            </Text>
          </View>
          <View style={styles.rowMeta}>
            {item.lastMessageAt && (
              <Text style={styles.timestamp}>
                {new Date(item.lastMessageAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </Text>
            )}
            {item.unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.unreadCount > 9 ? "9+" : item.unreadCount}</Text>
              </View>
            )}
          </View>
        </Pressable>
      );
    }
    return (
      <Pressable style={styles.row} onPress={() => router.push(`/messages/${item._id}`)}>
        {item.otherUser.profile_pic_url ? (
          <Image source={{ uri: item.otherUser.profile_pic_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarFallbackText}>
              {item.otherUser.username.slice(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.rowText}>
          <Text style={styles.username}>{item.otherUser.username}</Text>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage || t("No messages yet")}
          </Text>
        </View>
        <View style={styles.rowMeta}>
          {item.lastMessageAt && (
            <Text style={styles.timestamp}>
              {new Date(item.lastMessageAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </Text>
          )}
          {item.unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.unreadCount > 9 ? "9+" : item.unreadCount}</Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.list}>
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonRow key={i} lines={2} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={inboxItems}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.empty}>{t("No messages yet")}</Text>
            <Pressable style={styles.newButton} onPress={() => router.push("/messages/new")}>
              <Text style={styles.newButtonText}>{t("New Message")}</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

