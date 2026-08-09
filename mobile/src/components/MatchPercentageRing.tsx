import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

interface Props {
  percentage: number;
  size?: number;
  strokeWidth?: number;
}

// Mirrors web's DaisyUI `radial-progress` CSS meter on MatchCard — a single-
// value progress ring, unlike CineGraphDonut's multi-slice breakdown, so no
// press interaction or legend here.
export default function MatchPercentageRing({ percentage, size = 80, strokeWidth = 8 }: Props) {
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
            stroke={colors.border}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.primary}
            strokeWidth={strokeWidth}
            strokeDasharray={`${filled} ${circumference - filled}`}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      </Svg>
      <View style={styles.labelContainer} pointerEvents="none">
        <Text style={styles.label}>{clamped}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent },
});
