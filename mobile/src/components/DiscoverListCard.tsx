import { useMemo, useState } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
// From react-native-gesture-handler, not react-native — this card's own
// film strip now also nests inside ListsSwiper.tsx's outer horizontal
// pager (same axis), which a plain ScrollView here can't negotiate against
// — the drag just gets claimed by the outer pager (swipes to the next
// list) instead of ever scrolling the strip. GHPressable specifically for
// the card's own outer Pressable (the film strip's direct ancestor) — same
// reasoning ShareCard.tsx's own list-post box already documents: every
// Pressable ancestor of a gesture-handler scroller needs to itself be
// gesture-handler's version, or it can claim the touch before the scroller
// ever gets a chance to. The individual poster Pressables *inside* the
// strip stay plain — they're children of the scroller, not ancestors, so
// they're not part of this same negotiation.
import { ScrollView, Pressable as GHPressable } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import UserAvatar from "./UserAvatar";
import TierGradientText from "./TierGradientText";
import { toggleListLike } from "../api/listService";
import type { DiscoverListItem } from "../types";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { fonts } from "../theme/typography";
import { CASCADE_POSTER_RADIUS } from "./PosterCascade";

const POSTER_BASE = "https://image.tmdb.org/t/p/w154";
// Same ratio as ShareCard.tsx's own list-post film strip (56 × 56*1.5),
// reused verbatim rather than re-derived, per direct ask that this page's
// list cards should look like that exact strip.
const FILM_STRIP_POSTER_WIDTH = 56;
const FILM_STRIP_POSTER_HEIGHT = FILM_STRIP_POSTER_WIDTH * 1.5;
const CARD_RADIUS = 12;

interface Props {
  list: DiscoverListItem;
  onPress: () => void;
  // Widened from the original "/home" | "/search" (this card's only two
  // callers at the time) so ContentListsSection.tsx can reuse it from any
  // of the 8 tabs Content Detail is duplicated into — same broader set
  // ContentCard.tsx already uses for the same reason.
  basePath: "/home" | "/search" | "/socials" | "/watchlist" | "/to-watch" | "/lists" | "/profile" | `/user/${string}`;
}

