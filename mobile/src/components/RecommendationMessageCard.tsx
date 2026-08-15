import { useMemo } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import type { Message } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w154";

interface Props {
  message: Message;
}

// Rendered inside a chat bubble in place of plain text — tap navigates to
// Content Detail via Messages' own thin route
// (app/(app)/messages/content/[type]/[id].tsx), matching the per-tab
// duplicate-route convention every other tab already follows.
export default function RecommendationMessageCard({ message }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          flexDirection: "row",
          gap: 8,
          backgroundColor: colors.base100,
          borderRadius: 10,
          padding: 8,
          maxWidth: 220,
        },
        poster: { width: 44, height: 64, borderRadius: 6, backgroundColor: colors.base200 },
        info: { flex: 1, justifyContent: "center" },
        title: { fontFamily: fonts.bold, fontSize: 13, color: colors.baseContent },
        year: { fontSize: 11, color: colors.placeholder, marginTop: 2 },
      }),
    [colors]
  );

  if (!message.contentId || !message.contentType) return null;

  const posterUrl = message.contentData?.posterUrl;

  return (
    <Pressable
      style={styles.card}
      onPress={() =>
        router.push(`/social/content/${message.contentType}/${message.contentId}` as any)
      }
    >
      {posterUrl ? (
        <Image
          source={{ uri: posterUrl.startsWith("/") ? `${POSTER_BASE}${posterUrl}` : posterUrl }}
          style={styles.poster}
        />
      ) : (
        <View style={styles.poster} />
      )}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {message.contentData?.title || "?"}
        </Text>
        {message.contentData?.releaseYear ? (
          <Text style={styles.year}>{message.contentData.releaseYear}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
