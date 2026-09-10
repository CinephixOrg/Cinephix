import { useMemo } from "react";
import { View, Text, Image, Pressable, Modal, ScrollView, useWindowDimensions, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import UserAvatar from "./UserAvatar";
import TierGradientText from "./TierGradientText";
import StarRatingDisplay from "./StarRatingDisplay";
import { useTranslation } from "react-i18next";
import type { PopularReview } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w185";

interface Props {
  review: PopularReview;
  basePath: "/home" | "/search";
  visible: boolean;
  onClose: () => void;
  hasLiked: boolean;
  likeCount: number;
  onToggleLike: () => void;
  liking: boolean;
}

// The full-text review popup — originally ReviewSwipeCard.tsx's own inline
// Modal, pulled out into a shared component so ReviewFeedCard.tsx's cards
// (Discover's Popular Reviews list) can open the exact same design instead
// of a second hand-built copy, direct ask ("aynı discoverydeki uzun metinli
// review kartlarına yaptığımız gibi aynı tasarımdaki o küçük pencere").
// The like row here used to be a plain decorative heart+count — now a real
// tappable Like?/Liked toggle, same wording/shape List Detail's own like
// button uses, and actually wired to the caller's own like state/handler
// instead of just displaying it.
export default function ReviewFullTextModal({ review, basePath, visible, onClose, hasLiked, likeCount, onToggleLike, liking }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { height: screenHeight } = useWindowDimensions();

  const goToContent = () => {
    onClose();
    router.push(`${basePath}/content/${review.content.type}/${review.content.id}` as any);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        modalRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
        modalCloseZone: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
        modalCard: { backgroundColor: colors.base200, borderRadius: 16, padding: 16, maxHeight: screenHeight * 0.8, overflow: "hidden" },
        modalTapToClose: {},
        modalPosterSection: { alignItems: "center" },
        modalPoster: { width: 48, height: 72, borderRadius: 6, backgroundColor: colors.base300 },
        modalContentTitle: { marginTop: 8, fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent, textAlign: "center" },
        modalReviewerRow: { flexDirection: "row", alignItems: "center", marginTop: 14, gap: 6 },
        modalRating: { marginLeft: 8 },
        modalReviewerSpacer: { flex: 1 },
        modalLikeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
        modalLikeText: { fontSize: 12, fontFamily: fonts.medium, color: colors.placeholder },
        modalLikeTextActive: { color: colors.primary },
        modalScroll: { flexShrink: 1 },
        modalQuote: { marginTop: 10, fontFamily: fonts.italic, fontSize: 14, lineHeight: 21, color: colors.baseContent },
      }),
    [colors, screenHeight]
  );

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalCloseZone} onPress={onClose} />
        <View style={styles.modalCard} pointerEvents="box-none">
          <Pressable style={styles.modalTapToClose} onPress={onClose}>
            <Pressable style={styles.modalPosterSection} onPress={goToContent}>
              {review.content.poster_path ? (
                <Image source={{ uri: `${POSTER_BASE}${review.content.poster_path}` }} style={styles.modalPoster} />
              ) : (
                <View style={styles.modalPoster} />
              )}
              <Text style={styles.modalContentTitle} numberOfLines={2}>
                {review.content.title}
              </Text>
            </Pressable>
            <View style={styles.modalReviewerRow}>
              <UserAvatar
                userId={review.user._id}
                username={review.user.username}
                profilePicUrl={review.user.profile_pic_url}
                size={26}
                tier={review.user.accountTier}
                frameBackgroundColor={colors.base200}
                disabled
              />
              <TierGradientText
                text={review.user.username}
                tier={review.user.accountTier}
                fontSize={12}
                bold
                color={colors.baseContent}
                gradientId={`reviewFullTextModalUsernameGradient-${review._id}`}
              />
              {review.rating != null && (
                <View style={styles.modalRating}>
                  <StarRatingDisplay value={review.rating} size={13} />
                </View>
              )}
              <View style={styles.modalReviewerSpacer} />
              <Pressable style={styles.modalLikeRow} onPress={onToggleLike} disabled={liking} hitSlop={8}>
                <Ionicons name={hasLiked ? "heart" : "heart-outline"} size={14} color={hasLiked ? colors.primary : colors.placeholder} />
                <Text style={[styles.modalLikeText, hasLiked && styles.modalLikeTextActive]}>
                  {hasLiked ? t("Liked") : t("Like?")} {likeCount}
                </Text>
              </Pressable>
            </View>
          </Pressable>
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalQuote}>{`"${review.text}"`}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
