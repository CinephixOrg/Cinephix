import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Image, Pressable, Animated, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import UserAvatar from "./UserAvatar";
import StarRatingDisplay from "./StarRatingDisplay";
import FollowButton from "./FollowButton";
import { registerShareView } from "../api/shareService";
import type { Share } from "../types";
import { useTheme } from "../context/ThemeContext";
import type { ColorPalette } from "../theme/palettes";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w500";

interface Props {
  share: Share;
  onToggleLike: () => void;
  basePath: "/home" | "/profile";
}

export function typeMeta(type: Share["type"], colors: ColorPalette, t: (k: string) => string) {
  switch (type) {
    case "analysis":
      return { icon: "sparkles" as const, label: t("Analysis"), color: colors.secondary };
    case "review":
      return { icon: "pencil" as const, label: t("Review"), color: colors.info };
    case "recommendation":
      return { icon: "gift" as const, label: t("Recommendation"), color: colors.warning };
  }
}

// Splits a caption string around one or more literal substrings (username,
// content title, ...) so each renders as its own tappable, colored Text
// node while the rest of the sentence stays plain — a link whose text
// doesn't actually appear in the caption (e.g. a recommendation's custom
// note, which never mentions the sharer by name) is simply skipped.
function renderCaptionWithLinks(text: string, links: { text: string; style: any; onPress: () => void }[]) {
  const active = links.filter((l) => l.text && text.includes(l.text)).sort((a, b) => b.text.length - a.text.length);
  if (active.length === 0) return text;
  const pattern = new RegExp(`(${active.map((l) => l.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return text.split(pattern).map((part, i) => {
    const link = active.find((l) => l.text === part);
    return link ? (
      <Text key={i} style={link.style} onPress={link.onPress}>
        {part}
      </Text>
    ) : (
      part
    );
  });
}

// Pasted flat onto the page (no card background of its own — same
// colors.base100 as the page behind it), a hairline divider between posts.
// Both Review/Analysis and Recommendation share the same header (avatar+
// username+colored type badge+FollowButton, self-hiding on the viewer's own
// posts). Review/Analysis then show a caption (username always a colored
// link to that user's profile; Review also links the content title and
// shows the review text as an italic quote) and a like/view footer.
// Recommendation instead shows a fixed teaser line, then a full-bleed
// poster (the only element on the card that touches the true screen edge —
// everything else keeps the card's normal inset), then the same like/view
// footer, then a promotional "so-and-so recommends it" line last.
export default function ShareCard({ share, onToggleLike, basePath }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: colors.base100,
          marginBottom: 16,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 },
        headerTextCol: { flex: 1 },
        username: { fontFamily: fonts.bold, fontSize: 14, color: colors.baseContent },
        typeChip: {
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          gap: 4,
          paddingHorizontal: 7,
          paddingVertical: 2,
          borderRadius: 8,
          marginTop: 3,
        },
        typeChipText: { fontFamily: fonts.bold, fontSize: 10, color: "#fff", letterSpacing: 0.3 },
        // Full-bleed edge to edge — cancels out the 16px horizontal padding
        // every current container renders ShareCard inside (the feed
        // FlatList, the Profile Sharings modal), so the poster spans the
        // actual screen width while the header/caption/footer around it
        // stay inset as normal. Deliberately no explicit `width` here: a
        // fixed `width:"100%"` combined with a negative marginHorizontal
        // only *shifts* the box left (width stays pinned to the parent's
        // already-inset size) rather than growing it symmetrically — left a
        // gap on the right. Letting it fall back to the card's default
        // column-flex stretch sizing (no width override) means the negative
        // margin correctly expands the box outward on both sides instead.
        posterFrame: {
          marginHorizontal: -16,
          aspectRatio: 1.2,
          backgroundColor: colors.base300,
          overflow: "hidden",
          position: "relative",
        },
        posterTint: { backgroundColor: "rgba(0,0,0,0.55)" },
        detailsButtonWrap: { alignItems: "center", justifyContent: "center" },
        detailsButton: {
          paddingHorizontal: 20,
          paddingVertical: 9,
          borderRadius: 20,
          backgroundColor: "rgba(255,255,255,0.92)",
        },
        detailsButtonText: { fontFamily: fonts.bold, fontSize: 13, color: "#111" },
        analysisBox: { marginHorizontal: 12, backgroundColor: colors.base100, borderRadius: 10, padding: 14 },
        analysisNickname: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary },
        analysisSummary: { fontSize: 13, color: colors.baseContent, marginTop: 6, lineHeight: 18 },
        captionBlock: { padding: 12, paddingTop: 2 },
        caption: { fontFamily: fonts.bold, fontSize: 13, color: colors.baseContent, lineHeight: 18 },
        captionLink: { color: colors.primary },
        reviewQuote: { fontFamily: fonts.italic, fontSize: 13, color: colors.baseContent, lineHeight: 18, marginTop: 4 },
        ratingRow: { marginBottom: 6 },
        footer: {
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          paddingHorizontal: 12,
          paddingBottom: 12,
          paddingTop: 2,
        },
        likeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
        likeCount: { fontFamily: fonts.medium, fontSize: 12, color: colors.placeholder },
        viewRow: { flexDirection: "row", alignItems: "center", gap: 6 },
        viewCount: { fontFamily: fonts.medium, fontSize: 12, color: colors.placeholder },
        // Recommendation-only: header row is the same shared avatar+
        // username+badge+FollowButton shape as Review/Analysis (brought
        // back after the username/badge-less version felt too bare) — the
        // teaser line follows below it, then the full-bleed poster (the
        // only element that touches the true screen edge), then the shared
        // like/view footer, then the promo line last.
        recTeaser: { fontFamily: fonts.bold, fontSize: 13, color: colors.baseContent, paddingHorizontal: 12, paddingBottom: 10 },
        recBottomLeft: { flexDirection: "row", alignItems: "center", gap: 16 },
        recPromo: { fontFamily: fonts.bold, fontSize: 13, color: colors.baseContent, paddingHorizontal: 12, paddingTop: 6 },
      }),
    [colors]
  );

  const goToContent = () => {
    if (share.contentId && share.contentType) {
      router.push(`${basePath}/content/${share.contentType}/${share.contentId}` as any);
    }
  };
  const goToUser = () => router.push(`/user/${share.user._id}` as any);

  const [revealed, setRevealed] = useState(false);
  const tintOpacity = useRef(new Animated.Value(1)).current;
  const toggleReveal = () => {
    const next = !revealed;
    setRevealed(next);
    Animated.timing(tintOpacity, { toValue: next ? 0 : 1, duration: 200, useNativeDriver: true }).start();
  };

  const likeBounce = useRef(new Animated.Value(1)).current;
  const handleLikePress = () => {
    onToggleLike();
    likeBounce.setValue(1.4);
    Animated.spring(likeBounce, { toValue: 1, useNativeDriver: true, friction: 4 }).start();
  };

  useEffect(() => {
    registerShareView(share._id).catch(() => {});
    // Fire once per mount — the backend dedupes by user, so a re-mount
    // while scrolling is a harmless no-op, not a double count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [share._id]);

  const meta = typeMeta(share.type, colors, t);
  const posterUri = share.contentData?.posterUrl ? `${POSTER_BASE}${share.contentData.posterUrl}` : null;

  // Split into two pieces rendered in two different places on the card now
  // (teaser above the poster, promo line below it) — the teaser is a fixed
  // hook line shown regardless of a custom note; only the dynamic "so-and-
  // so recommends it" half gets replaced by the sharer's own note when set.
  const recommendTeaser = () => t(share.contentType === "series" ? "Have you watched this series yet?" : "Have you watched this movie yet?");
  const recommendPromo = () => {
    if (share.note) return share.note;
    const key = share.contentType === "series" ? "recommend_promo_series" : "recommend_promo_movie";
    return t(key, { user: share.user.username });
  };

  const userLink = { text: share.user.username, style: styles.captionLink, onPress: goToUser };
  const titleLink = share.contentData?.title ? { text: share.contentData.title, style: styles.captionLink, onPress: goToContent } : null;

  const likeViewRow = (
    <View style={styles.recBottomLeft}>
      <View style={styles.likeRow}>
        <Animated.View style={{ transform: [{ scale: likeBounce }] }}>
          <Pressable onPress={handleLikePress} hitSlop={6}>
            <Ionicons name={share.liked ? "heart" : "heart-outline"} size={24} color={share.liked ? colors.error : colors.baseContent} />
          </Pressable>
        </Animated.View>
        {share.likeCount > 0 && <Text style={styles.likeCount}>{share.likeCount}</Text>}
      </View>

      <View style={styles.viewRow}>
        <Ionicons name="eye-outline" size={20} color={colors.baseContent} />
        {share.viewCount > 0 && <Text style={styles.viewCount}>{share.viewCount}</Text>}
      </View>
    </View>
  );

  if (share.type === "recommendation" && share.contentData) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <UserAvatar userId={share.user._id} username={share.user.username} profilePicUrl={share.user.profile_pic_url} size={38} />
          <View style={styles.headerTextCol}>
            <Text style={styles.username}>{share.user.username}</Text>
            <View style={[styles.typeChip, { backgroundColor: meta.color }]}>
              <Ionicons name={meta.icon} size={10} color="#fff" />
              <Text style={styles.typeChipText}>{meta.label.toUpperCase()}</Text>
            </View>
          </View>
          <FollowButton targetUserId={share.user._id} size="small" />
        </View>
        <Text style={styles.recTeaser}>{recommendTeaser()}</Text>

        <Pressable style={styles.posterFrame} onPress={toggleReveal}>
          {posterUri && <Image source={{ uri: posterUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
          <Animated.View style={[StyleSheet.absoluteFill, styles.posterTint, { opacity: tintOpacity }]} pointerEvents="none" />
          {revealed && (
            <View style={[StyleSheet.absoluteFill, styles.detailsButtonWrap]} pointerEvents="box-none">
              <Pressable style={styles.detailsButton} onPress={goToContent}>
                <Text style={styles.detailsButtonText}>{t("Detail")}</Text>
              </Pressable>
            </View>
          )}
        </Pressable>

        <View style={styles.footer}>{likeViewRow}</View>
        <Text style={styles.recPromo}>{renderCaptionWithLinks(recommendPromo(), [userLink])}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <UserAvatar userId={share.user._id} username={share.user.username} profilePicUrl={share.user.profile_pic_url} size={38} />
        <View style={styles.headerTextCol}>
          <Text style={styles.username}>{share.user.username}</Text>
          <View style={[styles.typeChip, { backgroundColor: meta.color }]}>
            <Ionicons name={meta.icon} size={10} color="#fff" />
            <Text style={styles.typeChipText}>{meta.label.toUpperCase()}</Text>
          </View>
        </View>
        <FollowButton targetUserId={share.user._id} size="small" />
      </View>

      {share.type === "analysis" && share.analysisData && (
        <View style={styles.analysisBox}>
          {share.analysisData.nickname ? <Text style={styles.analysisNickname}>{share.analysisData.nickname}</Text> : null}
          {share.analysisData.personalitySummary ? (
            <Text style={styles.analysisSummary} numberOfLines={5}>
              {share.analysisData.personalitySummary}
            </Text>
          ) : null}
        </View>
      )}

      {share.type === "review" && share.contentData && (
        <View style={styles.captionBlock}>
          {share.reviewRating != null && (
            <View style={styles.ratingRow}>
              <StarRatingDisplay value={share.reviewRating} size={13} />
            </View>
          )}
          <Text style={styles.caption}>
            {renderCaptionWithLinks(
              t("{{user}} shared a review on {{title}}.", { user: share.user.username, title: share.contentData.title }),
              titleLink ? [userLink, titleLink] : [userLink]
            )}
          </Text>
          {share.reviewText ? <Text style={styles.reviewQuote}>{`"${share.reviewText}"`}</Text> : null}
        </View>
      )}

      <View style={styles.footer}>{likeViewRow}</View>
    </View>
  );
}
