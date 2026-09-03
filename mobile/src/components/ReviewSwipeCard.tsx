import { useMemo, useState } from "react";
import { View, Text, Image, Pressable, Modal, ScrollView, useWindowDimensions, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import UserAvatar from "./UserAvatar";
import StarRatingDisplay from "./StarRatingDisplay";
import { usePosterReveal } from "../context/PosterRevealContext";
import type { PopularReview } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w185";
export const POSTER_WIDTH = 84;
export const POSTER_HEIGHT = POSTER_WIDTH * 1.5;
const POSTER_RADIUS = 8;
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
  const { height: screenHeight } = useWindowDimensions();
  const { isRevealed, reveal, close } = usePosterReveal(`review-${review._id}`);
  const [fullTextVisible, setFullTextVisible] = useState(false);

  const goToContent = () => router.push(`${basePath}/content/${review.content.type}/${review.content.id}` as any);
  const openFullText = () => {
    reveal();
    setFullTextVisible(true);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: { flexDirection: "row", alignItems: "flex-start", backgroundColor: colors.base200, borderRadius: 16, padding: 12, gap: 12 },
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
        username: { flex: 1, fontFamily: fonts.bold, fontSize: 13, color: colors.baseContent },
        rating: { marginTop: 6 },
        quote: { marginTop: 8, fontFamily: fonts.italic, fontSize: 13, lineHeight: 18, color: colors.baseContent },
        // Popup ("yeni pencere") — same visual language as the card itself,
        // just full text and no truncation. `modalRoot` is NOT itself a
        // Pressable (a prior round made it one, wrapping the ScrollView as
        // its descendant — a Pressable ancestor claiming the touch before
        // the ScrollView gets a chance to recognize a drag is the likely
        // reason scrolling never actually worked despite the sizing being
        // correct). Closing-on-tap now lives on a separate, absolutely-
        // positioned sibling behind the card (`modalCloseZone`), so the
        // ScrollView has zero Pressable ancestors to compete with.
        modalRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
        modalCloseZone: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
        // A concrete pixel maxHeight (from useWindowDimensions) instead of
        // a percentage string — more reliable inside a Modal's own layout
        // root than "80%" tends to be. overflow:"hidden" + flexShrink:1
        // (not flex:1) on the ScrollView below are both required for this
        // to actually scroll: this card has no explicit height, so a plain
        // flex:1 child has nothing definite to fill against and collapses
        // to zero. flexShrink:1 takes natural (full-text) size when that
        // fits under the cap, and only shrinks — becoming scrollable —
        // once it doesn't.
        modalCard: { backgroundColor: colors.base200, borderRadius: 16, padding: 16, maxHeight: screenHeight * 0.8, overflow: "hidden" },
        // Wraps just the header/reviewer/rating block in one tap-to-close
        // target — deliberately NOT wrapping the ScrollView.
        modalTapToClose: {},
        // Poster is a centered hero, not paired side-by-side with the
        // title anymore — title sits directly below it, also centered.
        modalPosterSection: { alignItems: "center" },
        modalPoster: { width: 48, height: 72, borderRadius: 6, backgroundColor: colors.base300 },
        modalContentTitle: { marginTop: 8, fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent, textAlign: "center" },
        // One row: avatar+username clustered at the start, rating right
        // after the name ends, like count pushed to the far end via the
        // flexible spacer — not spread with justifyContent, since rating
        // needs to hug the name rather than float independently.
        modalReviewerRow: { flexDirection: "row", alignItems: "center", marginTop: 14 },
        modalUsername: { marginLeft: 6, fontFamily: fonts.bold, fontSize: 12, color: colors.baseContent },
        modalRating: { marginLeft: 8 },
        modalReviewerSpacer: { flex: 1 },
        modalLikeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
        modalLikeText: { fontFamily: fonts.medium, fontSize: 12, color: colors.placeholder },
        modalScroll: { flexShrink: 1 },
        modalQuote: { marginTop: 10, fontFamily: fonts.italic, fontSize: 14, lineHeight: 21, color: colors.baseContent },
      }),
    [colors, screenHeight]
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
          <UserAvatar userId={review.user._id} username={review.user.username} profilePicUrl={review.user.profile_pic_url} size={24} disabled />
          <Text style={styles.username} numberOfLines={1}>
            {review.user.username}
          </Text>
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

      <Modal transparent visible={fullTextVisible} animationType="fade" onRequestClose={() => setFullTextVisible(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalCloseZone} onPress={() => setFullTextVisible(false)} />
          <View style={styles.modalCard} pointerEvents="box-none">
            <Pressable style={styles.modalTapToClose} onPress={() => setFullTextVisible(false)}>
              <View style={styles.modalPosterSection}>
                {review.content.poster_path ? (
                  <Image source={{ uri: `${POSTER_BASE}${review.content.poster_path}` }} style={styles.modalPoster} />
                ) : (
                  <View style={styles.modalPoster} />
                )}
                <Text style={styles.modalContentTitle} numberOfLines={2}>
                  {review.content.title}
                </Text>
              </View>
              <View style={styles.modalReviewerRow}>
                <UserAvatar userId={review.user._id} username={review.user.username} profilePicUrl={review.user.profile_pic_url} size={26} disabled />
                <Text style={styles.modalUsername} numberOfLines={1}>
                  {review.user.username}
                </Text>
                {review.rating != null && (
                  <View style={styles.modalRating}>
                    <StarRatingDisplay value={review.rating} size={13} />
                  </View>
                )}
                <View style={styles.modalReviewerSpacer} />
                <View style={styles.modalLikeRow}>
                  <Ionicons name="heart" size={12} color={colors.placeholder} />
                  <Text style={styles.modalLikeText}>{review.likeCount}</Text>
                </View>
              </View>
            </Pressable>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalQuote}>{`"${review.text}"`}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
