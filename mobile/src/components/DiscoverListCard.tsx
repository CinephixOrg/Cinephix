import { useMemo } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { DiscoverListItem } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w154";

interface Props {
  list: DiscoverListItem;
  onPress: () => void;
  basePath: "/home" | "/search";
}

// Vertical list-preview card, backing both "Lists from Friends" and
// "Popular Lists" — same design for both, per the user's explicit ask.
// Owner avatar+username sit top-right (reversed from this card's earlier
// top-left layout); below that, up to 5 poster-only preview thumbnails for
// the list's items; description last.
export default function DiscoverListCard({ list, onPress, basePath }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const styles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: colors.base200,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
    name: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent },
    ownerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    ownerName: { fontSize: 12, color: colors.placeholder },
    avatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.base300 },
    avatarFallback: { alignItems: "center", justifyContent: "center" },
    avatarFallbackText: { fontFamily: fonts.bold, fontSize: 9, color: colors.primary },
    badge: {
      alignSelf: "flex-start",
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
      marginTop: 8,
    },
    badgeText: { fontSize: 10, fontFamily: fonts.medium, color: colors.primaryContent },
    posterRow: { flexDirection: "row", gap: 8, marginTop: 10 },
    poster: { width: 56, height: 82, borderRadius: 6, backgroundColor: colors.base300 },
    description: { fontSize: 12, color: colors.baseContent, marginTop: 10, lineHeight: 16 },
    count: { fontSize: 11, color: colors.placeholder, marginTop: 8 },
  }), [colors]);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.topRow}>
        <Text style={styles.name} numberOfLines={1}>
          {list.name}
        </Text>
        <View style={styles.ownerRow}>
          <Text style={styles.ownerName} numberOfLines={1}>
            {list.owner.username}
          </Text>
          {list.owner.profile_pic_url ? (
            <Image source={{ uri: list.owner.profile_pic_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarFallbackText}>{list.owner.username.slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
        </View>
      </View>

      {list.fromFollowing && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{t("Following")}</Text>
        </View>
      )}

      {list.previewItems.length > 0 && (
        <View style={styles.posterRow}>
          {list.previewItems.map((item) => (
            <Pressable
              key={`${item.itemType}-${item.itemId}`}
              onPress={() => router.push(`${basePath}/content/${item.itemType}/${item.itemId}` as any)}
            >
              {item.poster_path ? (
                <Image source={{ uri: `${POSTER_BASE}${item.poster_path}` }} style={styles.poster} />
              ) : (
                <View style={styles.poster} />
              )}
            </Pressable>
          ))}
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
