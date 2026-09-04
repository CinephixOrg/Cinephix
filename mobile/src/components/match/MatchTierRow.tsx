import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import UserAvatar from "../UserAvatar";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import type { ColorPalette } from "../../theme/palettes";
import type { SyncCandidate } from "../../types";

const AVATAR_SIZE = 76;
// The ring badge used to sit here — replaced by the bar below, but this
// width is kept as an invisible spacer so the two avatars stay exactly
// where they were (same row width, same centering), per direct ask not to
// disturb their positions while swapping out what used to sit between them.
const BADGE_SIZE = 48;
const GAP = 14;
const ROW_WIDTH = AVATAR_SIZE * 2 + GAP * 2 + BADGE_SIZE;
// The full avatar-center-to-avatar-center span — avatar 1's center sits
// AVATAR_SIZE/2 into the row, avatar 2's the same distance from the row's
// far edge, so the distance between them is the row width minus one
// avatar's worth (half from each side). The bar itself is shorter than
// this (BAR_WIDTH below) but stays centered within it, so it still reads
// as "between the two profiles" without stretching corner to corner.
const AVATAR_SPAN = ROW_WIDTH - AVATAR_SIZE;
const BAR_WIDTH = 100;
const BAR_LEFT = AVATAR_SIZE / 2 + (AVATAR_SPAN - BAR_WIDTH) / 2;
const BAR_HEIGHT = 8;
const MARKER_SIZE = 26;
// Snappier than the old ring's own 700ms — a shorter bar reading that
// slowly looked sluggish once actually seen.
const FILL_MS = 380;

// Score-based, not derived from the LLM's free-text match_title — that title
// comes back in whatever one of 12 languages was requested, so keyword-
// matching it into a color would be fragile. matchPercentage is a reliable,
// language-independent 0-100 number already on every SyncCandidate.
// Deliberately not success/warning/error — those read as status/alert
// semantics elsewhere in the app (a red "error" ring for an *exceptional*
// match would misread as something being wrong) — these are neutral
// brand-palette tokens instead.
const TIERS: { min: number; colorKey: "accent" | "primary" | "info" | "secondary" | "neutral" }[] = [
  { min: 90, colorKey: "accent" },
  { min: 75, colorKey: "primary" },
  { min: 60, colorKey: "info" },
  { min: 40, colorKey: "secondary" },
  { min: 0, colorKey: "neutral" },
];

export function tierColorFor(score: number, colors: ColorPalette) {
  const tier = TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1];
  return colors[tier.colorKey];
}

interface Props {
  candidate: SyncCandidate;
}

// Own avatar — candidate's avatar, with a horizontal match-percentage bar
// underneath spanning exactly from one avatar's center to the other's — the
// bar fills left-to-right by percentage, tiered by score the same way the
// old ring badge was, with the app's own Sync-tab glyph (sparkles) riding
// the leading edge of the fill as a marker, plus the percentage itself
// floating just above it. Replaces the previous small ring-badge-between-
// avatars design (a bar reads as more of a "meter" than a circular badge
// crowded between two other circles).
export default function MatchTierRow({ candidate }: Props) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const tierColor = tierColorFor(candidate.matchPercentage, colors);

  const pct = Math.max(0, Math.min(100, candidate.matchPercentage));
  const fillWidth = BAR_WIDTH * (pct / 100);

  // Driven as a plain 0->1 progress value on the *native* driver — the fill
  // itself is a fixed-width View scaled in via transform (scaleX, anchored
  // left via transformOrigin), not an animated `width`, since `width` is a
  // layout property the native driver can't touch — an earlier version
  // animated width directly, JS-thread work that (combined with another
  // JS-driven animation on this same card, since removed) was a real source
  // of visible stutter. Marker/percentage translateX below are transform
  // properties too, so the whole thing rides entirely on the native driver.
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: FILL_MS,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
    // Keyed on the candidate's own id (not just matchPercentage) so the
    // reveal reliably replays on every switch, including the edge case of
    // two different candidates sharing the same percentage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.user._id, candidate.matchPercentage]);

  const markerTranslate = progress.interpolate({ inputRange: [0, 1], outputRange: [0, fillWidth] });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { alignItems: "center", marginTop: 26, marginBottom: 20 },
        // marginTop clears MatchTitleBadge, which floats over this card's
        // own top-left corner (MatchAnalysisPanel.tsx) — without it, the
        // badge's own text overlapped this row's leading avatar.
        row: { width: ROW_WIDTH, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: GAP },
        badgeSpacer: { width: BADGE_SIZE, height: BADGE_SIZE },
        barWrap: { width: ROW_WIDTH, marginTop: 22 },
        barTrack: {
          marginLeft: BAR_LEFT,
          width: BAR_WIDTH,
          height: BAR_HEIGHT,
          borderRadius: BAR_HEIGHT / 2,
          backgroundColor: colors.border,
          overflow: "hidden",
        },
        barFill: { height: BAR_HEIGHT, borderRadius: BAR_HEIGHT / 2 },
        pctText: { position: "absolute", top: -22, left: BAR_LEFT - 16, width: 32, fontFamily: fonts.bold, fontSize: 12.5, textAlign: "center" },
        marker: {
          position: "absolute",
          top: -(MARKER_SIZE - BAR_HEIGHT) / 2,
          left: BAR_LEFT - MARKER_SIZE / 2,
          width: MARKER_SIZE,
          height: MARKER_SIZE,
          borderRadius: MARKER_SIZE / 2,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 2,
          borderColor: colors.base100,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.2,
          shadowRadius: 2,
          elevation: 3,
        },
      }),
    [colors]
  );

  if (!user) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <UserAvatar userId={user._id} username={user.username} profilePicUrl={user.profile_pic_url} size={AVATAR_SIZE} />
        <View style={styles.badgeSpacer} />
        <UserAvatar userId={candidate.user._id} username={candidate.user.username} profilePicUrl={candidate.user.profile_pic_url} size={AVATAR_SIZE} />
      </View>

      <View style={styles.barWrap}>
        <View style={styles.barTrack}>
          <Animated.View
            style={[
              styles.barFill,
              { width: fillWidth, backgroundColor: tierColor, transform: [{ scaleX: progress }], transformOrigin: "left" },
            ]}
          />
        </View>

        <Animated.Text style={[styles.pctText, { color: tierColor, transform: [{ translateX: markerTranslate }] }]}>{Math.round(pct)}%</Animated.Text>

        <Animated.View style={[styles.marker, { backgroundColor: tierColor, transform: [{ translateX: markerTranslate }] }]}>
          <Ionicons name="sparkles" size={13} color={colors.base100} />
        </Animated.View>
      </View>
    </View>
  );
}
