import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import { useToast } from "../context/ToastContext";
import { useKeyboardSafeExit } from "../hooks/useKeyboardSafeExit";
import { cachedRoom, rememberRoom, roomKey, roomPrefetch } from "../api/chatCache";
import { chatRows, dayHeading, mergeLatestPage, upsertMessage, type ChatRow } from "../utils/chatMessages";
import { SkeletonChatBubbles } from "./Skeleton";
import TierAvatarFrame from "./TierAvatarFrame";
import RecommendationMessageCard from "./RecommendationMessageCard";
import SyncShareMessageCard from "./SyncShareMessageCard";
import ProfileShareMessageCard from "./ProfileShareMessageCard";
import ListShareMessageCard from "./ListShareMessageCard";
import ProfileAnalysisShareMessageCard from "./ProfileAnalysisShareMessageCard";
import AnalyzeModal from "./AnalyzeModal";
import ProfileAnalysisModal from "./ProfileAnalysisModal";
import type { MatchAnalysis, Message, MessagePagination, MessageSender, ProfileAnalysis, RoomType } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const AVATAR_SIZE = 28;

type Colors = ReturnType<typeof useTheme>["colors"];

interface Props {
  roomType: RoomType;
  roomId: string;
  canChat: boolean;
  emptyText: string;
  /** Shown instead of the chat when `canChat` is false (a community you haven't joined). */
  lockedContent?: ReactNode;
  /** The other person in a DM, for cards that picture both people (a shared Sync). */
  counterpart?: MessageSender;
  // A first page the caller already has, so this room can render straight
  // into it instead of mounting and immediately fetching what its opener
  // was just handed. Used when a DM is opened from a profile, where the
  // find-or-create call returns the messages alongside the conversation.
  initialMessages?: { items: Message[]; pagination: MessagePagination };
  /** Older pages, for scrolling back. The newest page comes through chatCache's prefetcher. */
  fetchMessages: (before?: string, limit?: number) => Promise<{ items: Message[]; pagination: MessagePagination }>;
  markRead: () => Promise<void>;
  sendRest: (text: string) => Promise<Message>;
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.base100 },
    list: { paddingHorizontal: 14, paddingVertical: 12, flexGrow: 1 },
    locked: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    lockedText: { color: colors.placeholder, fontSize: 14, textAlign: "center" },
    row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
    rowOwn: { justifyContent: "flex-end" },
    rowOther: { justifyContent: "flex-start" },
    avatarSpacer: { width: AVATAR_SIZE },
    avatarFallback: { backgroundColor: colors.base200, alignItems: "center", justifyContent: "center" },
    avatarFallbackText: { fontFamily: fonts.bold, fontSize: 10, color: colors.primary },
    column: { maxWidth: "78%" },
    columnOwn: { alignItems: "flex-end" },
    senderName: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.placeholder, marginBottom: 3, marginLeft: 6 },
    bubble: { borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8 },
    bubbleOwn: { backgroundColor: colors.primary },
    bubbleOther: { backgroundColor: colors.base200 },
    tailOwn: { borderBottomRightRadius: 5 },
    tailOther: { borderBottomLeftRadius: 5 },
    bubblePending: { opacity: 0.6 },
    textOwn: { color: colors.primaryContent, fontSize: 15, lineHeight: 20 },
    textOther: { color: colors.baseContent, fontSize: 15, lineHeight: 20 },
    time: { fontSize: 10.5, color: colors.placeholder, marginTop: 3, marginHorizontal: 6 },
    day: { alignItems: "center", marginVertical: 12 },
    dayPill: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 5,
      backgroundColor: colors.base200,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    dayText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.placeholder, letterSpacing: 0.2 },
    // No scaleY counter-flip here. The list is `inverted`, and RN already
    // composes its own inversion style onto ListEmptyComponent
    // (VirtualizedList's _renderEmptyComponent) — and because the element's
    // own style wins that compose, a transform here REPLACES the inversion
    // rather than cancelling it, leaving the text mirrored.
    empty: { textAlign: "center", color: colors.placeholder, marginTop: 40 },
    failed: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
    retry: { borderRadius: 18, paddingHorizontal: 18, paddingVertical: 9, backgroundColor: colors.base200 },
    retryText: { fontFamily: fonts.bold, color: colors.baseContent },
    composer: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.base100,
    },
    input: {
      flex: 1,
      minHeight: 42,
      maxHeight: 120,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.base200,
      paddingHorizontal: 16,
      paddingTop: 11,
      paddingBottom: 11,
      fontSize: 15,
      color: colors.baseContent,
    },
    send: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  });
}