// Vertical list-preview card, backing both "Lists from Friends" and
// "Popular Lists" — same design for both, per the user's explicit ask.
// Owner avatar+username sit top-right (reversed from this card's earlier
// top-left layout); below that, a description (if any, italic — see
// `description` style) and then a flush "film strip" of preview posters —
// same look as ShareCard.tsx's own list-post box (zero-gap, square-cornered
// thumbnails, only the strip's outer ends rounded, thin colors.border
// frame), reused directly rather than this card's earlier gapped/
// individually-rounded poster row, per direct ask. The static "Following"
// badge that used to sit here (marking list.fromFollowing) was removed per
// direct ask — list.fromFollowing itself is untouched and still drives
// ListsSection.tsx's own "Lists from Friends" filtering, only this card's
// own visual badge is gone.
// Also now this exact design's the one Discover's ListsSwiper.tsx AND
// ListsSection.tsx (the "See all" page) both use — a real bug caught live:
// ListsSection.tsx had drifted onto search/SearchListCard.tsx instead
// (Search's own, differently-designed result card) despite ListsSwiper.tsx's
// own comment claiming they already matched. Fixed by pointing
// ListsSection.tsx back at this component. The like/view counts on the
// bottom row are a real tappable heart now (was static, no onPress) — same
// Like?/Liked + count pattern SearchListCard.tsx's own footer already used,
// direct ask that this card's engagement row actually work everywhere it
// renders, not just where SearchListCard happened to.
// Premium/Plus is shown via the owner's avatar ring + a metallic gradient-
// filled username (TierGradientText, gold/silver off the same
// TIER_FRAME_STYLES pair the ring itself uses) — NOT the gold card-border
// SVG treatment ShareCard.tsx's posts use. That box-border stays a post-
// only signal by direct ask ("sadece postta geçerli olsun") — an earlier
// round had copied it here too, since undone.
export default function DiscoverListCard({ list, onPress, basePath }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  // Real tappable heart now (was a static heart+count, no onPress at all) —
  // same Like?/Liked + count wording and toggleListLike call SearchListCard.tsx's
  // own engagement row already used, direct ask that this card's footer match
  // that pattern instead of being purely decorative. `hasLiked` is optional on
  // DiscoverListItem (only /popular results carry it) — `!!list.hasLiked`
  // defaults an unknown state to false, same fallback SearchListCard.tsx uses.
  const [hasLiked, setHasLiked] = useState(!!list.hasLiked);
  const [likeCount, setLikeCount] = useState(list.likeCount);
  const [liking, setLiking] = useState(false);

  const handleToggleLike = async () => {
    if (liking) return;
    const prevLiked = hasLiked;
    const prevCount = likeCount;
    setHasLiked(!prevLiked);
    setLikeCount(prevLiked ? prevCount - 1 : prevCount + 1);
    setLiking(true);
    try {
      const result = await toggleListLike(list._id);
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
  const styles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: colors.base200,
      borderRadius: CARD_RADIUS,
      padding: 12,
      marginBottom: 12,
    },
    topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
    name: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent },
    ownerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    filmStripContainer: { marginTop: 10, borderRadius: CASCADE_POSTER_RADIUS, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
    filmStripPoster: { width: FILM_STRIP_POSTER_WIDTH, height: FILM_STRIP_POSTER_HEIGHT, backgroundColor: colors.base300, overflow: "hidden" },
    filmStripFallback: { alignItems: "center", justifyContent: "center" },
    filmStripFallbackText: { color: colors.placeholder, fontSize: 9, textAlign: "center", paddingHorizontal: 3 },
    // Above the film strip now (was below it) and italic — direct ask;
    // only rendered at all when a description exists.
    description: { fontSize: 12, fontStyle: "italic", color: colors.baseContent, marginTop: 10, lineHeight: 16 },
    // Item count (left) + like/view (right) — was just the plain count on
    // its own line; direct ask to add engagement counts to this card's
    // bottom-right, same icons search/SearchListCard.tsx's own footer uses.
    footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
    count: { fontSize: 11, color: colors.placeholder },
    engagementRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    engagementUnit: { flexDirection: "row", alignItems: "center", gap: 4 },
    engagementText: { fontFamily: fonts.medium, fontSize: 11, color: colors.placeholder },
    engagementTextActive: { color: colors.primary },
  }), [colors]);

  return (
    <GHPressable style={styles.card} onPress={onPress}>
      <View style={styles.topRow}>
        <Text style={styles.name} numberOfLines={1}>
          {list.name}
        </Text>
        <View style={styles.ownerRow}>
          <TierGradientText
            text={list.owner.username}
            tier={list.owner.accountTier}
            fontSize={12}
            color={colors.placeholder}
            gradientId={`discoverListOwnerGradient-${list._id}`}
          />
          <UserAvatar
            userId={list.owner._id}
            username={list.owner.username}
            profilePicUrl={list.owner.profile_pic_url}
            size={22}
            tier={list.owner.accountTier}
            frameBackgroundColor={colors.base200}
            disabled
          />
        </View>
      </View>

      {list.description ? (
        <Text style={styles.description} numberOfLines={1}>
          {list.description}
        </Text>
      ) : null}

      {list.previewItems.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filmStripContainer}>
          {list.previewItems.map((item) => (
            <Pressable
              key={`${item.itemType}-${item.itemId}`}
              style={styles.filmStripPoster}
              onPress={() => router.push(`${basePath}/content/${item.itemType}/${item.itemId}` as any)}
            >
              {item.poster_path ? (
                <Image source={{ uri: `${POSTER_BASE}${item.poster_path}` }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFill, styles.filmStripFallback]}>
                  <Text style={styles.filmStripFallbackText} numberOfLines={3}>
                    {item.title}
                  </Text>
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>
      )}

      <View style={styles.footerRow}>
        <Text style={styles.count}>{t("item_count", { count: list.items.length })}</Text>
        <View style={styles.engagementRow}>
          {/* Its own nested Pressable — "inner tap wins" over the card's
              own onPress, so liking doesn't also trigger navigation. Same
              Like?/Liked + count wording every other like button in this
              app uses (SearchListCard.tsx, List Detail, Reviews). */}
          <Pressable style={styles.engagementUnit} onPress={handleToggleLike} disabled={liking} hitSlop={6}>
            <Ionicons name={hasLiked ? "heart" : "heart-outline"} size={13} color={hasLiked ? colors.primary : colors.placeholder} />
            <Text style={[styles.engagementText, hasLiked && styles.engagementTextActive]}>
              {hasLiked ? t("Liked") : t("Like?")} {likeCount}
            </Text>
          </Pressable>
          <View style={styles.engagementUnit}>
            <Ionicons name="eye-outline" size={14} color={colors.placeholder} />
            <Text style={styles.engagementText}>{list.views}</Text>
          </View>
        </View>
      </View>
    </GHPressable>
  );
}
