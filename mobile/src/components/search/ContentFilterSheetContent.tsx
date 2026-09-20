import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Pressable from "../common/TapSafePressable";
import { useTranslation } from "react-i18next";
import type { GenreOption } from "../../constants/contentGenreIds";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

interface Props {
  genreOptions: GenreOption[];
  selectedYears: string[];
  onToggleYear: (year: string) => void;
  onToggleYears: (years: string[]) => void;
  selectedGenres: number[];
  onToggleGenre: (id: number) => void;
}

const CURRENT_YEAR = new Date().getFullYear();
// Recent years stay individually pickable (the common case — "something
// from 2019"); anything older collapses into whole-decade chips instead of
// 100+ individual rows — tapping one toggles every year in that decade at
// once (still sent to the server as the same plain year-string array the
// old panel used, no backend change needed for this).
const RECENT_YEARS_COUNT = 12;
const RECENT_YEARS = Array.from({ length: RECENT_YEARS_COUNT }, (_, i) => CURRENT_YEAR - i);
// 1900 used to be the floor here, silently making anything older
// unfilterable — TMDB does carry a handful of titles predating it (the
// earliest surviving films date to the 1880s-90s). 1870s comfortably covers
// that with one extra decade chip, rather than picking an arbitrary cutoff
// that just moves the same gap a little further back.
const OLDEST_DECADE_START = 1870;
const DECADES: { label: string; years: number[] }[] = (() => {
  const list: { label: string; years: number[] }[] = [];
  const oldestRecentYear = CURRENT_YEAR - RECENT_YEARS_COUNT + 1;
  let decadeStart = Math.floor((oldestRecentYear - 1) / 10) * 10;
  while (decadeStart >= OLDEST_DECADE_START) {
    const years: number[] = [];
    for (let y = decadeStart; y < decadeStart + 10 && y <= oldestRecentYear - 1; y++) {
      if (y >= OLDEST_DECADE_START) years.push(y);
    }
    if (years.length) list.push({ label: `${decadeStart}s`, years });
    decadeStart -= 10;
  }
  return list;
})();

// Chip content for Movies/Series' genre+year filters, rendered inside
// FilterBottomSheet — replaces ContentFilterPanel's old boxed-column-list
// design with wrapping pill rows, the standard modern multi-select pattern.
export default function ContentFilterSheetContent({
  genreOptions,
  selectedYears,
  onToggleYear,
  onToggleYears,
  selectedGenres,
  onToggleGenre,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: { marginBottom: 22 },
        sectionLabel: {
          fontFamily: fonts.bold,
          fontSize: 12,
          color: colors.placeholder,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          marginBottom: 10,
        },
        chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
        chip: {
          borderRadius: 999,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderWidth: 1.5,
          borderColor: colors.border,
        },
        chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
        chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.baseContent },
        chipTextActive: { fontFamily: fonts.bold, color: colors.primaryContent },
      }),
    [colors]
  );

  const decadeIsActive = (years: number[]) => years.every((y) => selectedYears.includes(String(y)));
  const toggleDecade = (years: number[]) => {
    const yearStrings = years.map(String);
    onToggleYears(decadeIsActive(years) ? selectedYears.filter((y) => !yearStrings.includes(y)) : [...new Set([...selectedYears, ...yearStrings])]);
  };

  return (
    <View>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t("Genres")}</Text>
        <View style={styles.chipsWrap}>
          {genreOptions.map((genre) => {
            const active = selectedGenres.includes(genre.id);
            return (
              <Pressable key={genre.id} style={[styles.chip, active && styles.chipActive]} onPress={() => onToggleGenre(genre.id)}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{genre.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t("Year")}</Text>
        <View style={styles.chipsWrap}>
          {RECENT_YEARS.map((year) => {
            const yearStr = String(year);
            const active = selectedYears.includes(yearStr);
            return (
              <Pressable key={yearStr} style={[styles.chip, active && styles.chipActive]} onPress={() => onToggleYear(yearStr)}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{yearStr}</Text>
              </Pressable>
            );
          })}
          {DECADES.map((decade) => {
            const active = decadeIsActive(decade.years);
            return (
              <Pressable key={decade.label} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleDecade(decade.years)}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{decade.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
