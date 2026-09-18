import { memo, useCallback, useMemo, useState } from "react";
import { View, Text, Image, FlatList, RefreshControl, StyleSheet } from "react-native";
// Gesture handler's Pressable, not React Native's: on Android (new
// architecture) RN's Pressable re-measures itself on every press and cancels
// the press when the finger seems to leave that box. After the keyboard had
// resized the window, those measurements came back wrong for screens that
// were underneath at the time — every tap on the Socials page then fired
// onPressIn but never onPress. Gesture handler lets Android's own hit
// testing decide instead, so there's nothing to measure wrong.
import { Pressable } from "react-native-gesture-handler";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useChat } from "../../context/ChatContext";
import { useAuth } from "../../context/AuthContext";
import { roomKey, roomPrefetch } from "../../api/chatCache";
import { refreshGroup } from "../../api/communitiesStore";
import { formatInboxTime } from "../../utils/chatMessages";
import { SkeletonRow } from "../Skeleton";
import TierAvatarFrame from "../TierAvatarFrame";
import type { Conversation, GroupConversationRow } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

const AVATAR_SIZE = 52;

type InboxItem = Conversation | GroupConversationRow;
type Colors = ReturnType<typeof useTheme>["colors"];

function createStyles(colors: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.base100 },
    list: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 24, flexGrow: 1 },
    row: { flexDirection: "row", alignItems: "center", gap: 13, paddingHorizontal: 8, paddingVertical: 10, borderRadius: 16 },
    rowPressed: { backgroundColor: colors.base200 },
    avatarFallback: { backgroundColor: colors.base200, alignItems: "center", justifyContent: "center" },
    avatarFallbackText: { fontFamily: fonts.bold, fontSize: 16, color: colors.primary },
    groupTile: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: `${colors.primary}1F`,
    },
    groupImage: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: 17 },
    text: { flex: 1, minWidth: 0 },
    topLine: { flexDirection: "row", alignItems: "center", gap: 8 },
    name: { flex: 1, fontFamily: fonts.bold, fontSize: 15.5, color: colors.baseContent },
    nameUnread: { fontFamily: fonts.extrabold },
    time: { fontFamily: fonts.medium, fontSize: 12, color: colors.placeholder },
    timeUnread: { color: colors.primary, fontFamily: fonts.bold },
    bottomLine: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
    preview: { flex: 1, fontSize: 14, lineHeight: 19, color: colors.placeholder },
    previewUnread: { color: colors.baseContent, fontFamily: fonts.medium },
    badge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 6,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeText: { fontSize: 11, fontFamily: fonts.bold, color: colors.primaryContent },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 36, paddingBottom: 60, gap: 10 },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.base200,
      marginBottom: 6,
    },
    emptyTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.baseContent },
    emptyText: { fontSize: 14.5, lineHeight: 21, color: colors.placeholder, textAlign: "center" },
    emptyButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 10,
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    emptyButtonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 15 },
    skeleton: { paddingHorizontal: 18, paddingTop: 8 },
  });
}

type Styles = ReturnType<typeof createStyles>;

