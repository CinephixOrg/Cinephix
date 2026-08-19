import { useCallback, useEffect, useMemo } from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { useLocalSearchParams, useNavigation, useRouter, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { useChat } from "../../../../src/context/ChatContext";
import { getMessages, markConversationRead, sendMessageRest } from "../../../../src/api/conversationService";
import ChatRoom from "../../../../src/components/ChatRoom";
import { useTheme } from "../../../../src/context/ThemeContext";
import { fonts } from "../../../../src/theme/typography";

export default function ConversationScreen() {
  const { conversationId, otherUsername } = useLocalSearchParams<{
    conversationId: string;
    otherUsername?: string;
    otherAvatar?: string;
  }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { conversations, joinRoom, leaveRoom, markReadLocally } = useChat();
  const styles = useMemo(
    () => StyleSheet.create({ title: { fontFamily: fonts.bold, fontSize: 17, color: colors.baseContent } }),
    [colors]
  );

  useEffect(() => {
    const conv = conversations.find((c) => c._id === conversationId);
    const title = otherUsername || conv?.otherUser.username || t("Conversation");
    const otherId = conv?.otherUser._id;
    navigation.setOptions({
      headerTitle: () =>
        otherId ? (
          <Pressable onPress={() => router.push(`/user/${otherId}`)}>
            <Text style={styles.title}>{title}</Text>
          </Pressable>
        ) : (
          <Text style={styles.title}>{title}</Text>
        ),
    });
  }, [conversationId, otherUsername, conversations, styles]);

  useFocusEffect(
    useCallback(() => {
      joinRoom("dm", conversationId);
      markReadLocally(conversationId);
      return () => leaveRoom("dm", conversationId);
    }, [conversationId])
  );

  return (
    <ChatRoom
      roomType="dm"
      roomId={conversationId}
      canChat={true}
      emptyText={t("No messages yet. Say something!")}
      fetchMessages={(before, limit) => getMessages(conversationId, before, limit)}
      markRead={() => markConversationRead(conversationId)}
      sendRest={(text) => sendMessageRest(conversationId, text)}
    />
  );
}
