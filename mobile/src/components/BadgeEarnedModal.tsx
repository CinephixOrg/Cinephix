import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, View, Text, Image, Pressable, Animated, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useBadgeEarned } from "../context/BadgeEarnedContext";
import { useToast } from "../context/ToastContext";
import { useRecentShares } from "../context/RecentSharesContext";
import { createShare } from "../api/shareService";
import { GENRE_BADGE_DEFINITIONS } from "../data/genreBadgeDefinitions";
import { VOLUME_BADGE_DEFINITIONS } from "../data/volumeBadgeDefinitions";
import { ACTIVITY_BADGE_DEFINITIONS } from "../data/activityBadgeDefinitions";
import { STREAK_BADGE_DEFINITION } from "../data/loyaltyBadgeDefinitions";
import { useTheme } from "../context/ThemeContext";
import type { ColorPalette } from "../theme/palettes";
import type { ActivityTier, StreakTier, VolumeTier } from "../types";
import { fonts } from "../theme/typography";

// Same tier->label-key map ProfileBadgesTab.tsx uses for its volume tiles —
// duplicated rather than shared since it's a 5-entry literal, not worth an
// import for.
const VOLUME_TIER_LABEL_KEY: Record<VolumeTier, string> = {
  bronze: "Amateur",
  silver: "Enthusiast",
  gold: "Aficionado",
  platinum: "Connoisseur",
  diamond: "Cinephile",
};

