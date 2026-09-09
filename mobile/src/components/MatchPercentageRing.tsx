import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

interface Props {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  // Override the default theme-derived colors. Two reasons callers do this:
  // the ring sits on a colored surface where the theme's own
  // border/primary/baseContent wouldn't read, or the fill itself is carrying
  // meaning — SyncScoreCard tints it red→green by score.
  trackColor?: string;
  fillColor?: string;
  textColor?: string;
}

// Mirrors web's DaisyUI `radial-progress` CSS meter on MatchCard — a single-
// value progress ring, unlike CineGraphDonut's multi-slice breakdown, so no
// press interaction or legend here.
export default function MatchPercentageRing({
  percentage,
  size = 80,
  strokeWidth = 8,
  trackColor,
  fillColor,
  textColor,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  labelContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  // The number and its unit are two pieces, not one string: at a fixed
  // size the "%" sat at the same weight as the digits and crowded them
  // inside a small ring. It's now noticeably smaller, softer and baseline-
  // aligned, so the number reads as the value and the % as its unit.
  labelRow: { flexDirection: "row", alignItems: "baseline" },
  // Scaled off the ring rather than pinned to one size, so this stays
  // correctly proportioned wherever the ring is used.
  value: {
    fontFamily: fonts.bold,
    fontSize: size * 0.32,
    color: textColor ?? colors.baseContent,
    // Tightens the gap between digits — bold numerals set at small sizes
    // read as slightly loose otherwise.
    letterSpacing: -0.4,
    // Android reserves extra vertical space inside Text by default, which
    // pushes the label off the ring's true center.
    includeFontPadding: false,
  },
  percent: {
    fontFamily: fonts.bold,
    fontSize: size * 0.19,
    color: textColor ?? colors.baseContent,
    opacity: 0.55,
    marginLeft: 1,
    includeFontPadding: false,
  },
}), [colors, textColor, size]);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percentage));
  const filled = (clamped / 100) * circumference;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={trackColor ?? colors.border}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={fillColor ?? colors.primary}
            strokeWidth={strokeWidth}
            strokeDasharray={`${filled} ${circumference - filled}`}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      </Svg>
      <View style={styles.labelContainer} pointerEvents="none">
        <View style={styles.labelRow}>
          <Text style={styles.value}>{clamped}</Text>
          <Text style={styles.percent}>%</Text>
        </View>
      </View>
    </View>
  );
}

