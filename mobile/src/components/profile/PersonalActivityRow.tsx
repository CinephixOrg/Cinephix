import { useMemo } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import StarRatingDisplay from "../StarRatingDisplay";
import type { PersonalActivityItem, PersonalActivityType } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import type { ColorPalette } from "../../theme/palettes";
import { fonts } from "../../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w92";

const ICON: Record<PersonalActivityType, keyof typeof Ionicons.glyphMap> = {
  rated: "star",
  reviewed: "pencil",
  review_liked: "heart",
  watchlist_added: "checkmark-done",
  towatch_added: "bookmark",
  list_created: "list",
  group_joined: "people",
};

interface Props {
  item: PersonalActivityItem;
}

function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 10 },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.base200,
      alignItems: "center",
      justifyContent: "center",
    },
    body: { flex: 1 },
    label: { color: colors.baseContent, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
    excerpt: { color: colors.placeholder, fontSize: 12, fontStyle: "italic", marginTop: 4 },
    ratingRow: { marginTop: 4 },
    timestamp: { color: colors.placeholder, fontSize: 11, marginTop: 4 },
    poster: { width: 32, height: 46, borderRadius: 4, backgroundColor: colors.base200 },
    coverImage: { width: 32, height: 32, borderRadius: 6, backgroundColor: colors.base200 },
  });
}

export default function PersonalActivityRow({ item }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useMemo(() => buildStyles(colors), [colors]);

  const goToContent = () => {
    if (item.content) router.push(`/profile/content/${item.content.type}/${item.content.id}` as any);
  };
  const goToList = () => {
    if (item.listId) router.push(`/lists/${item.listId}` as any);
  };
  const goToGroup = () => {
    if (item.groupSlug) router.push(`/socials/communities/${item.groupSlug}` as any);
  };

  const label = () => {
    switch (item.type) {
      case "rated":
        return t("Rated {{title}}", { title: item.content?.title });
      case "reviewed":
        return t("Reviewed {{title}}", { title: item.content?.title });
      case "review_liked":
        return t("Liked a review for {{title}}", { title: item.content?.title });
      case "watchlist_added":
        return t("Added {{title}} to watched list", { title: item.content?.title });
      case "towatch_added":
        return t("Added {{title}} to watchlist", { title: item.content?.title });
      case "list_created":
        return t('Created list "{{name}}"', { name: item.listName });
      case "group_joined":
        return t("Joined {{name}}", { name: item.groupName });
      default:
        return "";
    }
  };

  const rowPress =
    item.type === "list_created" ? goToList : item.type === "group_joined" ? goToGroup : item.content ? goToContent : undefined;

  return (
    <Pressable style={styles.row} onPress={rowPress}>
      <View style={styles.iconWrap}>
        <Ionicons name={ICON[item.type]} size={16} color={colors.primary} />
      </View>

      <View style={styles.body}>
        <Text style={styles.label} numberOfLines={2}>
          {label()}
        </Text>

        {item.type === "rated" && (
          <View style={styles.ratingRow}>
            <StarRatingDisplay value={item.value} size={12} />
          </View>
        )}

        {(item.type === "reviewed" || item.type === "review_liked") && item.excerpt ? (
          <Text style={styles.excerpt} numberOfLines={2}>
            "{item.excerpt}
            {item.excerpt.length >= 150 ? "…" : ""}"
          </Text>
        ) : null}

        <Text style={styles.timestamp}>
          {new Date(item.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>

      {item.content &&
        (item.content.poster_path ? (
          <Image source={{ uri: `${POSTER_BASE}${item.content.poster_path}` }} style={styles.poster} />
        ) : (
          <View style={styles.poster} />
        ))}

      {item.type === "group_joined" && item.groupCoverImage ? (
        <Image source={{ uri: item.groupCoverImage }} style={styles.coverImage} />
      ) : null}
    </Pressable>
  );
}
