import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Image, Animated, ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import Pressable from "../common/TapSafePressable";
// A Modal needs its own gesture root for the app's Pressables to work inside it.
import Modal from "../common/GestureModal";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { useComposeTutorial } from "../../context/ComposeTutorialContext";
import TutorialSpotlight from "../tutorial/TutorialSpotlight";
import TutorialInfoBox from "../tutorial/TutorialInfoBox";
import type { ColorPalette } from "../../theme/palettes";
import { fonts } from "../../theme/typography";

// Identifies exactly which (family, key, tier) a Share of type "badge"
// would be created for, mirroring createShare's own badgeFamily/badgeKey/
// badgeTier body — this is the one piece of family-specific knowledge this
// otherwise-generic component needs, kept as an opaque identifier rather
// than exposing what family/key/tier actually mean.
export interface BadgeShareTarget {
  family: string;
  key: string;
  tier: string;
}

// One selectable rung in a volume badge's own tier strip (see `tiers`
// below) — `tier` is kept a plain string rather than importing VolumeTier
// here, same "this component doesn't know about badge families" boundary
// BadgeDetailData's own doc comment already establishes.
export interface BadgeTierOption {
  tier: string;
  image: number;
  title: string;
  description: string;
  earned: boolean;
  // Only real, already-earned rungs get one — a user can tap back onto a
  // past rung in the strip and share THAT specific achievement, same idea
  // as genre's own devotee/master pair below.
  shareTarget?: BadgeShareTarget;
}

// Generic across badge families on purpose — genre (2-tier) and volume
// (5-tier) tiles both open this exact same visual shell, they just differ
// in HOW their title/description get built (genre: "{{genre}} {{tier}}" +
// a rated-count sentence; volume: "{{tier}} {{label}}" + a ladder-progress
// sentence). Each caller (ProfileBadgesTab.tsx's two tile types) builds
// its own strings and hands over the finished result, rather than this
// component knowing about GENRE_BADGE_DEFINITIONS/volumeBadgeDefinitions
// or carrying two parallel sets of text-building props.
export interface BadgeDetailData {
  image: number;
  title: string;
  description: string;
  earned: boolean;
  // Volume badges only, direct ask: instead of showing just the single
  // currently-reached tier, the popup shows every rung of the ladder in
  // one horizontal row (locked ones tinted gray, same as the grid tile)
  // so a previously-earned lower tier stays visible/reachable, not just
  // the newest one. Omitted entirely for genre badges, which keep the
  // original single-badge layout below (they already get 2 separate
  // always-visible tiles in the grid, so a strip inside the popup too
  // would be redundant).
  tiers?: BadgeTierOption[];
  // Which entry in `tiers` the popup opens already selected on — the tier
  // that was actually tapped in the grid (ProfileBadgesTab.tsx) or the
  // one that was just earned (BadgeEarnedModal.tsx), not always the last
  // (highest) one.
  initialTierIndex?: number;
  // Non-ladder (one-off) badges only — `tiers` above carries its own
  // per-rung shareTarget instead, since those are the ones that can
  // change as the user taps through the strip.
  shareTarget?: BadgeShareTarget;
}

// "family:key:tier" — the exact same join ProfileBadgesTab.tsx uses to key
// its own already-shared Set, kept here as the one shared piece of format
// knowledge between the two.
export const badgeShareTargetKey = (t: BadgeShareTarget) => `${t.family}:${t.key}:${t.tier}`;

interface Props {
  visible: boolean;
  onClose: () => void;
  badge: BadgeDetailData | null;
  // Every "family:key:tier" the caller has ever shared — the modal itself
  // resolves whether the CURRENTLY displayed tier (tiers?.[selectedIndex]'s
  // own shareTarget, or badge.shareTarget for a one-off badge) is a member,
  // so this stays correct as the user taps through the strip without the
  // parent needing to know which rung is selected.
  sharedKeys?: Set<string>;
  // Which specific key currently has a share request in flight — compared
  // against the displayed tier the same way `sharedKeys` is, so only the
  // one row actually being shared shows a spinner.
  sharingKey?: string | null;
  onShare?: (target: BadgeShareTarget) => void;
}

