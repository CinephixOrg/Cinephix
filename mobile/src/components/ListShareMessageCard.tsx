import { useMemo } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { Message } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const CARD_WIDTH = 220;
const POSTER_BASE = "https://image.tmdb.org/t/p/w154";

interface Props {
  message: Message;
  isOwn: boolean;
}

// Rendered inside a chat bubble in place of plain text for "check out this
// list" shares — a fanned mini poster stack (up to 3, from the same
// previewPosters snapshot ShareCard.tsx's own list-post box uses) plus the
// name and item count. Tap opens the list itself. Same own/other
// bubble-tint convention as ProfileShareMessageCard/RecommendationMessageCard.
export default function ListShareMessageCard({ message, isOwn }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
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
        row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10 },
        posterStack: { width: 44, height: 44, justifyContent: "center" },
        poster: {
          position: "absolute",
          width: 30,
          height: 44,
          borderRadius: 5,
          backgroundColor: colors.base300,
          borderWidth: 1.5,
          borderColor: isOwn ? colors.primary : colors.base200,
        },
        listIconFallback: {
          width: 44,
          height: 44,
          borderRadius: 10,
          backgroundColor: isOwn ? `${colors.primaryContent}22` : colors.base300,
          alignItems: "center",
          justifyContent: "center",
        },
        textCol: { flex: 1 },
        name: { fontFamily: fonts.bold, fontSize: 14, color: isOwn ? colors.primaryContent : colors.baseContent },
        hint: { fontSize: 12, color: isOwn ? colors.primaryContent : colors.placeholder, marginTop: 2 },
      }),
    [colors, isOwn]
  );

  const listData = message.listData;
  if (!listData?.listId) return null;

  const posters = listData.previewPosters.slice(0, 3);

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/lists/${listData.listId}` as any)}>
      <View style={styles.row}>
        {posters.length > 0 ? (
          <View style={styles.posterStack}>
            {posters.map((path, i) => (
              <Image
                key={i}
                source={{ uri: `${POSTER_BASE}${path}` }}
                style={[styles.poster, { left: i * 7, zIndex: posters.length - i }]}
              />
            ))}
          </View>
        ) : (
          <View style={styles.listIconFallback}>
            <Ionicons name="albums" size={20} color={isOwn ? colors.primaryContent : colors.primary} />
          </View>
        )}
        <View style={styles.textCol}>
          <Text style={styles.name} numberOfLines={1}>
            {listData.name}
          </Text>
          <Text style={styles.hint}>{t("item_count", { count: listData.itemCount })}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={isOwn ? colors.primaryContent : colors.placeholder} />
      </View>
    </Pressable>
  );
}
