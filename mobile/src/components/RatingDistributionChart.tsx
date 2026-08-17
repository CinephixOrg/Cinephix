import { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import type { ColorPalette } from "../theme/palettes";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";
import StarRatingDisplay from "./StarRatingDisplay";

const RATING_VALUES = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
const BAR_MAX_HEIGHT = 36;
const SCALE_STAR_SIZE = 11;

interface Props {
  // Raw 1-10 backend values, one per rating — divided by 2 here to match
  // this app's own 0.5-5 half-star StarRatingInput scale, mirroring web's
  // identical RatingDistribution.jsx conversion.
  ratings: number[];
}

function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 8 },
    scaleFraction: { fontSize: SCALE_STAR_SIZE, color: colors.placeholder, fontFamily: fonts.medium },
    bars: { flex: 1, flexDirection: "row", alignItems: "flex-end", gap: 4, height: BAR_MAX_HEIGHT },
    barColumn: { flex: 1, height: BAR_MAX_HEIGHT, justifyContent: "flex-end" },
    bar: { width: "100%", borderRadius: 3, backgroundColor: colors.primary, minHeight: 2 },
    barEmpty: { backgroundColor: colors.base300 },
    barActive: { backgroundColor: colors.secondary },
    summary: { alignItems: "center", minWidth: 64, gap: 2 },
    average: { fontFamily: fonts.bold, fontSize: 20, color: colors.baseContent },
    count: { fontSize: 11, color: colors.placeholder, textAlign: "center" },
    empty: { fontSize: 13, color: colors.placeholder, marginTop: 8 },
  });
}

export default function RatingDistributionChart({ ratings }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const [pressedValue, setPressedValue] = useState<number | null>(null);

  const scaled = useMemo(() => ratings.map((v) => v / 2), [ratings]);

  if (scaled.length === 0) {
    return <Text style={styles.empty}>{t("No ratings yet.")}</Text>;
  }

  const dist: Record<number, number> = {};
  RATING_VALUES.forEach((v) => {
    dist[v] = scaled.filter((r) => r === v).length;
  });
  const maxCount = Math.max(...Object.values(dist), 1);
  const average = scaled.reduce((sum, r) => sum + r, 0) / scaled.length;

  return (
    <View style={styles.container}>
      <Text style={styles.scaleFraction}>1/2</Text>

      <View style={styles.bars}>
        {RATING_VALUES.map((value) => {
          const count = dist[value];
          const height = count > 0 ? Math.max((count / maxCount) * BAR_MAX_HEIGHT, 4) : 2;
          const isPressed = pressedValue === value;
          return (
            <Pressable
              key={value}
              style={styles.barColumn}
              onPressIn={() => setPressedValue(value)}
              onPressOut={() => setPressedValue(null)}
            >
              <View
                style={[
                  styles.bar,
                  count === 0 && styles.barEmpty,
                  isPressed && styles.barActive,
                  { height },
                ]}
              />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.summary}>
        <Text style={styles.average}>
          {pressedValue != null ? dist[pressedValue] : `${average.toFixed(1)}/5`}
        </Text>
        <Text style={styles.count}>
          {pressedValue == null ? t("rating_count", { count: scaled.length }) : " "}
        </Text>
        <StarRatingDisplay value={pressedValue != null ? pressedValue * 2 : 10} size={SCALE_STAR_SIZE} />
      </View>
    </View>
  );
}
