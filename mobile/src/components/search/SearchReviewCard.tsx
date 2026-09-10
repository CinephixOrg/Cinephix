import { useMemo, useState } from "react";
import { View, Text, Image, Pressable, Modal, ScrollView, useWindowDimensions, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import UserAvatar from "../UserAvatar";
import StarRatingDisplay from "../StarRatingDisplay";
import type { PopularReview } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w500";
// Matches ShareCard.tsx's own review-post box — a long review is truncated
// with an ellipsis at this many lines; tapping it opens the full text in a
// Modal, same pattern (a real life-saver for a long review, which this
// card's own fixed-height box would otherwise stretch to fit).
const REVIEW_COLLAPSED_LINES = 3;

interface Props {
  review: PopularReview;
  basePath: "/search";
}

// Search's own review-result card — a new component rather than reusing
// ReviewFeedCard.tsx (also used by Home's Popular Reviews rail, which
// wasn't asked to change): matches ShareCard.tsx's own review-post box
// (poster left, title+rating+quoted italic excerpt right) instead of
// ReviewFeedCard's own layout, folds the reviewer's profile and like count
// *inside* the box (a feed post keeps those in its outer header/footer,
// which doesn't exist here), and opens the same kind of in-place Modal
// ShareCard uses for a long review instead of navigating to Content Detail.
export default function SearchReviewCard({ review, basePath }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { height: screenHeight } = useWindowDimensions();
  const [fullReviewVisible, setFullReviewVisible] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 10,
          backgroundColor: colors.base200,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.placeholder,
          padding: 12,
          marginHorizontal: 16,
          marginBottom: 12,
        },
        poster: { width: 64, height: 96, borderRadius: 6, backgroundColor: colors.base300, overflow: "hidden" },
        textCol: { flex: 1, gap: 4, paddingTop: 2 },
        title: { fontFamily: fonts.bold, fontSize: 14, color: colors.baseContent },
        ownerRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
        ownerName: { fontFamily: fonts.medium, fontSize: 12, color: colors.baseContent },
        ratingRow: { marginTop: 1 },
        quote: { fontFamily: fonts.italic, fontSize: 12, color: colors.baseContent, lineHeight: 17, marginTop: 2 },
        footerRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
        likeText: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.placeholder },
        modalRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
        modalCard: {
          backgroundColor: colors.base200,
          borderRadius: 16,
          padding: 16,
          maxHeight: screenHeight * 0.8,
          overflow: "hidden",
        },
        modalPoster: { width: 48, height: 72, borderRadius: 6, alignSelf: "center", backgroundColor: colors.base300 },
        modalTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent, textAlign: "center", marginTop: 8 },
        modalOwnerRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14 },
        modalOwnerName: { fontFamily: fonts.bold, fontSize: 12, color: colors.baseContent },
        modalQuote: { fontFamily: fonts.italic, fontSize: 14, color: colors.baseContent, lineHeight: 21, marginTop: 14 },
      }),
    [colors, screenHeight]
  );

  const goToContent = () => router.push(`${basePath}/content/${review.content.type}/${review.content.id}` as any);

  return (
    <Pressable style={styles.card} onPress={goToContent}>
      {review.content.poster_path ? (
        <Image source={{ uri: `${POSTER_BASE}${review.content.poster_path}` }} style={styles.poster} />
      ) : (
        <View style={styles.poster} />
      )}
      <View style={styles.textCol}>
        <Text style={styles.title} numberOfLines={2}>
          {review.content.title}
        </Text>

        <Pressable style={styles.ownerRow} onPress={() => router.push(`/user/${review.user._id}` as any)} hitSlop={4}>
          <UserAvatar userId={review.user._id} username={review.user.username} profilePicUrl={review.user.profile_pic_url} size={20} disabled />
          <Text style={styles.ownerName}>{review.user.username}</Text>
        </Pressable>

        {review.rating != null && (
          <View style={styles.ratingRow}>
            <StarRatingDisplay value={review.rating} size={13} />
          </View>
        )}

        <Pressable onPress={() => setFullReviewVisible(true)}>
          <Text style={styles.quote} numberOfLines={REVIEW_COLLAPSED_LINES}>{`"${review.text}"`}</Text>
        </Pressable>

        <View style={styles.footerRow}>
          <Ionicons name="heart" size={13} color={colors.placeholder} />
          <Text style={styles.likeText}>{review.likeCount}</Text>
        </View>
      </View>

      <Modal transparent animationType="fade" visible={fullReviewVisible} onRequestClose={() => setFullReviewVisible(false)}>
        <Pressable style={styles.modalRoot} onPress={() => setFullReviewVisible(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            {review.content.poster_path ? (
              <Image source={{ uri: `${POSTER_BASE}${review.content.poster_path}` }} style={styles.modalPoster} />
            ) : null}
            <Text style={styles.modalTitle} numberOfLines={2}>
              {review.content.title}
            </Text>
            <View style={styles.modalOwnerRow}>
              <UserAvatar userId={review.user._id} username={review.user.username} profilePicUrl={review.user.profile_pic_url} size={26} disabled />
              <Text style={styles.modalOwnerName}>{review.user.username}</Text>
              {review.rating != null && <StarRatingDisplay value={review.rating} size={13} />}
            </View>
            <ScrollView>
              <Text style={styles.modalQuote}>{`"${review.text}"`}</Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Pressable>
  );
}
