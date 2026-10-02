import { useState, useMemo } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import Pressable from "./common/TapSafePressable";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import UserAvatar from "./UserAvatar";
import TierGradientText from "./TierGradientText";
import StarRatingDisplay from "./StarRatingDisplay";
import ReviewFullTextModal from "./ReviewFullTextModal";
import { toggleReviewLike } from "../api/reviewService";
import type { PopularReview } from "../types";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { useTranslation } from "react-i18next";
import { fonts } from "../theme/typography";
import MoreButton from "./safety/MoreButton";

const POSTER_BASE = "https://image.tmdb.org/t/p/w185";

interface Props {
  review: PopularReview;
  basePath: "/home" | "/search";
}

// Reviews tab card — poster on the left, profile beside it (not below),
// with the reviewer's rating and review text directly under the profile.
// The friend-sourced tag (`fromFriend`) is gone — this feed's own All/
// Friends/Liked filter (ReviewsSection.tsx) replaced it, direct ask, same
// reasoning Content Detail's own Reviews filter already went through.
// Like info moved to the card's top-right, aligned with the title row
// (was bottom-left, its own row) — same Like?/Liked + count wording List
// Detail's like button uses. Tapping the poster specifically goes straight
// to the content detail page; tapping anywhere else on the card now opens
// the same full-text popup ReviewSwipeCard.tsx's cards already use
// (ReviewFullTextModal, shared) instead of also going straight to detail —
// direct ask, the two taps used to do the same thing.
export default function ReviewFeedCard({ review, basePath }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const [hasLiked, setHasLiked] = useState(review.hasLiked);
  const [likeCount, setLikeCount] = useState(review.likeCount);
  const [liking, setLiking] = useState(false);
  const [fullTextVisible, setFullTextVisible] = useState(false);
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
        // Like moved here, top-right, aligned with the title — was its own
        // row at the bottom of the card.
        titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
        title: { flex: 1, fontFamily: fonts.bold, fontSize: 13, color: colors.baseContent },
        reviewerRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
        ratingRow: { marginTop: 3 },
        excerpt: { fontSize: 12, color: colors.baseContent, marginTop: 4, lineHeight: 16 },
        likeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
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
    <>
      <Pressable style={styles.card} onPress={() => setFullTextVisible(true)}>
        {/* Its own nested Pressable — "inner tap wins" over the card's own
            onPress, same pattern used throughout this app (e.g. ShareCard.
            tsx's poster-inside-box) — so tapping the poster specifically
            still goes straight to the content detail page. */}
        <Pressable onPress={() => router.push(`${basePath}/content/${review.content.type}/${review.content.id}` as any)}>
          {review.content.poster_path ? (
            <Image source={{ uri: `${POSTER_BASE}${review.content.poster_path}` }} style={styles.poster} />
          ) : (
            <View style={[styles.poster, styles.posterFallback]}>
              <Text style={styles.posterFallbackText}>{review.content.title.slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
        </Pressable>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {review.content.title}
            </Text>
            <Pressable style={styles.likeRow} onPress={handleLike} disabled={liking} hitSlop={8}>
              <Ionicons name={hasLiked ? "heart" : "heart-outline"} size={14} color={hasLiked ? colors.primary : colors.placeholder} />
              <Text style={[styles.likeRowText, hasLiked && styles.likeRowTextActive]}>
                {hasLiked ? t("Liked") : t("Like?")} {likeCount}
              </Text>
            </Pressable>
            <MoreButton entityType="Review" entityId={review._id} author={review.user} size={16} />
          </View>

          <Pressable style={styles.reviewerRow} onPress={() => router.push(`/user/${review.user._id}`)}>
            <UserAvatar
              userId={review.user._id}
              username={review.user.username}
              profilePicUrl={review.user.profile_pic_url}
              size={20}
              tier={review.user.accountTier}
            />
            {/* TierGradientText, not a plain Text + diamond mark — same
                ring+gradient-fill-only tier treatment ReviewSwipeCard.tsx's
                own Discover rail card already uses (this card backs that
                rail's "See all" page). Direct ask after this card was
                found stacking a ring AND a diamond with a plain username,
                inconsistent with the rail card right next to it in the
                same flow. Free/dev tiers fall back to this same plain
                color automatically — TierGradientText's own documented
                behavior, not a conditional needed here. */}
            <TierGradientText
              text={review.user.username}
              tier={review.user.accountTier}
              fontSize={12}
              color={colors.baseContent}
              gradientId={`reviewFeedUsernameGradient-${review._id}`}
            />
          </Pressable>

          {review.rating != null && (
            <View style={styles.ratingRow}>
              <StarRatingDisplay value={review.rating} size={13} />
            </View>
          )}

          <Text style={styles.excerpt} numberOfLines={3}>
            {review.text}
          </Text>
        </View>
      </Pressable>

      <ReviewFullTextModal
        review={review}
        basePath={basePath}
        visible={fullTextVisible}
        onClose={() => setFullTextVisible(false)}
        hasLiked={hasLiked}
        likeCount={likeCount}
        onToggleLike={handleLike}
        liking={liking}
      />
    </>
  );
}
