import { useCallback, useEffect } from "react";
import { useLocalSearchParams, useNavigation, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { useChat } from "../../../src/context/ChatContext";
import { getMessages, markConversationRead, sendMessageRest } from "../../../src/api/conversationService";
import ChatRoom from "../../../src/components/ChatRoom";

export default function ConversationScreen() {
  const { conversationId, otherUsername } = useLocalSearchParams<{
    conversationId: string;
    otherUsername?: string;
    otherAvatar?: string;
  }>();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { conversations, joinRoom, leaveRoom, markReadLocally } = useChat();

  useEffect(() => {
    const conv = conversations.find((c) => c._id === conversationId);
    const title = otherUsername || conv?.otherUser.username || t("Conversation");
    navigation.setOptions({ title });
  }, [conversationId, otherUsername, conversations]);

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
