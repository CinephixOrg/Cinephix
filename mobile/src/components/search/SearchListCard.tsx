import { useMemo, useState } from "react";
import { View, Text, Image, ScrollView, StyleSheet } from "react-native";
import Pressable from "../common/TapSafePressable";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import UserAvatar from "../UserAvatar";
import { toggleListLike } from "../../api/listService";
import { useToast } from "../../context/ToastContext";
import type { DiscoverListItem } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import { CASCADE_POSTER_RADIUS } from "../PosterCascade";

const POSTER_BASE = "https://image.tmdb.org/t/p/w154";
// Same ratio as ShareCard.tsx's own list-post film strip — reused verbatim,
// per direct ask that this card read as that exact post design.
const FILM_STRIP_POSTER_WIDTH = 56;
const FILM_STRIP_POSTER_HEIGHT = FILM_STRIP_POSTER_WIDTH * 1.5;
const CARD_RADIUS = 12;
// Same hand-picked gold pair as ShareCard.tsx's own TIER_GOLD/
// TIER_GOLD_HIGHLIGHT (itself the Sync profile cloud's rank-1 medal gold) —
// reused verbatim rather than picked fresh, so "gold = Premium" reads
// consistently everywhere it appears, per direct ask that a Premium
// owner's list box get "the same gold frame as the post."
const TIER_GOLD = "#FFC94A";
const TIER_GOLD_HIGHLIGHT = "#FFF3C4";

interface Props {
  list: DiscoverListItem;
  onPress: () => void;
  // "/search" for Search's own Lists tab; "/home" when this same card
  // design is reused for Discover's Lists preview (KesfetSection.tsx's
  // ListsSwiper.tsx) — same exact geometry, per direct ask.
  basePath: "/search" | "/home";
}

// Search's own list-result card — deliberately a new component rather than
// reusing DiscoverListCard.tsx (also used by Home/Content Detail, which
// weren't asked to change): matches ShareCard.tsx's own list-post box order
// (title, description, film strip, item count) instead of DiscoverListCard's
// slightly different top-row layout, and folds in the owner's profile plus
// like/view counts *inside* the box — on a feed post those live in the
// outer card header/footer, which doesn't exist here since a search result
// has no separate "post" chrome around it.
export default function SearchListCard({ list, onPress, basePath }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const isPremium = list.owner.accountTier === "premium";
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
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: colors.base200,
          borderRadius: CARD_RADIUS,
          padding: 12,
          marginHorizontal: 16,
          marginBottom: 12,
        },
        // Applied only for non-Premium — a Premium owner's box gets the
        // gold premiumBorder SVG instead, same split ShareCard.tsx's own
        // content boxes already use (contentBoxFrame vs. premiumBorder).
        cardFrame: { borderWidth: 1, borderColor: colors.placeholder },
        premiumBorderSvg: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
        ownerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
        ownerName: { fontFamily: fonts.medium, fontSize: 13, color: colors.baseContent },
        name: { fontFamily: fonts.bold, fontSize: 14, color: colors.baseContent },
        description: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.placeholder, lineHeight: 17, marginTop: 4 },
        filmStripContainer: { marginTop: 8, borderRadius: CASCADE_POSTER_RADIUS, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
        filmStripPoster: { width: FILM_STRIP_POSTER_WIDTH, height: FILM_STRIP_POSTER_HEIGHT, backgroundColor: colors.base300, overflow: "hidden" },
        filmStripFallback: { alignItems: "center", justifyContent: "center" },
        filmStripFallbackText: { color: colors.placeholder, fontSize: 9, textAlign: "center", paddingHorizontal: 3 },
        footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
        count: { fontFamily: fonts.medium, fontSize: 11, color: colors.placeholder },
        engagementRow: { flexDirection: "row", alignItems: "center", gap: 12 },
        engagementUnit: { flexDirection: "row", alignItems: "center", gap: 4 },
        engagementText: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.placeholder },
        engagementTextActive: { color: colors.primary },
      }),
    [colors]
  );

  // Hollow rounded-rect stroke overlaid on the card, last in paint order —
  // same technique (and gold pair) as ShareCard.tsx's own premiumBorder.
  const premiumBorder = isPremium ? (
    <Svg style={styles.premiumBorderSvg} pointerEvents="none">
      <Defs>
        <LinearGradient id="premiumListCardGradient" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={TIER_GOLD_HIGHLIGHT} />
          <Stop offset="1" stopColor={TIER_GOLD} />
        </LinearGradient>
      </Defs>
      <Rect x="1%" y="1%" width="98%" height="98%" rx={CARD_RADIUS - 1} stroke="url(#premiumListCardGradient)" strokeWidth={1.5} fill="none" />
    </Svg>
  ) : null;

  return (
    <Pressable style={[styles.card, !isPremium && styles.cardFrame]} onPress={onPress}>
      <Pressable style={styles.ownerRow} onPress={() => router.push(`/user/${list.owner._id}` as any)} hitSlop={4}>
        <UserAvatar userId={list.owner._id} username={list.owner.username} profilePicUrl={list.owner.profile_pic_url} size={28} disabled />
        <Text style={styles.ownerName}>{list.owner.username}</Text>
      </Pressable>

      <Text style={styles.name} numberOfLines={1}>
        {list.name}
      </Text>

      {list.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {list.description}
        </Text>
      ) : null}

      {list.previewItems.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filmStripContainer}>
          {/* Plain View, not its own Pressable — same fix as
              DiscoverListCard.tsx's own identical strip (see its comment):
              a nested Pressable competing with this card's own outer one for
              the same tap was causing a reported "list page opens, then a
              movie/series page stacks on top" bug. This card's outer
              Pressable is plain RN (not gesture-handler), so it likely
              never hit the exact same touch-system mismatch — but the fix
              is applied here too for consistency: wherever on a list card
              someone taps, it should always open the list, never a title
              inside it. */}
          {list.previewItems.map((item) => (
            <View key={`${item.itemType}-${item.itemId}`} style={styles.filmStripPoster}>
              {item.poster_path ? (
                <Image source={{ uri: `${POSTER_BASE}${item.poster_path}` }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFill, styles.filmStripFallback]}>
                  <Text style={styles.filmStripFallbackText} numberOfLines={3}>
                    {item.title}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      <View style={styles.footerRow}>
        <Text style={styles.count}>{t("item_count", { count: list.items.length })}</Text>
        <View style={styles.engagementRow}>
          {/* Its own nested Pressable — "inner tap wins" over the card's
              own onPress, so liking doesn't also trigger the card's tap
              action. Same Like?/Liked + count wording every other like
              button in this app now uses (List Detail, Reviews). */}
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
      {premiumBorder}
    </Pressable>
  );
}
