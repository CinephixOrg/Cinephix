import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop, G } from "react-native-svg";
import UserAvatar from "../UserAvatar";
import type { SwipeCandidate } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

// Fixed, theme-independent — gold/silver/bronze have a real-world color
// identity that shouldn't shift with a dark/light theme swap. Ranks 3+ (4th,
// 5th place) fall back to the existing colors.placeholder neutral gray, the
// "same, unshowy color" for the rest of the field.
const MEDAL_COLORS = ["#FFC94A", "#C7CBD1", "#CD7F32"];
// Lighter highlight per medal — the inner stop of each badge's radial
// gradient, giving a glossy-sphere "shine" instead of a flat fill. Hand-
// picked (not programmatically lightened) so each keeps its own warmth —
// e.g. gold's highlight stays warm cream, not just "MEDAL_COLORS + white".
// Ranks 3/4 stay flat (no entry here) — deliberately unshowy, not medals.
const MEDAL_HIGHLIGHT_COLORS = ["#FFF3C4", "#F2F3F5", "#F0C08A"];

interface Props {
  candidate: SwipeCandidate;
  diameter: number;
  rank?: number;
}

// The gray progress-ring + avatar + percentage-text visual, extracted out of
// MatchCloudBubble so the enlarged/inspected profile can render it at its
// own real target size directly (MatchResultsCloud's detail view) instead of
// relying on a CSS transform to scale up the tiny cloud bubble's version —
// simpler and avoids any transform/compositing risk for the one place this
// needs to render large and reliably.
export default function MatchAvatarRing({ candidate, diameter, rank = 0 }: Props) {
  const { colors } = useTheme();

  const STROKE = Math.max(3, diameter * 0.045);
  const ringRadius = diameter / 2 - STROKE / 2;
  const avatarSize = diameter - STROKE * 2 - 6;
  const circumference = 2 * Math.PI * ringRadius;
  const pct = Math.max(0, Math.min(100, candidate.matchPercentage));
  const filled = circumference * (pct / 100);
  const medalColor = MEDAL_COLORS[rank] ?? colors.placeholder;
  const medalHighlight = MEDAL_HIGHLIGHT_COLORS[rank];
  const badgeSize = Math.max(18, Math.min(30, diameter * 0.26));

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { alignItems: "center" },
        avatarWrap: { position: "absolute" },
        pctText: { fontFamily: fonts.bold, fontSize: 12, color: colors.placeholder, marginTop: 4 },
        // Solid-filled (gradient for gold/silver/bronze, flat for the rest),
        // not this feature's usual border-tinted badge — medals read as
        // solid color-coded status in real life. A plain rank number (not an
        // icon shape) sidesteps the "didn't like the icon shapes" feedback
        // from an earlier round of this same card.
        medalBadge: { position: "absolute", alignItems: "center", justifyContent: "center" },
        medalBadgeText: { position: "absolute", fontFamily: fonts.bold, color: "#2b2b2b" },
      }),
    [colors]
  );

  return (
    <View style={styles.wrap}>
      <View style={{ width: diameter, height: diameter }}>
        <Svg width={diameter} height={diameter}>
          <G rotation="-90" origin={`${diameter / 2}, ${diameter / 2}`}>
            <Circle cx={diameter / 2} cy={diameter / 2} r={ringRadius} stroke={colors.border} strokeWidth={STROKE} fill="none" />
            <Circle
              cx={diameter / 2}
              cy={diameter / 2}
              r={ringRadius}
              stroke={medalColor}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${filled} ${circumference - filled}`}
            />
          </G>
        </Svg>
        <View style={[styles.avatarWrap, { left: STROKE + 3, top: STROKE + 3 }]} pointerEvents="none">
          <UserAvatar
            userId={candidate.user._id}
            username={candidate.user.username}
            profilePicUrl={candidate.user.profile_pic_url}
            size={avatarSize}
            disabled
          />
        </View>
        <View
          style={[
            styles.medalBadge,
            {
              width: badgeSize,
              height: badgeSize,
              // Tucked inward now (positive inset), still top-right, rather
              // than hanging outside the ring's own edge.
              top: badgeSize * 0.12,
              right: badgeSize * 0.12,
            },
          ]}
          pointerEvents="none"
        >
          <Svg width={badgeSize} height={badgeSize}>
            <Defs>
              {medalHighlight && (
                <RadialGradient id="medalShine" cx="35%" cy="30%" r="70%">
                  <Stop offset="0" stopColor={medalHighlight} />
                  <Stop offset="1" stopColor={medalColor} />
                </RadialGradient>
              )}
            </Defs>
            <Circle
              cx={badgeSize / 2}
              cy={badgeSize / 2}
              r={badgeSize / 2 - 1}
              fill={medalHighlight ? "url(#medalShine)" : medalColor}
              stroke={colors.base100}
              strokeWidth={1.5}
            />
          </Svg>
          <Text style={[styles.medalBadgeText, { fontSize: badgeSize * 0.5 }]}>{rank + 1}</Text>
        </View>
      </View>
      <Text style={styles.pctText}>{Math.round(pct)}%</Text>
    </View>
  );
}
