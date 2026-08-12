import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import type { ColorPalette } from "../theme/palettes";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const RATING_VALUES = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
const BAR_MAX_HEIGHT = 60;

interface Props {
  // Raw 1-10 backend values, one per rating — divided by 2 here to match
  // this app's own 0.5-5 half-star StarRatingInput scale, mirroring web's
  // identical RatingDistribution.jsx conversion.
  ratings: number[];
}

function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginTop: 8 },
    bars: { flex: 1, flexDirection: "row", alignItems: "flex-end", gap: 4, height: BAR_MAX_HEIGHT },
    barColumn: { flex: 1, alignItems: "center" },
    bar: { width: "100%", borderRadius: 3, backgroundColor: colors.primary, minHeight: 2 },
    barEmpty: { backgroundColor: colors.base300 },
    barLabel: { fontSize: 9, color: colors.placeholder, marginTop: 2 },
    summary: { alignItems: "center", minWidth: 60 },
    average: { fontFamily: fonts.bold, fontSize: 20, color: colors.baseContent },
    count: { fontSize: 11, color: colors.placeholder, marginTop: 2, textAlign: "center" },
    empty: { fontSize: 13, color: colors.placeholder, marginTop: 8 },
  });
}

export default function RatingDistributionChart({ ratings }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => buildStyles(colors), [colors]);

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
      <View style={styles.bars}>
        {RATING_VALUES.map((value) => {
          const count = dist[value];
          const height = count > 0 ? Math.max((count / maxCount) * BAR_MAX_HEIGHT, 4) : 2;
          return (
            <View key={value} style={styles.barColumn}>
              <View style={[styles.bar, count === 0 && styles.barEmpty, { height }]} />
              <Text style={styles.barLabel}>{value}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.summary}>
        <Text style={styles.average}>{average.toFixed(1)}</Text>
        <Text style={styles.count}>{t("rating_count", { count: scaled.length })}</Text>
      </View>
    </View>
  );
}
