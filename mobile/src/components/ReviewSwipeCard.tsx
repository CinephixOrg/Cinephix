import { useMemo, useState } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import UserAvatar from "./UserAvatar";
import TierGradientText from "./TierGradientText";
import StarRatingDisplay from "./StarRatingDisplay";
import ReviewFullTextModal from "./ReviewFullTextModal";
import { toggleReviewLike } from "../api/reviewService";
import { useToast } from "../context/ToastContext";
import { usePosterReveal } from "../context/PosterRevealContext";
import type { PopularReview } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w185";
export const POSTER_WIDTH = 84;
export const POSTER_HEIGHT = POSTER_WIDTH * 1.5;
const POSTER_RADIUS = 8;
const CARD_RADIUS = 16;
// Approximation (text reflow varies) of how many lines fit before the full
// review is worth reading in the popup instead — not a pixel measurement.
const COLLAPSED_LINES = 4;

interface Props {
  review: PopularReview;
  basePath: "/home" | "/search";
}

// One full-width review card: a real poster-sized (matches AddedByCard/
// ListRailCard's own 84px width) poster on the left, covered by a dark
// overlay carrying the content title + like count — mirrors ListRailCard's
// own "name + stats together" overlay grouping. Tap it to hide the overlay
// (which actually disappears now, revealing the bare poster — an earlier
// version kept the dark tint under the Detail pill by mistake, both
// states shared one style) and reveal a centered "Detail" pill that opens
// that content's detail page — same overlay→pill→navigate shape as
// ListRailCard's front poster. To the right: reviewer avatar + username on
// their own row, the star rating (their personal verdict, belongs with
// their identity) on the row below, then the review text.
//
// Reveal state is shared app-wide via `PosterRevealContext`, the same one
// ListRailCard's Popular Lists cards use — so at most one poster's pill
// (list or review) is open anywhere on Discover, and tapping a different
// card's poster (in either section) switches straight to it in one tap.
// Tapping the reviewer row/rating, or the review text itself, always
// calls `close()` (or `reveal()` for the text, see below) directly rather
// than checking "is something open first" — `close()` on an
// already-closed state and `reveal()` on an already-open one are both
// harmless no-ops, so there's nothing to guard.
//
// The review text doesn't expand in place — growing a narrow column
// downward read badly once cards went full-width with real text volume.
// Tapping it does two things in one motion, per direct ask: it makes
// *this* card the revealed one (closing whatever else — list or review —
// was open, same as tapping this poster would) and opens a real `Modal`
// with the complete text in the same visual language (poster+title+likes,
// reviewer+rating, then the full scrollable quote). A Modal is the right
// tool here, unlike the one ListRailCard tried and reverted: that one
// broke the ability to keep using the rest of the page while it was open,
// which was a bug, but a modal whose entire purpose is "focus on reading
// this one thing until you tap away" is supposed to block everything else
// while open.
export default function ReviewSwipeCard({ review, basePath }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const { isRevealed, reveal, close } = usePosterReveal(`review-${review._id}`);
  const [fullTextVisible, setFullTextVisible] = useState(false);
  const [hasLiked, setHasLiked] = useState(review.hasLiked);
  const [likeCount, setLikeCount] = useState(review.likeCount);
  const [liking, setLiking] = useState(false);

  const handleToggleLike = async () => {
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

  const goToContent = () => router.push(`${basePath}/content/${review.content.type}/${review.content.id}` as any);
  const openFullText = () => {
    reveal();
    setFullTextVisible(true);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          flexDirection: "row",
          alignItems: "flex-start",
          backgroundColor: colors.base200,
          borderRadius: CARD_RADIUS,
          padding: 12,
          gap: 12,
        },
        posterWrap: { width: POSTER_WIDTH, height: POSTER_HEIGHT, borderRadius: POSTER_RADIUS, overflow: "hidden", backgroundColor: colors.base300 },
        poster: { width: "100%", height: "100%" },
        overlay: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.55)",
          alignItems: "center",
          justifyContent: "center",
          padding: 6,
        },
        contentTitle: { color: "#fff", fontFamily: fonts.bold, fontSize: 12, textAlign: "center" },
        overlayLikeRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 6 },
        overlayLikeText: { color: "#fff", fontFamily: fonts.medium, fontSize: 11 },
        // No background — the whole point of hiding the overlay is to see
        // the bare poster underneath, same as ListRailCard's own
        // detailsCatcher. An earlier version reused `overlay` (dark) here
        // by mistake, so the tint never actually lifted.
        detailsCatcher: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
        },
        detailsButton: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12 },
        detailsButtonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 11 },
        textCol: { flex: 1 },
        headerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
        rating: { marginTop: 6 },
        quote: { marginTop: 8, fontFamily: fonts.italic, fontSize: 13, lineHeight: 18, color: colors.baseContent },
      }),
    [colors]
  );

  return (
    <View style={styles.card}>
      <View style={styles.posterWrap}>
        {review.content.poster_path && <Image source={{ uri: `${POSTER_BASE}${review.content.poster_path}` }} style={styles.poster} />}
        {!isRevealed ? (
          <Pressable style={styles.overlay} onPress={reveal}>
            <Text style={styles.contentTitle} numberOfLines={2}>
              {review.content.title}
            </Text>
            <View style={styles.overlayLikeRow}>
              <Ionicons name="heart" size={11} color="#fff" />
              <Text style={styles.overlayLikeText}>{review.likeCount}</Text>
            </View>
          </Pressable>
        ) : (
          <Pressable style={styles.detailsCatcher} onPress={close}>
            <Pressable style={styles.detailsButton} onPress={goToContent}>
              <Text style={styles.detailsButtonText}>{t("Detail")}</Text>
            </Pressable>
          </Pressable>
        )}
      </View>

      <View style={styles.textCol}>
        <Pressable style={styles.headerRow} onPress={close}>
          <UserAvatar
            userId={review.user._id}
            username={review.user.username}
            profilePicUrl={review.user.profile_pic_url}
            size={24}
            tier={review.user.accountTier}
            frameBackgroundColor={colors.base200}
            disabled
          />
          <TierGradientText
            text={review.user.username}
            tier={review.user.accountTier}
            fontSize={13}
            bold
            color={colors.baseContent}
            gradientId={`reviewSwipeUsernameGradient-${review._id}`}
          />
        </Pressable>
        {review.rating != null && (
          <Pressable style={styles.rating} onPress={close}>
            <StarRatingDisplay value={review.rating} size={12} />
          </Pressable>
        )}
        <Pressable onPress={openFullText}>
          <Text style={styles.quote} numberOfLines={COLLAPSED_LINES}>{`"${review.text}"`}</Text>
        </Pressable>
      </View>

      <ReviewFullTextModal
        review={review}
        basePath={basePath}
        visible={fullTextVisible}
        onClose={() => setFullTextVisible(false)}
        hasLiked={hasLiked}
        likeCount={likeCount}
        onToggleLike={handleToggleLike}
        liking={liking}
      />
    </View>
  );
}
