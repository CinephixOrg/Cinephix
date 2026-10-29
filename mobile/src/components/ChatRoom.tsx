import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  AppState,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Pressable from "./common/TapSafePressable";
import KeyboardInsetView from "./common/KeyboardInsetView";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import { useToast } from "../context/ToastContext";
import { useKeyboardSafeExit } from "../hooks/useKeyboardSafeExit";
import { useBlockedIds } from "../hooks/useBlocked";
import { isProtectedAccount } from "../api/blockStore";
import { useSafety } from "../context/SafetyContext";
import { cachedRoom, rememberRoom, roomKey, roomPrefetch } from "../api/chatCache";
import {
  DELETED_SENDER_ID,
  applyRead,
  chatRows,
  dayHeading,
  deliveryState,
  mergeLatestPage,
  upsertMessage,
  withSenders,
  type ChatRow,
  type DeliveryState,
} from "../utils/chatMessages";
import { firstVisibleOn } from "../utils/color";
import MessageInfoSheet from "./chat/MessageInfoSheet";
import { SkeletonChatBubbles } from "./Skeleton";
import TierAvatarFrame from "./TierAvatarFrame";
import RecommendationMessageCard from "./RecommendationMessageCard";
import SyncShareMessageCard from "./SyncShareMessageCard";
import ProfileShareMessageCard from "./ProfileShareMessageCard";
import ListShareMessageCard from "./ListShareMessageCard";
import CommunityAnnouncementMessageCard from "./CommunityAnnouncementMessageCard";
import ProfileAnalysisShareMessageCard from "./ProfileAnalysisShareMessageCard";
import AnalyzeModal from "./AnalyzeModal";
import { usePathname, useRouter } from "expo-router";
import { setPendingProfileAnalysis } from "../utils/pendingProfileAnalysis";
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
  /** Unlike `canChat` (hides the whole room), this still shows the real
   * message history — only the composer is replaced by this text, greyed
   * out and unsendable. For a room whose write-window has simply closed
   * (TC-112: an ended watch party) rather than one the viewer never had
   * access to. */
  composeDisabledReason?: string;
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
  /**
   * How many people one of your messages is for — 1 in a DM, the other
   * members in a group — so its ticks turn to read once they all have.
   * Left out where reads aren't tracked (watch parties): no ticks there.
   */
  readersNeeded?: number;
}

// Read receipts' blue: the theme's own, unless it doesn't stand out on what's
// underneath (a green bubble), then a darker one that does.
const READ_BLUES = ["#1e3a8a"];
const SEEN_BLUE_ON_BACKGROUND = ["#53bdeb"];

interface TickColors {
  sent: string;
  read: string;
}

/** A message's ticks: a clock while sending, ✓ once sent, a blue ✓✓ once read. */
const DeliveryTicks = memo(function DeliveryTicks({ state, colors }: { state: DeliveryState; colors: TickColors }) {
  const { t } = useTranslation();
  if (state === "pending") {
    return <Ionicons name="time-outline" size={12} color={colors.sent} accessibilityLabel={t("Sending...")} />;
  }
  return state === "read" ? (
    <Ionicons name="checkmark-done" size={15} color={colors.read} accessibilityLabel={t("Read")} />
  ) : (
    <Ionicons name="checkmark" size={14} color={colors.sent} accessibilityLabel={t("Sent")} />
  );
});