const InboxRow = memo(function InboxRow({
  item,
  time,
  preview,
  styles,
  colors,
  onOpen,
  onWarm,
}: {
  item: InboxItem;
  time: string | null;
  preview: string;
  styles: Styles;
  colors: Colors;
  onOpen: (item: InboxItem) => void;
  onWarm: (item: InboxItem) => void;
}) {
  const unread = item.unreadCount > 0;
  const name = item.type === "group" ? item.name : item.otherUser.username;

  let avatar;
  if (item.type === "group") {
    avatar = item.coverImage ? (
      <Image source={{ uri: item.coverImage }} style={styles.groupImage} />
    ) : (
      <View style={styles.groupTile}>
        <Ionicons name="people" size={24} color={colors.primary} />
      </View>
    );
  } else {
    const other = item.otherUser;
    avatar = (
      <TierAvatarFrame tier={other.accountTier} size={AVATAR_SIZE}>
        {(innerSize) =>
          other.profile_pic_url ? (
            <Image source={{ uri: other.profile_pic_url }} style={{ width: innerSize, height: innerSize, borderRadius: innerSize / 2 }} />
          ) : (
            <View style={[styles.avatarFallback, { width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]}>
              <Text style={styles.avatarFallbackText}>{other.username.slice(0, 2).toUpperCase()}</Text>
            </View>
          )
        }
      </TierAvatarFrame>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => onOpen(item)}
      onPressIn={() => onWarm(item)}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${preview}${unread ? `, ${item.unreadCount}` : ""}`}
    >
      {avatar}
      <View style={styles.text}>
        <View style={styles.topLine}>
          <Text style={[styles.name, unread && styles.nameUnread]} numberOfLines={1}>
            {name}
          </Text>
          {time ? <Text style={[styles.time, unread && styles.timeUnread]}>{time}</Text> : null}
        </View>
        <View style={styles.bottomLine}>
          <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
            {preview}
          </Text>
          {unread ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

// The Messages tab: every DM and every community you're in, newest activity
// first. Reads straight from ChatContext, which loads the inbox at sign-in
// and keeps it current over the socket — so after the first load this never
// shows a skeleton, only a quiet refresh when the tab regains focus.
export default function MessagesSection() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const { conversations, groupConversations, inboxLoaded, refreshConversations } = useChat();

  const rows = useMemo(() => {
    const now = new Date();
    return [...conversations, ...groupConversations]
      .sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime())
      .map((item) => {
        let preview = item.lastMessage || t("No messages yet");
        // In a community, who said it matters as much as what was said.
        if (item.type === "group" && item.lastMessage && item.lastMessageSenderId) {
          const mine = item.lastMessageSenderId._id === user?._id;
          preview = `${mine ? t("You") : item.lastMessageSenderId.username}: ${item.lastMessage}`;
        }
        return {
          item,
          preview,
          time: item.lastMessageAt ? formatInboxTime(item.lastMessageAt, now, i18n.language) : null,
        };
      });
  }, [conversations, groupConversations, t, i18n.language, user?._id]);

  useFocusEffect(
    useCallback(() => {
      refreshConversations();
    }, [refreshConversations])
  );

  const [refreshing, setRefreshing] = useState(false);
  const pullToRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshConversations();
    setRefreshing(false);
  }, [refreshConversations]);

  const open = useCallback(
    (item: InboxItem) => {
      if (item.type === "group") {
        router.push(`/socials/communities/${item.slug}`);
      } else {
        router.push({
          pathname: "/socials/messages/[conversationId]",
          params: { conversationId: item._id, otherUsername: item.otherUser.username },
        });
      }
    },
    [router]
  );

  // Touch-down starts the chat's first page, so it's usually there by the
  // time the screen finishes sliding in.
  const warm = useCallback((item: InboxItem) => {
    if (item.type === "group") {
      roomPrefetch.prefetch(roomKey("group", item._id));
      refreshGroup(item.slug).catch(() => {});
    } else {
      roomPrefetch.prefetch(roomKey("dm", item._id));
    }
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: (typeof rows)[number] }) => (
      <InboxRow
        item={item.item}
        time={item.time}
        preview={item.preview}
        styles={styles}
        colors={colors}
        onOpen={open}
        onWarm={warm}
      />
    ),
    [styles, colors, open, warm]
  );

  if (!inboxLoaded && rows.length === 0) {
    return (
      <View style={[styles.container, styles.skeleton]}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <SkeletonRow key={i} lines={2} />
        ))}
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={rows}
      keyExtractor={(row) => row.item._id}
      contentContainerStyle={styles.list}
      renderItem={renderItem}
      initialNumToRender={12}
      // No inputs here: a tap is always for the row, never "dismiss the
      // keyboard first" — which a keyboard left up by the chat just closed
      // would otherwise turn every tap into.
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} tintColor={colors.primary} />}
      ListEmptyComponent={
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="chatbubbles-outline" size={32} color={colors.placeholder} />
          </View>
          <Text style={styles.emptyTitle}>{t("No messages yet")}</Text>
          <Text style={styles.emptyText}>{t("Start a conversation or recommend a title to a friend.")}</Text>
          <Pressable
            style={({ pressed }) => [styles.emptyButton, pressed && { transform: [{ scale: 0.97 }] }]}
            onPress={() => router.push("/socials/messages/new")}
          >
            <Ionicons name="create-outline" size={18} color={colors.primaryContent} />
            <Text style={styles.emptyButtonText}>{t("New Message")}</Text>
          </Pressable>
        </View>
      }
    />
  );
}
