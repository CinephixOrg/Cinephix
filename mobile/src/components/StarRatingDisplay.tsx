import { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Path, Defs, ClipPath, Rect } from "react-native-svg";
import { useTheme } from "../context/ThemeContext";

interface Props {
  value: number | null | undefined; // 1-10
  size?: number;
}

// Same 10-point star path as StarRatingInput.tsx (kept as its own copy
// rather than a shared import — this app's own convention for a small,
// unlikely-to-diverge shape like this one) so the half-star glyph below
// reads as the same star, just a display-only, non-interactive version.
const STAR_PATH =
  "M12 1 L14.64 8.36 L22.46 8.6 L16.28 13.39 L18.47 20.9 L12 16.5 L5.53 20.9 L7.72 13.39 L1.54 8.6 L9.36 8.36 Z";

function buildStyles() {
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 1 },
  });
}

// Read-only counterpart to StarRatingInput.tsx, non-interactive and sized
// for compact inline use (cards, feed rows). Shows only the earned stars —
// no trailing gray/empty ones — so e.g. a 2.5 rating renders as "★★ [half]"
// and stops. Every star (full AND half) renders as the same SVG path at
// the same size — direct bug fix: full stars used to render as a plain "★"
// text glyph (cheaper, but a font glyph's own ink isn't reliably centered
// in its layout box the way an SVG viewBox is), which visibly sat at a
// different vertical position than the half-star's own SVG right next to
// it. Using one rendering technique for both is what actually guarantees
// identical alignment/size, not a font-metrics tweak.
export default function StarRatingDisplay({ value, size = 14 }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(), []);

  if (value == null) return null;

  const scaled = value / 2; // 1-10 -> 0.5-5
  const full = Math.floor(scaled);
  const hasHalf = scaled - full >= 0.5;

  return (
    <View style={styles.row}>
      {Array.from({ length: full }, (_, i) => (
        <Svg key={`full-${i}`} width={size} height={size} viewBox="0 0 24 24">
          <Path d={STAR_PATH} fill={colors.primary} />
        </Svg>
      ))}
      {hasHalf && (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d={STAR_PATH} fill={colors.border} />
          <Defs>
            <ClipPath id="starDisplayHalfClip">
              <Rect x={0} y={0} width={12} height={24} />
            </ClipPath>
          </Defs>
          <Path d={STAR_PATH} fill={colors.primary} clipPath="url(#starDisplayHalfClip)" />
        </Svg>
      )}
    </View>
  );
}
