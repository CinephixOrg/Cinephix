import { useMemo } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { CustomList } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w154";

interface Props {
  list: CustomList;
  onPress: () => void;
  editMode: boolean;
  onDelete: () => void;
  onLongPress?: () => void;
  isActive?: boolean;
}

// Same card shape as DiscoverListCard (poster-preview row, description,
// item count), but for the owner's own lists: no owner row (always "you"),
// a Public/Private badge instead, and an edit-mode trash button + drag
// handle instead of a "Following" badge.
export default function MyListCard({ list, onPress, editMode, onDelete, onLongPress, isActive }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: colors.base200,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
      opacity: isActive ? 0.85 : 1,
    },
    topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
    name: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent },
    badgeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    badgePublic: { backgroundColor: colors.primary },
    badgePrivate: { backgroundColor: colors.border },
    badgeText: { fontSize: 10, fontFamily: fonts.medium, color: colors.baseContent },
    deleteButton: { padding: 2 },
    posterRow: { flexDirection: "row", gap: 8, marginTop: 10 },
    poster: { width: 56, height: 82, borderRadius: 6, backgroundColor: colors.base300 },
    description: { fontSize: 12, color: colors.baseContent, marginTop: 10, lineHeight: 16 },
    count: { fontSize: 11, color: colors.placeholder, marginTop: 8 },
  }), [colors, isActive]);

  const previewItems = list.previewItems || [];

  return (
    <Pressable
      style={styles.card}
      onPress={editMode ? undefined : onPress}
      onLongPress={onLongPress}
      delayLongPress={200}
    >
      <View style={styles.topRow}>
        <Text style={styles.name} numberOfLines={1}>
          {list.name}
        </Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, list.isPublic ? styles.badgePublic : styles.badgePrivate]}>
            <Text style={styles.badgeText}>{list.isPublic ? t("Public") : t("Private")}</Text>
          </View>
          {editMode && (
            <Pressable onPress={onDelete} hitSlop={8} style={styles.deleteButton}>
              <Ionicons name="trash-outline" size={18} color={colors.error} />
            </Pressable>
          )}
        </View>
      </View>

      {previewItems.length > 0 && (
        <View style={styles.posterRow}>
          {previewItems.map((item) =>
            item.poster_path ? (
              <Image
                key={`${item.itemType}-${item.itemId}`}
                source={{ uri: `${POSTER_BASE}${item.poster_path}` }}
                style={styles.poster}
              />
            ) : (
              <View key={`${item.itemType}-${item.itemId}`} style={styles.poster} />
            )
          )}
        </View>
      )}

      {list.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {list.description}
        </Text>
      ) : null}

      <Text style={styles.count}>{t("item_count", { count: list.items.length })}</Text>
    </Pressable>
  );
}
