import { useState, useMemo } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import UserAvatar from "./UserAvatar";
import StarRatingDisplay from "./StarRatingDisplay";
import { toggleReviewLike } from "../api/reviewService";
import type { PopularReview } from "../types";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { useTranslation } from "react-i18next";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w185";

interface Props {
  review: PopularReview;
  basePath: "/home" | "/search";
  // Discover's merged Popular+Friends feed marks friend-sourced reviews
  // inline instead of putting them in their own section — a small tag
  // next to the title rather than a structural split.
  fromFriend?: boolean;
}

// Reviews tab card — replaces PopularReviewCard's vertical rail layout with
// a horizontal one: poster on the left, profile beside it (not below), with
// the reviewer's rating and review text directly under the profile.
export default function ReviewFeedCard({ review, basePath, fromFriend }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const [hasLiked, setHasLiked] = useState(review.hasLiked);
  const [likeCount, setLikeCount] = useState(review.likeCount);
  const [liking, setLiking] = useState(false);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          flexDirection: "row",
          gap: 12,
          backgroundColor: colors.base200,
          borderRadius: 12,
          padding: 12,
          marginBottom: 12,
        },
        poster: { width: 84, height: 122, borderRadius: 8, backgroundColor: colors.base300 },
        posterFallback: { alignItems: "center", justifyContent: "center" },
        posterFallbackText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
        body: { flex: 1 },
        titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
        title: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 13, color: colors.baseContent },
        friendChip: {
          flexDirection: "row",
          alignItems: "center",
          gap: 3,
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 8,
          backgroundColor: `${colors.primary}1A`,
        },
        friendChipText: { fontSize: 9, fontFamily: fonts.bold, color: colors.primary },
        reviewerRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
        reviewerName: { fontSize: 12, color: colors.baseContent, fontFamily: fonts.medium, flexShrink: 1 },
        ratingRow: { marginTop: 3 },
        excerpt: { fontSize: 12, color: colors.baseContent, marginTop: 4, lineHeight: 16 },
        likeRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
        likeRowText: { fontSize: 11, color: colors.placeholder },
        likeRowTextActive: { color: colors.primary, fontFamily: fonts.medium },
      }),
    [colors]
  );

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
      onPress={() => router.push(`${basePath}/content/${review.content.type}/${review.content.id}` as any)}
    >
      {review.content.poster_path ? (
        <Image source={{ uri: `${POSTER_BASE}${review.content.poster_path}` }} style={styles.poster} />
      ) : (
        <View style={[styles.poster, styles.posterFallback]}>
          <Text style={styles.posterFallbackText}>{review.content.title.slice(0, 2).toUpperCase()}</Text>
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {review.content.title}
          </Text>
          {fromFriend && (
            <View style={styles.friendChip}>
              <Ionicons name="people" size={9} color={colors.primary} />
              <Text style={styles.friendChipText}>{t("Friends")}</Text>
            </View>
          )}
        </View>

        <Pressable style={styles.reviewerRow} onPress={() => router.push(`/user/${review.user._id}`)}>
          <UserAvatar userId={review.user._id} username={review.user.username} profilePicUrl={review.user.profile_pic_url} size={20} />
          <Text style={styles.reviewerName} numberOfLines={1}>
            {review.user.username}
          </Text>
        </Pressable>

        {review.rating != null && (
          <View style={styles.ratingRow}>
            <StarRatingDisplay value={review.rating} size={13} />
          </View>
        )}

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
      </View>
    </Pressable>
  );
}