// Same tint technique as the grid tile (ProfileBadgesTab.tsx) — a locked
// badge stays a flat gray silhouette here too, not full color. Tapping a
// locked badge is how you find out WHAT it's for (the description below),
// not a shortcut to seeing its real artwork before actually earning it —
// revealing full color unconditionally on tap would undercut the whole
// "unlock" moment this deck is built around.
const LOCKED_OPACITY = 0.55;

// Direct ask: a real animation on the badge itself when this opens, not
// just the Modal's own fade. A spring scale-in on the image — no Lottie:
// IconScout's animated exports are Lottie JSON files, a second asset per
// badge to source and a new native dependency (lottie-react-native) to
// pull in and configure, for a one-time reveal on a modal that's already
// getting its own entrance motion here for free from RN's Animated API.
// Worth reconsidering if a specific badge ever needs a genuinely bespoke
// animation (e.g. a shine sweep, particles) that a spring scale can't
// deliver — not the case for a first pass across these badges.
export default function BadgeDetailModal({ visible, onClose, badge, sharedKeys, sharingKey, onShare }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [selectedIndex, setSelectedIndex] = useState(0);
  // "Badge" compose-tutorial walkthrough (Shares' "+" menu) — unlike
  // Recommend/Review/Analyze, sharing a badge has no Media-vs-someone
  // picker to skip (badges only ever post to Media), so this step just
  // highlights the Share button and ends the tutorial the moment it's
  // tapped, no behavior override needed. There's no single correct TILE to
  // point at on the Badges tab before this opens (which badges are even
  // earned varies per viewer), so that earlier step is info-only.
  const { tutorial: composeTutorial, setBadgeStep, endTutorial: endComposeTutorial } = useComposeTutorial();

  // Resets which tier is selected every time a NEW badge popup opens
  // (a different tile tapped, or a fresh "you earned a badge!" moment) —
  // deliberately not keyed on `selectedIndex` itself, so a tap inside the
  // strip below doesn't get fought back to the initial tier on every
  // re-render.
  useEffect(() => {
    if (!visible || !badge) return;
    setSelectedIndex(badge.initialTierIndex ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, badge?.tiers, badge?.initialTierIndex]);

  // The reveal animation itself — re-triggers both when the popup first
  // opens AND whenever the strip selection changes, so tapping through
  // the ladder still feels alive rather than just swapping a static image.
  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.4);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, selectedIndex]);

  useEffect(() => {
    if (visible && badge && composeTutorial?.id === "badge") setBadgeStep("tapShare");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, badge]);
  const showBadgeShareTutorial = composeTutorial?.id === "badge" && composeTutorial.step === "tapShare";

  if (!badge) return null;

  const activeTier = badge.tiers?.[selectedIndex];
  const displayImage = activeTier?.image ?? badge.image;
  const displayTitle = activeTier?.title ?? badge.title;
  const displayDescription = activeTier?.description ?? badge.description;
  const displayEarned = activeTier?.earned ?? badge.earned;
  const displayShareTarget = activeTier?.shareTarget ?? badge.shareTarget;
  const shareKey = displayShareTarget ? badgeShareTargetKey(displayShareTarget) : null;
  const isShared = !!shareKey && !!sharedKeys?.has(shareKey);
  const isSharing = !!shareKey && sharingKey === shareKey;

  // Bottom-center, direct ask — only ever rendered for an earned tier with
  // a real shareTarget (locked/future rungs and the 3 badge families with
  // no share support at all just don't get a button, no disabled ghost).
  const shareButton =
    displayEarned && displayShareTarget && onShare ? (
      <TutorialSpotlight active={showBadgeShareTutorial} borderRadius={10}>
        <Pressable
          style={[styles.shareButton, isShared && styles.shareButtonDone]}
          onPress={() => {
            onShare(displayShareTarget);
            if (showBadgeShareTutorial) endComposeTutorial();
          }}
          disabled={isSharing || isShared}
        >
          {isSharing ? (
            <ActivityIndicator color={colors.primaryContent} size="small" />
          ) : (
            <Text style={[styles.shareButtonText, isShared && styles.shareButtonTextDone]}>
              {isShared ? t("Shared") : t("Share to Media")}
            </Text>
          )}
        </Pressable>
      </TutorialSpotlight>
    ) : null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.closeZone} onPress={onClose} />
        {badge.tiers && badge.tiers.length > 0 ? (
          <View style={styles.stackedCard} pointerEvents="box-none">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stripRow}>
              {badge.tiers.map((t, i) => (
                <Pressable key={t.tier} style={[styles.stripSlot, i === selectedIndex && styles.stripSlotSelected]} onPress={() => setSelectedIndex(i)}>
                  <Image source={t.image} style={[styles.stripImage, !t.earned && { tintColor: colors.placeholder, opacity: LOCKED_OPACITY }]} resizeMode="contain" />
                </Pressable>
              ))}
            </ScrollView>
            <Animated.View style={[styles.stackedImageWrap, { opacity, transform: [{ scale }] }]}>
              <Image
                source={displayImage}
                style={[styles.stackedImage, !displayEarned && { tintColor: colors.placeholder, opacity: LOCKED_OPACITY }]}
                resizeMode="contain"
              />
            </Animated.View>
            <Text style={[styles.title, styles.centeredText]}>{displayTitle}</Text>
            <Text style={[styles.description, styles.centeredText]}>{displayDescription}</Text>
            {shareButton}
            {showBadgeShareTutorial && (
              <TutorialInfoBox text={t("Tap here to share this badge.")} onDismiss={endComposeTutorial} />
            )}
          </View>
        ) : (
          <View style={styles.cardOuter} pointerEvents="box-none">
            <View style={styles.card}>
              <Animated.View style={[styles.imageWrap, { opacity, transform: [{ scale }] }]}>
                <Image
                  source={displayImage}
                  style={[styles.image, !displayEarned && { tintColor: colors.placeholder, opacity: LOCKED_OPACITY }]}
                  resizeMode="contain"
                />
              </Animated.View>
              <View style={styles.textCol}>
                <Text style={styles.title}>{displayTitle}</Text>
                <Text style={styles.description}>{displayDescription}</Text>
              </View>
            </View>
            {shareButton}
            {showBadgeShareTutorial && (
              <TutorialInfoBox text={t("Tap here to share this badge.")} onDismiss={endComposeTutorial} />
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 24 },
    closeZone: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    // Wraps `card` (the actual visible box) + the Share button below it —
    // a separate layer so the button can sit bottom-center, outside the
    // card's own row layout, without the row itself needing to become a
    // column just to fit one more child under image+text.
    cardOuter: { alignItems: "center" },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      backgroundColor: colors.base200,
      borderRadius: 16,
      padding: 18,
    },
    imageWrap: { width: 84, height: 84, alignItems: "center", justifyContent: "center" },
    image: { width: 80, height: 80 },
    textCol: { flex: 1, gap: 6 },
    title: { fontFamily: fonts.bold, fontSize: 16, color: colors.baseContent },
    description: { fontSize: 13, color: colors.placeholder, lineHeight: 19 },
    // Volume-badge (tiered) layout — a vertical stack instead of the
    // simple genre card's left-image/right-text row, since this one has a
    // whole extra row (the tier strip) sitting above the badge itself.
    stackedCard: {
      backgroundColor: colors.base200,
      borderRadius: 16,
      padding: 18,
      alignItems: "center",
    },
    stripRow: { gap: 10, paddingBottom: 4 },
    stripSlot: {
      width: 44,
      height: 44,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.base300,
      borderWidth: 2,
      borderColor: "transparent",
    },
    stripSlotSelected: { borderColor: colors.primary },
    stripImage: { width: 34, height: 34 },
    stackedImageWrap: { width: 84, height: 84, alignItems: "center", justifyContent: "center", marginTop: 14 },
    stackedImage: { width: 80, height: 80 },
    centeredText: { textAlign: "center", marginTop: 4 },
    // Same shape/colors as BadgeEarnedModal.tsx's own share button, for a
    // consistent Share/Shared visual language wherever a badge can be
    // shared from.
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