type Styles = ReturnType<typeof createStyles>;

const MessageRow = memo(function MessageRow({
  message,
  first,
  last,
  isOwn,
  showName,
  counterpart,
  onOpenAnalysis,
  onOpenProfileAnalysis,
  styles,
}: {
  message: Message;
  /** Starts a run of messages from one sender (see messageRuns). */
  first: boolean;
  /** Ends one. */
  last: boolean;
  isOwn: boolean;
  showName: boolean;
  counterpart?: MessageSender;
  onOpenAnalysis: (message: Message) => void;
  onOpenProfileAnalysis: (message: Message) => void;
  styles: Styles;
}) {
  const { t } = useTranslation();
  const pending = message.status === "pending";

  let body: ReactNode;
  if (message.type === "recommendation") {
    body = <RecommendationMessageCard message={message} isOwn={isOwn} />;
  } else if (message.type === "profile_share") {
    body = <ProfileShareMessageCard message={message} isOwn={isOwn} />;
  } else if (message.type === "list_share") {
    body = <ListShareMessageCard message={message} isOwn={isOwn} />;
  } else if (message.type === "analysis_share" && (message.analysisData as { type?: string } | undefined)?.type === "profile") {
    body = <ProfileAnalysisShareMessageCard message={message} isOwn={isOwn} onPress={() => onOpenProfileAnalysis(message)} />;
  } else if (message.type === "analysis_share") {
    body = (
      <SyncShareMessageCard message={message} isOwn={isOwn} counterpart={counterpart} onPress={() => onOpenAnalysis(message)} />
    );
  } else {
    body = (
      <View
        style={[
          styles.bubble,
          isOwn ? styles.bubbleOwn : styles.bubbleOther,
          last && (isOwn ? styles.tailOwn : styles.tailOther),
          pending && styles.bubblePending,
        ]}
      >
        <Text style={isOwn ? styles.textOwn : styles.textOther}>{message.text}</Text>
      </View>
    );
  }

  const sender = message.sender;
  return (
    // The list is inverted, which flips each row: a bottom margin here is the
    // gap *above* the row on screen, separating one run from the last.
    <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther, { marginBottom: first ? 10 : 2 }]}>
      {!isOwn &&
        (last ? (
          <TierAvatarFrame tier={sender.accountTier} size={AVATAR_SIZE}>
            {(innerSize) =>
              sender.profile_pic_url ? (
                <Image
                  source={{ uri: sender.profile_pic_url }}
                  style={{ width: innerSize, height: innerSize, borderRadius: innerSize / 2 }}
                />
              ) : (
                <View style={[styles.avatarFallback, { width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]}>
                  <Text style={styles.avatarFallbackText}>{sender.username.slice(0, 2).toUpperCase()}</Text>
                </View>
              )
            }
          </TierAvatarFrame>
        ) : (
          <View style={styles.avatarSpacer} />
        ))}
      <View style={[styles.column, isOwn && styles.columnOwn]}>
        {showName && first ? <Text style={styles.senderName}>{sender.username}</Text> : null}
        {body}
        {last ? (
          <Text style={styles.time}>
            {pending
              ? t("Sending...")
              : new Date(message.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
          </Text>
        ) : null}
      </View>
    </View>
  );
});

/** "Today", "Yesterday", "Monday", "3 September" — WhatsApp's names for a day, between that day's messages and the last. */
const DaySeparator = memo(function DaySeparator({ iso, styles }: { iso: string; styles: Styles }) {
  const { t, i18n } = useTranslation();
  const text = dayHeading(iso, new Date(), i18n.language, { today: t("Today"), yesterday: t("Yesterday") });
  return (
    <View style={styles.day} accessibilityRole="header">
      <View style={styles.dayPill}>
        <Text style={styles.dayText}>{text}</Text>
      </View>
    </View>
  );
});

// Shared message-list/composer UI for both DM and group chat — socket room
// membership (join-room/leave-room) is intentionally NOT handled here since
// DM and group screens have genuinely different correct lifecycles (DM
// screens stay mounted on blur so they use useFocusEffect; a group's Chat
// tab actually mounts/unmounts with tab switches, so a plain useEffect in
// the parent already does the right thing).
//
// One room per mount: callers key it by room, so a different room is a fresh
// component rather than this one's state carried over.
//
// A chat opened before shows its cached messages on the first frame and
// refreshes underneath (chatCache.ts), so only a first visit shows a skeleton.
export default function ChatRoom({
  roomType,
  roomId,
  canChat,
  emptyText,
  lockedContent,
  counterpart,
  initialMessages,
  fetchMessages,
  markRead,
  sendRest,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { connected, sendMessage, onNewMessage } = useChat();
  const key = roomKey(roomType, roomId);
  useKeyboardSafeExit();


  const [seed] = useState(() => initialMessages ?? cachedRoom(key));
  const [messages, setMessages] = useState<Message[]>(seed?.items ?? []);
  const [pagination, setPagination] = useState<MessagePagination | null>(seed?.pagination ?? null);
  const [loading, setLoading] = useState(!seed);
  const [failed, setFailed] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState("");
  const [viewingAnalysis, setViewingAnalysis] = useState<MatchAnalysis | null>(null);
  const [viewingProfileAnalysis, setViewingProfileAnalysis] = useState<ProfileAnalysis | null>(null);
  // Refs for callbacks that must not change identity with every message.
  const markReadRef = useRef(markRead);
  markReadRef.current = markRead;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const loadLatest = useCallback(() => {
    let cancelled = false;
    setFailed(false);
    // Nothing to show while it loads (a retry, or a community just joined):
    // the skeleton, not an empty chat that claims there are no messages.
    if (messagesRef.current.length === 0) setLoading(true);
    roomPrefetch
      .take(key)
      .then(({ items, pagination: fresh }) => {
        if (cancelled) return;
        setMessages((prev) => mergeLatestPage(prev, items, fresh.hasMore));
        // With older history still on the server, the older messages kept
        // from the cache carry the right cursor; otherwise the fresh one does.
        setPagination((prev) => (fresh.hasMore && prev ? prev : fresh));
        markReadRef.current().catch(() => {});
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  useEffect(() => {
    if (!canChat) {
      setLoading(false);
      return;
    }
    // Handed a page by the opener: it's current, so only mark it read.
    if (initialMessages) {
      markReadRef.current().catch(() => {});
      return;
    }
    return loadLatest();
    // The opener's page describes the room this component mounted with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canChat, loadLatest]);

  // Keeps the cache in step, so leaving and coming back shows exactly this.
  useEffect(() => {
    if (pagination) rememberRoom(key, { items: messages, pagination });
  }, [key, messages, pagination]);

  useEffect(
    () => onNewMessage(roomId, (incoming) => setMessages((prev) => upsertMessage(prev, incoming))),
    [roomId, onNewMessage]
  );

  const loadOlder = useCallback(async () => {
    if (loadingOlder || !pagination?.hasMore || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const { items, pagination: older } = await fetchMessages(messages[0].createdAt);
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m._id));
        return [...items.filter((m) => !known.has(m._id)), ...prev];
      });
      setPagination(older);
    } catch {
      // Scrolling back up tries again.
    } finally {
      setLoadingOlder(false);
    }
  }, [fetchMessages, loadingOlder, messages, pagination?.hasMore]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !user) return;
    const clientTempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: Message = {
      _id: clientTempId,
      clientTempId,
      roomType,
      roomId,
      sender: { _id: user._id, username: user.username, profile_pic_url: user.profile_pic_url },
      text: trimmed,
      type: "text",
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    setMessages((prev) => [...prev, optimistic]);
    setText("");

    if (connected) {
      sendMessage(roomType, roomId, trimmed, clientTempId);
      return;
    }
    // No socket (reconnecting, or the server waking up): the same message
    // goes over REST instead of the send button simply not working.
    try {
      const sent = await sendRest(trimmed);
      setMessages((prev) => prev.map((m) => (m._id === clientTempId ? sent : m)));
    } catch {
      setMessages((prev) => prev.filter((m) => m._id !== clientTempId));
      setText((current) => current || trimmed);
      showToast(t("Message not sent. Please try again."));
    }
  };

  // Inverted list: newest first.
  const rows = useMemo(() => chatRows(messages).reverse(), [messages]);

  const openAnalysis = useCallback(
    (message: Message) => setViewingAnalysis((message.analysisData as MatchAnalysis) ?? null),
    []
  );
  const openProfileAnalysis = useCallback(
    (message: Message) => setViewingProfileAnalysis((message.analysisData as ProfileAnalysis) ?? null),
    []
  );

  const userId = user?._id;
  const showNames = roomType === "group";
  const renderItem = useCallback(
    ({ item }: { item: ChatRow }) => {
      if (item.kind === "day") return <DaySeparator iso={item.iso} styles={styles} />;
      const isOwn = item.message.sender._id === userId;
      return (
        <MessageRow
          message={item.message}
          first={item.first}
          last={item.last}
          isOwn={isOwn}
          showName={showNames && !isOwn}
          counterpart={counterpart}
          onOpenAnalysis={openAnalysis}
          onOpenProfileAnalysis={openProfileAnalysis}
          styles={styles}
        />
      );
    },
    [userId, showNames, counterpart, openAnalysis, openProfileAnalysis, styles]
  );

  if (!canChat) {
    return lockedContent ? (
      <>{lockedContent}</>
    ) : (
      <View style={styles.locked}>
        <Text style={styles.lockedText}>{t("Join this group to participate in the chat.")}</Text>
      </View>
    );
  }

  const canSend = text.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {loading ? (
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <SkeletonChatBubbles />
        </View>
      ) : failed && messages.length === 0 ? (
        <View style={styles.failed}>
          <Text style={styles.lockedText}>{t("Couldn't load messages.")}</Text>
          <Pressable style={({ pressed }) => [styles.retry, pressed && { opacity: 0.7 }]} onPress={loadLatest}>
            <Text style={styles.retryText}>{t("Try again")}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          inverted
          data={rows}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          onEndReached={loadOlder}
          onEndReachedThreshold={0.3}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          initialNumToRender={20}
          windowSize={11}
          ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
          ListFooterComponent={loadingOlder ? <ActivityIndicator style={{ margin: 12 }} color={colors.primary} /> : null}
        />
      )}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder={t("Message...")}
          placeholderTextColor={colors.placeholder}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
        />
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t("Send")}
          style={({ pressed }) => [
            styles.send,
            { backgroundColor: canSend ? colors.primary : colors.base200 },
            pressed && { transform: [{ scale: 0.92 }] },
          ]}
        >
          <Ionicons name="arrow-up" size={20} color={canSend ? colors.primaryContent : colors.placeholder} />
        </Pressable>
      </View>

      <AnalyzeModal visible={!!viewingAnalysis} onClose={() => setViewingAnalysis(null)} data={viewingAnalysis} />
      <ProfileAnalysisModal
        visible={!!viewingProfileAnalysis}
        onClose={() => setViewingProfileAnalysis(null)}
        data={viewingProfileAnalysis}
      />
    </KeyboardAvoidingView>
  );
}
