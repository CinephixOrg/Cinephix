import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { useLocalSearchParams, useNavigation, useRouter, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { useChat } from "../context/ChatContext";
import {
  conversationPrefetch,
  getMessages,
  markConversationRead,
  sendMessageRest,
} from "../api/conversationService";
import ChatRoom from "../components/ChatRoom";
import type { Message, MessagePagination, MessageSender } from "../types";
import { SkeletonChatBubbles } from "../components/Skeleton";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";
import { setActiveChat } from "../push/activeChat";

interface Props {
  // Whether tapping the header title opens the other person's profile.
  // Off for the copy nested under user/[id], where the profile is literally
  // the screen you just came from — pushing it again would stack a second
  // copy of it rather than taking you back to the one already there.
  linkTitleToProfile?: boolean;
  // When set, this screen resolves (or creates) the DM with this person
  // itself, instead of being handed a conversation id up front.
  //
  // That's what makes the profile's Message button feel instant: opening a
  // DM requires a round trip to find-or-create the conversation, and doing
  // it before navigating meant staring at the profile for the whole thing.
  // Navigating first and resolving here puts that wait behind a chat screen
  // that already shows the right person's name.
  participantId?: string;
}

// The DM room itself. Rendered by two routes: the one under the Socials tab
// (reached from the conversation list, which already knows the conversation
// id) and the one nested under user/[id] (reached from the Message button on
// someone's profile, which only knows who). They exist separately so each
// keeps its own back stack — the nested copy returns you to the profile you
// opened it from, which a single shared route in the Socials tab could not do.
export default function ConversationScreen({ linkTitleToProfile = true, participantId }: Props) {
  const { conversationId: conversationIdParam, otherUsername, otherAvatar } = useLocalSearchParams<{
    conversationId?: string;
    otherUsername?: string;
    otherAvatar?: string;
  }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { conversations, joinRoom, leaveRoom, markReadLocally, refreshConversations } = useChat();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        title: { fontFamily: fonts.bold, fontSize: 17, color: colors.baseContent },
        loading: { flex: 1, backgroundColor: colors.base100 },
      }),
    [colors]
  );

  // Either handed to us in the route, or resolved below from participantId.
  const [conversationId, setConversationId] = useState<string | undefined>(conversationIdParam);
  // The first page, when the resolve step returned it alongside the
  // conversation — see the `messages` field on that response.
  const [seeded, setSeeded] = useState<{ items: Message[]; pagination: MessagePagination } | undefined>();

  useEffect(() => {
    if (conversationId || !participantId) return;
    let cancelled = false;
    // Joins the request a message notification's tap already started, if
    // there is one — otherwise it's a plain find-or-create.
    conversationPrefetch
      .take(participantId)
      .then((conv) => {
        if (cancelled) return;
        if (conv.messages && conv.messagesPagination) {
          setSeeded({ items: conv.messages, pagination: conv.messagesPagination });
        }
        setConversationId(conv._id);
        // Not awaited: this only matters for the Socials list later, and
        // the conversation is already usable without it.
        refreshConversations();
      })
      .catch(() => {
        // Leaves the skeleton up. Backing out and retrying is the recovery
        // path — there's nothing partial to show and nothing to send to.
      });
    return () => {
      cancelled = true;
    };
  }, [participantId, conversationId]);

  // A layout effect, so the header is set before the first paint rather than
  // a frame after it. The name comes from the route (otherUsername) when the
  // opener knew it — the profile's Message button and message notifications
  // both do — so the loading skeleton already sits under the right name.
  useLayoutEffect(() => {
    const conv = conversations.find((c) => c._id === conversationId);
    const title = otherUsername || conv?.otherUser.username || t("Conversation");
    const otherId = conv?.otherUser._id;
    navigation.setOptions({
      headerTitle: () =>
        otherId && linkTitleToProfile ? (
          <Pressable onPress={() => router.push(`/user/${otherId}`)}>
            <Text style={styles.title}>{title}</Text>
          </Pressable>
        ) : (
          <Text style={styles.title}>{title}</Text>
        ),
    });
  }, [conversationId, otherUsername, conversations, styles, linkTitleToProfile]);

  // While this chat is on screen, a push about a message in it arrives
  // silently: the message itself is already appearing here.
  useFocusEffect(
    useCallback(
      () => setActiveChat({ conversationId: conversationId ?? null, participantId: participantId ?? null }),
      [conversationId, participantId]
    )
  );

  useFocusEffect(
    useCallback(() => {
      if (!conversationId) return;
      joinRoom("dm", conversationId);
      markReadLocally(conversationId);
      return () => leaveRoom("dm", conversationId);
    }, [conversationId])
  );

  // The other person, for chat cards that picture both people. From the
  // conversation list when it has this chat, otherwise from what the opener
  // passed in the route.
  const otherFromList = conversations.find((c) => c._id === conversationId)?.otherUser;
  const counterpart = useMemo<MessageSender | undefined>(
    () =>
      otherFromList ??
      (otherUsername ? { _id: participantId ?? "", username: otherUsername, profile_pic_url: otherAvatar || undefined } : undefined),
    [otherFromList, otherUsername, otherAvatar, participantId]
  );

  // Same skeleton ChatRoom shows for its own first load, so resolving the
  // conversation and then loading its messages read as one continuous wait
  // rather than two different ones.
  if (!conversationId) {
    return (
      <View style={styles.loading}>
        <SkeletonChatBubbles />
      </View>
    );
  }

  return (
    <ChatRoom
      key={conversationId}
      roomType="dm"
      roomId={conversationId}
      canChat={true}
      counterpart={counterpart}
      initialMessages={seeded}
      emptyText={t("No messages yet. Say something!")}
      fetchMessages={(before, limit) => getMessages(conversationId, before, limit)}
      markRead={() => markConversationRead(conversationId)}
      sendRest={(text) => sendMessageRest(conversationId, text)}
    />
  );
}
