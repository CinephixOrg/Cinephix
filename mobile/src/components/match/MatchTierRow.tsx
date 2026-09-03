import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, View, Text, StyleSheet } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import UserAvatar from "../UserAvatar";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import type { ColorPalette } from "../../theme/palettes";
import type { SwipeCandidate } from "../../types";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AVATAR_SIZE = 76;
// Deliberately smaller than the avatars — a small connecting badge between
// them, not a third equally-weighted element in the row.
const BADGE_SIZE = 48;
// Matches MatchAvatarRing's own fill-in pacing, so this reads as the same
// "family" of ring-fill motion already established for match percentages
// elsewhere in this feature.
const FILL_MS = 700;

// Score-based, not derived from the LLM's free-text match_title — that title
// comes back in whatever one of 12 languages was requested, so keyword-
// matching it into a color would be fragile. matchPercentage is a reliable,
// language-independent 0-100 number already on every SwipeCandidate.
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

function tierColorFor(score: number, colors: ColorPalette) {
  const tier = TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1];
  return colors[tier.colorKey];
}

interface Props {
  candidate: SwipeCandidate;
}

// Own avatar — small match-percentage ring — candidate's avatar, sitting
// between the match title above and the analysis paragraph below on the
// Match Summary card. The ring reuses MatchAvatarRing's own SVG technique
// (background circle + animated strokeDasharray/strokeDashoffset foreground
// circle), just smaller, centered on the percentage text instead of
// wrapping an avatar, and tinted per score tier instead of a fixed neutral
// stroke. No extra particle/burst motion — just the same ring-fill-in this
// feature already uses everywhere it shows a match percentage.
export default function MatchTierRow({ candidate }: Props) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const tierColor = tierColorFor(candidate.matchPercentage, colors);

  const STROKE = Math.max(2.5, BADGE_SIZE * 0.1);
  const ringRadius = BADGE_SIZE / 2 - STROKE / 2;
  const circumference = 2 * Math.PI * ringRadius;
  const pct = Math.max(0, Math.min(100, candidate.matchPercentage));
  const filled = circumference * (pct / 100);

  const fillAnim = useRef(new Animated.Value(filled)).current;
  useEffect(() => {
    fillAnim.setValue(filled);
    Animated.timing(fillAnim, {
      toValue: 0,
      duration: FILL_MS,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
    // Keyed on the candidate's own id (not just matchPercentage) so the
    // reveal reliably replays on every switch, including the edge case of
    // two different candidates sharing the same percentage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.user._id, candidate.matchPercentage, circumference]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        // marginTop clears MatchTitleBadge, which floats over this card's
        // own top-left corner (MatchAnalysisPanel.tsx) — without it, the
        // badge's own text overlapped this row's leading avatar.
        row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 26, marginBottom: 12 },
        badgeWrap: { width: BADGE_SIZE, height: BADGE_SIZE, alignItems: "center", justifyContent: "center" },
        pctText: { position: "absolute", fontFamily: fonts.bold, fontSize: 12 },
      }),
    []
  );

  if (!user) return null;

  return (
    <View style={styles.row}>
      <UserAvatar userId={user._id} username={user.username} profilePicUrl={user.profile_pic_url} size={AVATAR_SIZE} />
      <View style={styles.badgeWrap}>
        <Svg width={BADGE_SIZE} height={BADGE_SIZE}>
          <G rotation="-90" origin={`${BADGE_SIZE / 2}, ${BADGE_SIZE / 2}`}>
            <Circle cx={BADGE_SIZE / 2} cy={BADGE_SIZE / 2} r={ringRadius} stroke={colors.border} strokeWidth={STROKE} fill="none" />
            <AnimatedCircle
              cx={BADGE_SIZE / 2}
              cy={BADGE_SIZE / 2}
              r={ringRadius}
              stroke={tierColor}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${filled} ${circumference - filled}`}
              strokeDashoffset={fillAnim}
            />
          </G>
        </Svg>
        <Text style={[styles.pctText, { color: tierColor }]}>{Math.round(pct)}%</Text>
      </View>
      <UserAvatar userId={candidate.user._id} username={candidate.user.username} profilePicUrl={candidate.user.profile_pic_url} size={AVATAR_SIZE} />
    </View>
  );
}
