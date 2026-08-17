import { useMemo } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import type { Message } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w342";
const CARD_WIDTH = 180;

interface Props {
  message: Message;
  isOwn: boolean;
}

// Rendered inside a chat bubble in place of plain text — tap navigates to
// Content Detail via Socials' own thin route
// (app/(app)/socials/content/[type]/[id].tsx), matching the per-tab
// duplicate-route convention every other tab already follows.
//
// Poster fills the card width top-to-bottom (a real poster, not a small
// thumbnail) with the message's own sentence ("X recommends you Y") below it
// — previously that sentence was stored on the message but never rendered
// anywhere, so the card alone (small thumbnail + bare title) didn't read as
// a recommendation at all. Colors mirror the same own/other bubble
// convention every other message type in this chat uses.
export default function RecommendationMessageCard({ message, isOwn }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          width: CARD_WIDTH,
          borderRadius: 14,
          overflow: "hidden",
          backgroundColor: isOwn ? colors.primary : colors.base200,
          ...(isOwn ? { borderBottomRightRadius: 4 } : { borderBottomLeftRadius: 4 }),
        },
        poster: { width: CARD_WIDTH, aspectRatio: 2 / 3, backgroundColor: colors.base300 },
        textWrap: { paddingHorizontal: 10, paddingVertical: 8 },
        text: { fontSize: 13, lineHeight: 18, color: isOwn ? colors.primaryContent : colors.baseContent },
      }),
    [colors, isOwn]
  );

  if (!message.contentId || !message.contentType) return null;

  const posterUrl = message.contentData?.posterUrl;

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/socials/content/${message.contentType}/${message.contentId}` as any)}
    >
      {posterUrl ? (
        <Image
          source={{ uri: posterUrl.startsWith("/") ? `${POSTER_BASE}${posterUrl}` : posterUrl }}
          style={styles.poster}
        />
      ) : (
        <View style={styles.poster} />
      )}
      <View style={styles.textWrap}>
        <Text style={styles.text}>{message.text}</Text>
      </View>
    </Pressable>
  );
}
