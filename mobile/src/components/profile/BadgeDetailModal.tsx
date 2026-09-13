import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, View, Text, Image, Pressable, Animated, ScrollView, StyleSheet } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import type { ColorPalette } from "../../theme/palettes";
import { fonts } from "../../theme/typography";

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
}

interface Props {
  visible: boolean;
  onClose: () => void;
  badge: BadgeDetailData | null;
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
export default function BadgeDetailModal({ visible, onClose, badge }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [selectedIndex, setSelectedIndex] = useState(0);

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

  if (!badge) return null;

  const activeTier = badge.tiers?.[selectedIndex];
  const displayImage = activeTier?.image ?? badge.image;
  const displayTitle = activeTier?.title ?? badge.title;
  const displayDescription = activeTier?.description ?? badge.description;
  const displayEarned = activeTier?.earned ?? badge.earned;

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
          </View>
        ) : (
          <View style={styles.card} pointerEvents="box-none">
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
        )}
      </View>
    </Modal>
  );
}

function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 24 },
    closeZone: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
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
  });
}