function createStyles(colors: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.base100 },
    fill: { flex: 1 },
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
    // Room on the right for the ticks, which sit in the bubble's corner.
    bubbleWithTicks: { paddingRight: 13 + 18 },
    bubbleTicks: { position: "absolute", right: 9, bottom: 7 },
    meta: { flexDirection: "row", alignItems: "center", gap: 3 },
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
  onLongPress,
  onOpenInfo,
  delivery,
  bubbleTicks,
  metaTicks,
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
  /** Report / block — offered on other people's messages only. */
  onLongPress?: (message: Message) => void;
  /** Who has read it — offered on your own messages, where reads are tracked. */
  onOpenInfo?: (message: Message) => void;
  /** Your own message's ticks; absent on other people's and where reads aren't tracked. */
  delivery?: DeliveryState;
  /** Tick colours inside your (primary) bubble, and on the chat's background under a card. */
  bubbleTicks: TickColors;
  metaTicks: TickColors;
  styles: Styles;
}) {
  const { t } = useTranslation();
  const pending = message.status === "pending";
  // Belt-and-suspenders: every entry point already runs messages through
  // withSenders() (conversationService.ts/groupService.ts on fetch, this
  // file's own onNewMessage handler on the socket path), which replaces a
  // null sender with this exact placeholder shape — but a stray caller
  // that skipped that step shouldn't crash this row either.
  const sender = message.sender ?? { _id: DELETED_SENDER_ID, username: "" };
  const deleted = sender._id === DELETED_SENDER_ID;
  const senderName = deleted ? t("Deleted account") : sender.username;
  const longPress = isOwn
    ? !pending && onOpenInfo
      ? () => onOpenInfo(message)
      : undefined
    : !pending && !deleted && onLongPress && !isProtectedAccount(message.sender)
      ? () => onLongPress(message)
      : undefined;
  const isText = !["recommendation", "profile_share", "list_share", "community_announcement", "analysis_share"].includes(
    message.type
  );

  let body: ReactNode;
  if (message.type === "recommendation") {
    body = <RecommendationMessageCard message={message} isOwn={isOwn} onLongPress={longPress} />;
  } else if (message.type === "profile_share") {
    body = <ProfileShareMessageCard message={message} isOwn={isOwn} onLongPress={longPress} />;
  } else if (message.type === "list_share") {
    body = <ListShareMessageCard message={message} isOwn={isOwn} onLongPress={longPress} />;
  } else if (message.type === "community_announcement") {
    body = <CommunityAnnouncementMessageCard message={message} isOwn={isOwn} onLongPress={longPress} />;
  } else if (message.type === "analysis_share" && (message.analysisData as { type?: string } | undefined)?.type === "profile") {
    body = (
      <ProfileAnalysisShareMessageCard
        message={message}
        isOwn={isOwn}
        onPress={() => onOpenProfileAnalysis(message)}
        onLongPress={longPress}
      />
    );
  } else if (message.type === "analysis_share") {
    body = (
      <SyncShareMessageCard
        message={message}
        isOwn={isOwn}
        counterpart={counterpart}
        onPress={() => onOpenAnalysis(message)}
        onLongPress={longPress}
      />
    );
  } else {
    // The bubble's shape and colour live on a plain View inside the
    // Pressable, not on the Pressable itself. Gesture handler's Pressable
    // draws its own background on Android and doesn't undo a corner radius
    // that's taken away: a message that stopped being the last of its run
    // lost its tail corner and every rounded corner with it, turning square.
    body = (
      <Pressable
        onLongPress={longPress}
        delayLongPress={350}
        disabled={!longPress}
        style={({ pressed }) => pressed && longPress && { opacity: 0.75 }}
      >
        <View
          style={[
            styles.bubble,
            isOwn ? styles.bubbleOwn : styles.bubbleOther,
            last && (isOwn ? styles.tailOwn : styles.tailOther),
            pending && styles.bubblePending,
            delivery && styles.bubbleWithTicks,
          ]}
        >
          <Text style={isOwn ? styles.textOwn : styles.textOther}>{message.text}</Text>
          {delivery ? (
            <View style={styles.bubbleTicks}>
              <DeliveryTicks state={delivery} colors={bubbleTicks} />
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  }

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
                  <Text style={styles.avatarFallbackText}>{senderName.slice(0, 2).toUpperCase()}</Text>
                </View>
              )
            }
          </TierAvatarFrame>
        ) : (
          <View style={styles.avatarSpacer} />
        ))}
      <View style={[styles.column, isOwn && styles.columnOwn]}>
        {showName && first ? <Text style={styles.senderName}>{senderName}</Text> : null}
        {body}
        {last ? (
          <View style={styles.meta}>
            <Text style={styles.time}>
              {pending
                ? t("Sending...")
                : new Date(message.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </Text>
            {/* A card has no bubble to hold its ticks: they go by its time. */}
            {delivery && !isText ? <DeliveryTicks state={delivery} colors={metaTicks} /> : null}
          </View>
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
  composeDisabledReason,
  counterpart,
  initialMessages,
  fetchMessages,
  markRead,
  sendRest,
  readersNeeded,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const tickColors = useMemo(
    () => ({
      bubble: {
        sent: `${colors.primaryContent}8C`,
        read: firstVisibleOn(colors.primary, [colors.info, ...READ_BLUES], colors.primaryContent),
      },
      meta: {
        sent: colors.placeholder,
        read: firstVisibleOn(colors.base100, [colors.info, ...SEEN_BLUE_ON_BACKGROUND], colors.baseContent),
      },
    }),
    [colors]
  );
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { connected, sendMessage, onNewMessage, onMessagesRead } = useChat();
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
  const [infoMessage, setInfoMessage] = useState<Message | null>(null);
  const router = useRouter();
  // Self-derived, same reasoning as ContentDetailScreen.tsx/
  // AnalyzeStoryScreen.tsx: this component is reused across Socials'
  // communities chat, Socials' DM conversation, a public profile's chat,
  // and a watch-party room (all under their own tab's stack), so it
  // resolves which stack it's running under from the URL rather than
  // taking a basePath prop from each of those 4 call sites.
  const pathname = usePathname();
  const basePath = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments[0] === "user" && segments[1]) return `/user/${segments[1]}`;
    return segments[0] ? `/${segments[0]}` : "/socials";
  }, [pathname]);
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

  // Someone else's message arriving while you're in the room is read there
  // and then: mark it, so their ticks turn (and the room's unread count stays
  // at zero). Bursts are marked once; not while the app is in the background.
  const userIdRef = useRef(user?._id);
  userIdRef.current = user?._id;
  const markReadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(markReadTimer.current), []);

  useEffect(
    () =>
      onNewMessage(roomId, (incoming) => {
        // Normalized the same way the REST fetch already is (conversationService.ts/
        // groupService.ts both wrap their responses in withSenders) — a
        // socket-delivered message skipped that wrapping entirely, so a
        // deleted account's live message still arrived with a genuinely
        // null `sender` and crashed on the very next line.
        const [normalized] = withSenders([incoming]);
        setMessages((prev) => upsertMessage(prev, normalized));
        if (normalized.sender?._id === userIdRef.current || AppState.currentState !== "active") return;
        clearTimeout(markReadTimer.current);
        markReadTimer.current = setTimeout(() => markReadRef.current().catch(() => {}), 400);
      }),
    [roomId, onNewMessage]
  );

  // Your messages being read, live.
  useEffect(
    () => onMessagesRead(roomId, (event) => setMessages((prev) => applyRead(prev, event))),
    [roomId, onMessagesRead]
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
  // Someone blocked in this session disappears from the chat at once (their
  // live messages in a community included); the server does the rest.
  const blocked = useBlockedIds();
  const rows = useMemo(
    // `sender` can be null for a message from a since-deleted account — not
    // in `blocked` either way, so it's never incorrectly filtered out.
    () => chatRows(blocked.size ? messages.filter((m) => !blocked.has(m.sender?._id ?? "")) : messages).reverse(),
    [messages, blocked]
  );
  const { openContentActions } = useSafety();
  const reportMessage = useCallback(
    (message: Message) =>
      openContentActions({
        entityType: "Message",
        entityId: message._id,
        author: message.sender ? { _id: message.sender._id, username: message.sender.username } : { _id: "", username: t("Deleted account") },
      }),
    [openContentActions, t]
  );

  const openAnalysis = useCallback(
    (message: Message) => setViewingAnalysis((message.analysisData as MatchAnalysis) ?? null),
    []
  );
  // Opens the same full-screen analysis story the owner sees on their own
  // Profile (AnalyzeStoryScreen), staged with origin "shared" so it shows
  // an ownership header instead of a Share CTA — viewing someone else's
  // shared analysis here isn't a re-share decision.
  const openProfileAnalysis = useCallback(
    (message: Message) => {
      const data = message.analysisData as ProfileAnalysis | undefined;
      if (!data) return;
      setPendingProfileAnalysis(data, "shared");
      router.push(`${basePath}/analyze-story` as never);
    },
    [router, basePath]
  );

  const userId = user?._id;
  const showNames = roomType === "group" || roomType === "watchparty";
  // Reads are tracked in DMs and groups; readersNeeded says so.
  const tracksReads = readersNeeded !== undefined;
  const renderItem = useCallback(
    ({ item }: { item: ChatRow }) => {
      if (item.kind === "day") return <DaySeparator iso={item.iso} styles={styles} />;
      // sender?._id — a message from a deleted account is never "own".
      const isOwn = item.message.sender?._id === userId;
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
          onLongPress={reportMessage}
          onOpenInfo={tracksReads ? setInfoMessage : undefined}
          delivery={isOwn && tracksReads ? deliveryState(item.message, readersNeeded ?? 0) : undefined}
          bubbleTicks={tickColors.bubble}
          metaTicks={tickColors.meta}
          styles={styles}
        />
      );
    },
    [userId, showNames, counterpart, openAnalysis, openProfileAnalysis, reportMessage, tracksReads, readersNeeded, tickColors, styles]
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

  const canSend = !composeDisabledReason && text.trim().length > 0;

  return (
    // Android lifts the composer over the keyboard with KeyboardInsetView; iOS
    // does it with the KeyboardAvoidingView inside.
    <KeyboardInsetView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.fill}
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
  
        {/* Clear of the phone's own Back/Home buttons where the chat reaches the
            bottom of the screen (a DM opened from a profile has no tab bar
            under it). Only the part actually under those buttons is added, so
            above a tab bar or the keyboard this adds nothing. */}
        <SafeAreaView edges={["bottom"]} style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder={composeDisabledReason ?? t("Message...")}
            placeholderTextColor={colors.placeholder}
            value={composeDisabledReason ? "" : text}
            onChangeText={setText}
            editable={!composeDisabledReason}
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
        </SafeAreaView>
  
        <AnalyzeModal visible={!!viewingAnalysis} onClose={() => setViewingAnalysis(null)} data={viewingAnalysis} />
        {tracksReads ? (
          <MessageInfoSheet message={infoMessage} roomType={roomType} onClose={() => setInfoMessage(null)} />
        ) : null}
      </KeyboardAvoidingView>
    </KeyboardInsetView>
  );
}
