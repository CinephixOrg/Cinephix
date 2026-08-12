import { useMemo } from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { useTheme } from "../context/ThemeContext";
import type { ColorPalette } from "../theme/palettes";

// Matches frontend/src/components/StarRating.jsx: 5 stars displayed, but
// backed by the same 1-10 integer scale the backend validates
// (middleware/validation.js addRating: value 1-10). Each star covers two
// values — its left half is the odd (lower) value, its right half is the
// even (upper) value — so tapping gives half-star granularity.
interface Props {
  value: number; // 1-10
  onChange: (value: number) => void;
  disabled?: boolean;
}

const STAR_COUNT = 5;
const STAR_SIZE = 30;

function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    row: { flexDirection: "row", gap: 4 },
    starWrap: { width: STAR_SIZE, height: STAR_SIZE },
    star: { fontSize: STAR_SIZE, lineHeight: STAR_SIZE },
    starEmpty: { color: colors.border },
    starFilled: { color: colors.primary },
    halfClip: { width: "50%", overflow: "hidden" },
    tapRow: { flexDirection: "row" },
    tapHalf: { flex: 1 },
  });
}

function useStarStyles() {
  const { colors } = useTheme();
  return useMemo(() => buildStyles(colors), [colors]);
}

function Star({
  index,
  value,
  onChange,
  disabled,
}: {
  index: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const styles = useStarStyles();
  const leftValue = index * 2 + 1;
  const rightValue = index * 2 + 2;
  const fill = value >= rightValue ? "full" : value >= leftValue ? "half" : "empty";

  return (
    <View style={styles.starWrap}>
      <Text style={[styles.star, styles.starEmpty]}>★</Text>
      {fill !== "empty" && (
        <View
          style={[
            StyleSheet.absoluteFill,
            fill === "half" && styles.halfClip,
          ]}
          pointerEvents="none"
        >
          <Text style={[styles.star, styles.starFilled]}>★</Text>
        </View>
      )}
      <View style={[StyleSheet.absoluteFill, styles.tapRow]}>
        <Pressable
          style={styles.tapHalf}
          onPress={() => !disabled && onChange(leftValue)}
          hitSlop={4}
        />
        <Pressable
          style={styles.tapHalf}
          onPress={() => !disabled && onChange(rightValue)}
          hitSlop={4}
        />
      </View>
    </View>
  );
}

export default function StarRatingInput({ value, onChange, disabled }: Props) {
  const styles = useStarStyles();
  return (
    <View style={styles.row}>
      {Array.from({ length: STAR_COUNT }, (_, i) => (
        <Star key={i} index={i} value={value} onChange={onChange} disabled={disabled} />
      ))}
    </View>
  );
}

