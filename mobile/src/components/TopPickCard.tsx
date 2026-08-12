import { useMemo } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import UserAvatar from "./UserAvatar";
import type { TopPick } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w185";

interface Props {
  pick: TopPick;
}

export default function TopPickCard({ pick }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useMemo(() => StyleSheet.create({
  card: { width: 128 },
  posterWrap: { position: "relative" },
  poster: { width: 128, height: 184, borderRadius: 8, backgroundColor: colors.base200 },
  ratingBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ratingBadgeText: { color: "#ffffff", fontSize: 11, fontFamily: fonts.bold },
  title: { fontFamily: fonts.medium, fontSize: 13, color: colors.baseContent, marginTop: 6 },
  raterRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  raterAvatar: { marginLeft: -8, borderWidth: 2, borderColor: colors.base100, borderRadius: 14 },
  raterCount: { fontSize: 11, color: colors.placeholder, marginLeft: 6 },
}), [colors]);

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/home/content/${pick.content.type}/${pick.content.id}` as any)}
    >
      <View style={styles.posterWrap}>
        {pick.content.poster_path ? (
          <Image source={{ uri: `${POSTER_BASE}${pick.content.poster_path}` }} style={styles.poster} />
        ) : (
          <View style={styles.poster} />
        )}
        <View style={styles.ratingBadge}>
          <Text style={styles.ratingBadgeText}>★ {pick.avgRating}</Text>
        </View>
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {pick.content.title}
      </Text>
      <View style={styles.raterRow}>
        {pick.topRaters.slice(0, 3).map((rater, i) => (
          <View key={rater._id} style={[styles.raterAvatar, i === 0 && { marginLeft: 0 }]}>
            <UserAvatar
              userId={rater._id}
              username={rater.username}
              profilePicUrl={rater.profile_pic_url}
              size={24}
              disabled
            />
          </View>
        ))}
        <Text style={styles.raterCount}>{t("rating_count", { count: pick.raterCount })}</Text>
      </View>
    </Pressable>
  );
}
