import { useEffect, useState, useMemo } from "react";
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
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import { SkeletonChatBubbles } from "./Skeleton";
import RecommendationMessageCard from "./RecommendationMessageCard";
import AnalyzeModal from "./AnalyzeModal";
import ProfileAnalysisModal from "./ProfileAnalysisModal";
import type { MatchAnalysis, Message, MessagePagination, ProfileAnalysis, RoomType } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

interface Props {
  roomType: RoomType;
  roomId: string;
  canChat: boolean;
  emptyText: string;
  fetchMessages: (
    before?: string,
    limit?: number
  ) => Promise<{ items: Message[]; pagination: MessagePagination }>;
  markRead: () => Promise<void>;
  sendRest: (text: string) => Promise<Message>;
}

// Shared message-list/composer UI for both DM and group chat — socket room
// membership (join-room/leave-room) is intentionally NOT handled here since
// DM and group screens have genuinely different correct lifecycles (DM
// screens stay mounted on blur so they use useFocusEffect; a group's Chat
// tab actually mounts/unmounts with tab switches, so a plain useEffect in
// the parent already does the right thing).
export default function ChatRoom({ roomType, roomId, canChat, emptyText, fetchMessages, markRead, sendRest }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.base100 },
  list: { padding: 16, gap: 10, flexGrow: 1 },
  joinPrompt: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  joinPromptText: { color: colors.placeholder, fontSize: 14, textAlign: "center" },
  messageRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 4 },
  messageRowOwn: { justifyContent: "flex-end" },
  messageRowOther: { justifyContent: "flex-start" },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.base200 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { fontFamily: fonts.bold, fontSize: 10, color: colors.primary },
  bubbleColumn: { maxWidth: "75%" },
  senderName: { fontSize: 11, color: colors.placeholder, marginBottom: 2, marginLeft: 4 },
  bubble: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleOwn: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: colors.base200, borderBottomLeftRadius: 4 },
  bubblePending: { opacity: 0.6 },
  bubbleTextOwn: { color: colors.primaryContent, fontSize: 14 },
  bubbleTextOther: { color: colors.baseContent, fontSize: 14 },
  timestamp: { fontSize: 10, color: colors.placeholder, marginTop: 2 },
  timestampOwn: { textAlign: "right", marginRight: 4 },
  timestampOther: { textAlign: "left", marginLeft: 4 },
  empty: { textAlign: "center", color: colors.placeholder, marginTop: 40, transform: [{ scaleY: -1 }] },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.base100,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.base200,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.baseContent,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 14 },
}), [colors]);
  const { t } = useTranslation();
  const { user } = useAuth();
  const { connected, sendMessage, onNewMessage } = useChat();

  const [messages, setMessages] = useState<Message[]>([]);
  const [pagination, setPagination] = useState<MessagePagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState("");
  const [viewingAnalysis, setViewingAnalysis] = useState<MatchAnalysis | null>(null);
  const [viewingProfileAnalysis, setViewingProfileAnalysis] = useState<ProfileAnalysis | null>(null);

  useEffect(() => {
    if (!canChat) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { items, pagination: p } = await fetchMessages();
        if (!cancelled) {
          setMessages(items);
          setPagination(p);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
      markRead().catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [roomType, roomId, canChat]);

  useEffect(() => {
    const unsubscribe = onNewMessage(roomId, (incoming) => {
      setMessages((prev) => {
        if (incoming.clientTempId) {
          const idx = prev.findIndex((m) => m._id === incoming.clientTempId);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = incoming;
            return next;
          }
        }
        if (prev.some((m) => m._id === incoming._id)) return prev;
        return [...prev, incoming];
      });
    });
    return unsubscribe;
  }, [roomId]);

  const loadOlder = async () => {
    if (loadingOlder || !pagination?.hasMore || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const { items, pagination: p } = await fetchMessages(messages[0].createdAt);
      setMessages((prev) => [...items, ...prev]);
      setPagination(p);
    } finally {
      setLoadingOlder(false);
    }
  };

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
    } else {
      try {
        const sent = await sendRest(trimmed);
        setMessages((prev) => prev.map((m) => (m._id === clientTempId ? sent : m)));
      } catch {
        // Leave the optimistic bubble in place; not worth a dedicated retry UI for v1.
      }
    }
  };

  if (!canChat) {
    return (
      <View style={styles.joinPrompt}>
        <Text style={styles.joinPromptText}>{t("Join this group to participate in the chat.")}</Text>
      </View>
    );
  }

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
      ) : (
        <FlatList
          inverted
          data={[...messages].reverse()}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isOwn = item.sender._id === user?._id;
            return (
              <View style={[styles.messageRow, isOwn ? styles.messageRowOwn : styles.messageRowOther]}>
                {!isOwn && (
                  item.sender.profile_pic_url ? (
                    <Image source={{ uri: item.sender.profile_pic_url }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarFallbackText}>
                        {item.sender.username.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                  )
                )}
                <View style={styles.bubbleColumn}>
                  {!isOwn && <Text style={styles.senderName}>{item.sender.username}</Text>}
                  {item.type === "recommendation" ? (
                    <RecommendationMessageCard message={item} isOwn={isOwn} />
                  ) : item.type === "analysis_share" ? (
                    <Pressable
                      style={[
                        styles.bubble,
                        isOwn ? styles.bubbleOwn : styles.bubbleOther,
                        item.status === "pending" && styles.bubblePending,
                      ]}
                      onPress={() => {
                        const isProfile = (item.analysisData as any)?.type === "profile";
                        if (isProfile) {
                          setViewingProfileAnalysis((item.analysisData as ProfileAnalysis) ?? null);
                        } else {
                          setViewingAnalysis((item.analysisData as MatchAnalysis) ?? null);
                        }
                      }}
                    >
                      <Text style={isOwn ? styles.bubbleTextOwn : styles.bubbleTextOther}>
                        {(item.analysisData as any)?.type === "profile"
                          ? t("📊 Shared their profile analysis")
                          : t("📊 Shared a CineMatch analysis")}
                      </Text>
                    </Pressable>
                  ) : (
                    <View
                      style={[
                        styles.bubble,
                        isOwn ? styles.bubbleOwn : styles.bubbleOther,
                        item.status === "pending" && styles.bubblePending,
                      ]}
                    >
                      <Text style={isOwn ? styles.bubbleTextOwn : styles.bubbleTextOther}>
                        {item.text}
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.timestamp, isOwn ? styles.timestampOwn : styles.timestampOther]}>
                    {new Date(item.createdAt).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              </View>
            );
          }}
          onEndReached={loadOlder}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
          ListFooterComponent={
            loadingOlder ? <ActivityIndicator style={{ margin: 12 }} color={colors.primary} /> : null
          }
        />
      )}

      <View style={styles.composerRow}>
        <TextInput
          style={styles.input}
          placeholder={t("Message...")}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
        />
        <Pressable
          style={[styles.sendButton, (!text.trim() || !connected) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || !connected}
        >
          <Text style={styles.sendButtonText}>{t("Send")}</Text>
        </Pressable>
      </View>

      <AnalyzeModal
        visible={!!viewingAnalysis}
        onClose={() => setViewingAnalysis(null)}
        data={viewingAnalysis}
      />
      <ProfileAnalysisModal
        visible={!!viewingProfileAnalysis}
        onClose={() => setViewingProfileAnalysis(null)}
        data={viewingProfileAnalysis}
      />
    </KeyboardAvoidingView>
  );
}