// Same "you made the podium!" popup shape as PodiumNewsModal.tsx (overlay,
// dismiss-on-backdrop, a close X, tap-the-card-to-go-see-it) but triggered
// live off rateContent()'s own response (BadgeEarnedContext) instead of a
// once-per-session mount check — direct ask, "15.yi eklediğimde... gelsin,"
// this has to fire the moment the rating that actually crosses the
// threshold lands, not on the next app open. `queue[0]` is the badge on
// screen; dismissCurrent (any way this closes) advances to the next one if
// a single rating happened to cross more than one genre's threshold at
// once.
export default function BadgeEarnedModal() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const { announce: announceNewShare } = useRecentShares();
  const { queue, dismissCurrent } = useBadgeEarned();
  const [sharing, setSharing] = useState(false);
  // Separate from `sharing` (the in-flight spinner state) — once a share
  // actually succeeds the button turns into a disabled "Shared" state
  // permanently for THIS badge, direct ask after repeated taps were found
  // to post one Share per tap. Both reset together whenever a different
  // badge takes over the popup (the effect below), since a fresh badge is
  // a fresh, not-yet-shared thing.
  const [shared, setShared] = useState(false);
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const badge = queue[0] ?? null;
  const isStreak = badge?.family === "streak";
  const genreDef = badge?.family === "genre" ? GENRE_BADGE_DEFINITIONS.find((d) => d.key === badge.key) : undefined;
  const volumeDef = badge?.family === "volume" ? VOLUME_BADGE_DEFINITIONS.find((d) => d.key === badge.key) : undefined;
  const activityDef = badge && ["ratingCount", "reviewCount", "listCount"].includes(badge.family) ? ACTIVITY_BADGE_DEFINITIONS.find((d) => d.family === badge.family) : undefined;

  useEffect(() => {
    if (!badge) return;
    setShared(false);
    scale.setValue(0.4);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badge?.family, badge?.key, badge?.tier]);

  if (!badge || (badge.family === "genre" ? !genreDef : badge.family === "volume" ? !volumeDef : isStreak ? false : !activityDef)) return null;

  let image: number;
  let tierWord: string;
  let categoryLabel: string | null = null;
  if (badge.family === "genre") {
    image = badge.tier === "master" ? genreDef!.master : genreDef!.devotee;
    tierWord = badge.tier === "master" ? t("Master") : t("Devotee");
    categoryLabel = genreDef!.label;
  } else if (badge.family === "volume") {
    image = volumeDef!.tiers[badge.tier as VolumeTier];
    tierWord = t(VOLUME_TIER_LABEL_KEY[badge.tier as VolumeTier]);
    categoryLabel = t(volumeDef!.label);
  } else if (isStreak) {
    const tier = badge.tier as StreakTier;
    image = STREAK_BADGE_DEFINITION.tierImages[tier];
    tierWord = t("{{days}}-Day Streak", { days: badge.threshold });
    // No categoryLabel — "7-Day Streak" is already a complete phrase (see
    // buildLadderTile's own titleFor override in ProfileBadgesTab.tsx for
    // the identical reasoning); the body text below branches on this.
  } else {
    const tier = badge.tier as ActivityTier;
    image = activityDef!.tierImages[tier]!;
    tierWord = t(activityDef!.tierLabelKeys[tier]!);
    categoryLabel = t(activityDef!.label);
  }

  const dismiss = () => dismissCurrent();
  // router.navigate, not push — same reasoning PodiumNewsModal.tsx's own
  // goToPodium already documents: reuses Profile's already-mounted screen
  // instance instead of stacking a fresh, refetching-from-scratch one on
  // top of it.
  const goToBadge = () => {
    dismissCurrent();
    router.navigate("/profile?tab=badges" as any);
  };

  const handleShare = async () => {
    if (sharing || shared) return;
    setSharing(true);
    try {
      const share = await createShare({ type: "badge", badgeFamily: badge.family, badgeKey: badge.key, badgeTier: badge.tier });
      announceNewShare(share);
      setShared(true);
      showToast(t("Shared to Media"));
    } catch (err: any) {
      // 409 = already shared (e.g. shared from the Badges tab moments
      // earlier) — the end state the user wants is identical either way,
      // so this still flips the button to "Shared" instead of erroring.
      if (err?.response?.status === 409) {
        setShared(true);
      } else {
        showToast(t("Something went wrong. Please try again."));
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <Pressable style={styles.dismissZone} onPress={dismiss} />
        <Pressable style={styles.card} onPress={goToBadge}>
          <Pressable style={styles.closeButton} onPress={dismiss} hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.placeholder} />
          </Pressable>

          <Animated.View style={[styles.imageWrap, { opacity, transform: [{ scale }] }]}>
            <Image source={image} style={styles.image} resizeMode="contain" />
          </Animated.View>

          <Text style={styles.title}>{t("Congratulations!")}</Text>
          <Text style={styles.body}>
            {categoryLabel
              ? t("You unlocked the {{genre}} {{tier}} badge!", { genre: categoryLabel, tier: tierWord })
              : t("You unlocked the {{tier}} badge!", { tier: tierWord })}
          </Text>

          {/* Its own nested Pressable — "inner tap wins" over the card's
              own onPress (goToBadge), same pattern this app uses
              everywhere a smaller action sits inside a bigger tappable
              surface (e.g. ShareCard.tsx's poster-inside-box). Disabled
              and relabeled once shared — was posting a new Share on every
              repeated tap before. */}
          <Pressable style={[styles.shareButton, shared && styles.shareButtonDone]} onPress={handleShare} disabled={sharing || shared}>
            {sharing ? (
              <ActivityIndicator color={colors.primaryContent} size="small" />
            ) : (
              <Text style={[styles.shareButtonText, shared && styles.shareButtonTextDone]}>
                {shared ? t("Shared") : t("Share to Media")}
              </Text>
            )}
          </Pressable>

          <Text style={styles.tapHint}>{t("Tap to see your badge")}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 28 },
    dismissZone: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    card: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: colors.base200,
      borderRadius: 20,
      paddingVertical: 28,
      paddingHorizontal: 24,
      alignItems: "center",
    },
    closeButton: { position: "absolute", top: 12, right: 12, padding: 4 },
    imageWrap: { width: 88, height: 88, alignItems: "center", justifyContent: "center", marginBottom: 12 },
    image: { width: 84, height: 84 },
    title: { fontFamily: fonts.bold, fontSize: 18, color: colors.baseContent, textAlign: "center", marginBottom: 8 },
    body: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.baseContent, textAlign: "center" },
    tapHint: { fontSize: 12, color: colors.placeholder, marginTop: 12 },
    // Smaller and self-sizing now (was a full-width stretch bar) — direct
    // ask, this button reads as a secondary action next to the card's own
    // bigger tap-to-navigate surface, not a second primary CTA.
    shareButton: {
      marginTop: 16,
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 16,
      alignSelf: "center",
    },
    shareButtonDone: { backgroundColor: colors.base300 },
    shareButtonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 12.5 },
    shareButtonTextDone: { color: colors.placeholder },
  });
}
