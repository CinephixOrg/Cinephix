import { useState, useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import UserAvatar from "./UserAvatar";
import StarRatingDisplay from "./StarRatingDisplay";
import { toggleReviewLike } from "../api/reviewService";
import type { Review } from "../types";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { useTranslation } from "react-i18next";
import { fonts } from "../theme/typography";

interface Props {
  review: Review;
}

export default function ReviewCard({ review }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  card: { backgroundColor: colors.base200, borderRadius: 12, padding: 14, marginBottom: 10 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerText: { flex: 1 },
  username: { fontFamily: fonts.bold, fontSize: 14, color: colors.baseContent },
  timestamp: { fontSize: 11, color: colors.placeholder, marginTop: 1 },
  text: { fontSize: 14, color: colors.baseContent, marginTop: 10, lineHeight: 20 },
  likeButton: { flexDirection: "row", alignItems: "center", gap: 6 },
  likeCount: { fontSize: 13, color: colors.placeholder },
  likeCountActive: { color: colors.primary, fontFamily: fonts.medium },
}), [colors]);
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
    <View style={styles.card}>
      <View style={styles.header}>
        <UserAvatar userId={review.user._id} username={review.user.username} profilePicUrl={review.user.profile_pic_url} size={36} />
        <View style={styles.headerText}>
          <Text style={styles.username}>{review.user.username}</Text>
          <Text style={styles.timestamp}>
            {new Date(review.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
        {review.rating != null && <StarRatingDisplay value={review.rating} size={13} />}
        <Pressable style={styles.likeButton} onPress={handleLike} disabled={liking} hitSlop={8}>
          <Ionicons
            name={hasLiked ? "heart" : "heart-outline"}
            size={18}
            color={hasLiked ? colors.primary : colors.placeholder}
          />
          <Text style={[styles.likeCount, hasLiked && styles.likeCountActive]}>{likeCount}</Text>
        </Pressable>
      </View>

      <Text style={styles.text}>{review.text}</Text>
    </View>
  );
}
