import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import TmdbLogo from "./common/TmdbLogo";
import { formatCompactCount, formatDecimal } from "../utils/numberFormat";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";
import type { TmdbRating } from "../types";

/**
 * A title's TMDB rating — TMDB's logo over "7,9 (17,9 B)" — so it can't be
 * taken for the app's own average beside it. Stacked to fit a narrow card.
 */
function TmdbScore({ rating }: { rating: TmdbRating }) {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const average = formatDecimal(rating.average, i18n.language);
  const count = formatCompactCount(rating.count, i18n.language);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { alignItems: "center", marginTop: 4, gap: 2 },
        text: { fontSize: 10.5, fontFamily: fonts.bold, color: colors.placeholder },
        count: { fontFamily: fonts.regular },
      }),
    [colors]
  );
  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityLabel={t("TMDB rating {{rating}}, {{count}} votes", { rating: average, count: rating.count })}
    >
      <TmdbLogo height={7} />
      <Text style={styles.text}>
        {average} <Text style={styles.count}>({count})</Text>
      </Text>
    </View>
  );
}

export default memo(TmdbScore);
