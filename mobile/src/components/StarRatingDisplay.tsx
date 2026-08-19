import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../context/ThemeContext";
import type { ColorPalette } from "../theme/palettes";
import { fonts } from "../theme/typography";

interface Props {
  value: number | null | undefined; // 1-10
  size?: number;
}

function buildStyles(colors: ColorPalette, size: number) {
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 1 },
    // star and fraction share the same lineHeight so their boxes are the
    // same height — otherwise alignItems:"center" centers two differently
    // sized boxes against each other, which isn't the same as centering the
    // glyphs' actual ink, and the "1/2" ends up visibly higher than the
    // star next to it. textAlignVertical is the RN prop built for exactly
    // this (Android-only, harmless no-op on iOS).
    star: { fontSize: size, lineHeight: size, textAlignVertical: "center" },
    starFilled: { color: colors.primary },
    fraction: {
      fontSize: size * 0.6,
      lineHeight: size,
      color: colors.primary,
      fontFamily: fonts.medium,
      marginHorizontal: 1,
      textAlignVertical: "center",
    },
  });
}

// Read-only counterpart to StarRatingInput.tsx, non-interactive and sized
// for compact inline use (cards, feed rows). Shows only the earned stars —
// no trailing gray/empty ones — so e.g. a 2.5 rating renders as "★★ 1/2"
// and stops. Half-star values render as a small "1/2" label next to the
// last filled star rather than a clipped glyph — a font glyph's visible
// shape isn't reliably centered in its own layout box, so a 50%-width clip
// on "★" doesn't bisect it cleanly at small sizes. StarRatingInput.tsx
// solves this differently (SVG) since it still needs a tappable half-star
// target; this component just needs to display.
export default function StarRatingDisplay({ value, size = 14 }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors, size), [colors, size]);

  if (value == null) return null;

  const scaled = value / 2; // 1-10 -> 0.5-5
  const full = Math.floor(scaled);
  const hasHalf = scaled - full >= 0.5;

  return (
    <View style={styles.row}>
      {Array.from({ length: full }, (_, i) => (
        <Text key={`full-${i}`} style={[styles.star, styles.starFilled]}>★</Text>
      ))}
      {hasHalf && <Text style={styles.fraction}>1/2</Text>}
    </View>
  );
}
