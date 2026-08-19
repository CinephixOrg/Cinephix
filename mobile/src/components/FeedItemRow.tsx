import { useMemo } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import StarRatingDisplay from "./StarRatingDisplay";
import type { FeedActivityItem } from "../types";
import { useTheme } from "../context/ThemeContext";
import type { ColorPalette } from "../theme/palettes";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w92";

const BADGE_EMOJI: Record<FeedActivityItem["type"], string> = {
  rated: "⭐",
  reviewed: "✍️",
  watchlisted: "🎬",
  followed: "👥",
};

interface Props {
  item: FeedActivityItem;
}

function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 10 },
    avatarWrap: { position: "relative" },
    avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.base200 },
    avatarFallback: { alignItems: "center", justifyContent: "center" },
    avatarFallbackText: { fontFamily: fonts.bold, fontSize: 12, color: colors.primary },
    badge: {
      position: "absolute",
      bottom: -2,
      right: -2,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.base200,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeText: { fontSize: 9 },
    body: { flex: 1 },
    sentence: { color: colors.baseContent, fontSize: 13, lineHeight: 18 },
    link: { color: colors.baseContent, fontFamily: fonts.medium },
    excerpt: { color: colors.placeholder, fontSize: 12, fontStyle: "italic", marginTop: 4 },
    ratingRow: { marginTop: 4 },
    timestamp: { color: colors.placeholder, fontSize: 11, marginTop: 4 },
    poster: { width: 32, height: 46, borderRadius: 4, backgroundColor: colors.base200 },
  });
}

export default function FeedItemRow({ item }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useMemo(() => buildStyles(colors), [colors]);

  const goToUser = (userId: string) => router.push(`/user/${userId}`);
  const goToContent = () => {
    if (item.content) router.push(`/home/content/${item.content.type}/${item.content.id}` as any);
  };

  const UserSpan = ({ user }: { user: { _id: string; username: string } }) => (
    <Text style={styles.link} onPress={() => goToUser(user._id)}>
      {user.username}
    </Text>
  );
  const ContentSpan = () =>
    item.content ? (
      <Text style={styles.link} onPress={goToContent}>
        {item.content.title}
      </Text>
    ) : null;

  return (
    <View style={styles.row}>
      <View style={styles.avatarWrap}>
        {item.user.profile_pic_url ? (
          <Image source={{ uri: item.user.profile_pic_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarFallbackText}>{item.user.username.slice(0, 2).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{BADGE_EMOJI[item.type]}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.sentence}>
          {item.type === "rated" && (
            <>
              <UserSpan user={item.user} /> {t("rated")} <ContentSpan />
            </>
          )}
          {item.type === "reviewed" && (
            <>
              <UserSpan user={item.user} /> {t("wrote a review for")} <ContentSpan />
            </>
          )}
          {item.type === "watchlisted" && (
            <>
              <UserSpan user={item.user} /> {t("added")} <ContentSpan /> {t("to their watched list")}
            </>
          )}
          {item.type === "followed" && (
            <>
              <UserSpan user={item.user} /> {t("started following")}{" "}
              {item.targetUser ? <UserSpan user={item.targetUser} /> : t("someone")}
            </>
          )}
        </Text>

        {item.type === "rated" && (
          <View style={styles.ratingRow}>
            <StarRatingDisplay value={item.value} size={12} />
          </View>
        )}

        {item.type === "reviewed" && item.excerpt ? (
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

      {item.content && (
        <Pressable onPress={goToContent}>
          {item.content.poster_path ? (
            <Image source={{ uri: `${POSTER_BASE}${item.content.poster_path}` }} style={styles.poster} />
          ) : (
            <View style={styles.poster} />
          )}
        </Pressable>
      )}
    </View>
  );
}
