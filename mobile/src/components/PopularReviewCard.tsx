import { useState, useMemo } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import UserAvatar from "./UserAvatar";
import { toggleReviewLike } from "../api/reviewService";
import type { PopularReview } from "../types";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w342";

interface Props {
  review: PopularReview;
}

// Home-exclusive — no basePath prop needed since it always pushes into
// Home's own nested Stack (see (app)/_layout.tsx for why that matters).
export default function PopularReviewCard({ review }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  card: {
    width: 170,
    marginRight: 12,
    backgroundColor: colors.base200,
    borderRadius: 12,
    padding: 12,
  },
  posterWrap: { position: "relative" },
  poster: { width: "100%", aspectRatio: 2 / 3, borderRadius: 8, backgroundColor: colors.base300 },
  posterFallback: { alignItems: "center", justifyContent: "center" },
  posterFallbackText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
  likeBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  likeBadgeText: { color: colors.primaryContent, fontSize: 10, fontFamily: fonts.medium },
  title: { fontFamily: fonts.bold, fontSize: 13, color: colors.baseContent, marginTop: 8 },
  reviewerRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  reviewerName: { fontSize: 11, color: colors.placeholder, flexShrink: 1 },
  excerpt: { fontSize: 12, color: colors.baseContent, marginTop: 6, lineHeight: 16 },
  likeRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  likeRowText: { fontSize: 11, color: colors.placeholder },
  likeRowTextActive: { color: colors.primary, fontFamily: fonts.medium },
}), [colors]);
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [hasLiked, setHasLiked] = useState(review.hasLiked);
  const [likeCount, setLikeCount] = useState(review.likeCount);
  const [liking, setLiking] = useState(false);

  const handleLike = async () => {
    if (liking) return;
    const prevLiked = hasLiked;
    const prevCount = likeCount;
    setHasLiked(!prevLiked);
    setLikeCount(prevLiked ? prevCount - 1 : prevCount + 1);
    setLiking(true);
    try {
      const result = await toggleReviewLike(review._id);
      setHasLiked(result.hasLiked);
      setLikeCount(result.likeCount);
    } catch {
      setHasLiked(prevLiked);
      setLikeCount(prevCount);
      showToast(t("Something went wrong. Please try again."));
    } finally {
      setLiking(false);
    }
  };

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/home/content/${review.content.type}/${review.content.id}`)}
    >
      <View style={styles.posterWrap}>
        {review.content.poster_path ? (
          <Image source={{ uri: `${POSTER_BASE}${review.content.poster_path}` }} style={styles.poster} />
        ) : (
          <View style={[styles.poster, styles.posterFallback]}>
            <Text style={styles.posterFallbackText}>{review.content.title.slice(0, 2).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.likeBadge}>
          <Ionicons name="heart" size={11} color={colors.primaryContent} />
          <Text style={styles.likeBadgeText}>{likeCount}</Text>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {review.content.title}
      </Text>

      <Pressable style={styles.reviewerRow} onPress={() => router.push(`/user/${review.user._id}`)}>
        <UserAvatar userId={review.user._id} username={review.user.username} profilePicUrl={review.user.profile_pic_url} size={18} />
        <Text style={styles.reviewerName} numberOfLines={1}>
          {review.user.username}
        </Text>
      </Pressable>

      <Text style={styles.excerpt} numberOfLines={3}>
        {review.text}
      </Text>

      <Pressable style={styles.likeRow} onPress={handleLike} disabled={liking} hitSlop={8}>
        <Ionicons
          name={hasLiked ? "heart" : "heart-outline"}
          size={14}
          color={hasLiked ? colors.primary : colors.placeholder}
        />
        <Text style={[styles.likeRowText, hasLiked && styles.likeRowTextActive]}>{likeCount}</Text>
      </Pressable>
    </Pressable>
  );
}

