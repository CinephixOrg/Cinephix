import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import type { GenreOption } from "../constants/contentGenreIds";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

interface Props {
  genreOptions: GenreOption[];
  selectedYears: string[];
  onToggleYear: (year: string) => void;
  selectedGenres: number[];
  onToggleGenre: (id: number) => void;
  hasPoster: "" | "yes" | "no";
  onChangeHasPoster: (v: "" | "yes" | "no") => void;
}

// Shared by Movies and Series screens — same filter UI rendered twice for
// the same reason (near-identical browse screens), unlike Cinematch's two
// distinct call sites which each got their own trimmed filter panel.
export default function ContentFilterPanel({
  genreOptions,
  selectedYears,
  onToggleYear,
  selectedGenres,
  onToggleGenre,
  hasPoster,
  onChangeHasPoster,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => StyleSheet.create({
    panel: {
      backgroundColor: colors.base200,
      borderRadius: 12,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 16,
    },
    label: {
      fontFamily: fonts.bold,
      fontSize: 13,
      color: colors.baseContent,
      marginBottom: 8,
      marginTop: 8,
    },
    labelFirst: { marginTop: 0 },
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 12, color: colors.baseContent },
    chipTextActive: { color: colors.primaryContent, fontFamily: fonts.medium },
    segmentedRow: { flexDirection: "row", gap: 8 },
    segment: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: 8,
      alignItems: "center",
    },
    segmentActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    segmentText: { fontFamily: fonts.medium, fontSize: 13, color: colors.baseContent },
    segmentTextActive: { color: colors.primaryContent },
  }), [colors]);

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: now - 1900 + 1 }, (_, i) => String(now - i));
  }, []);

  return (
    <View style={styles.panel}>
      <Text style={[styles.label, styles.labelFirst]}>{t("Years")}</Text>
      <View style={styles.chipWrap}>
        {years.map((year) => {
          const active = selectedYears.includes(year);
          return (
            <Pressable
              key={year}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onToggleYear(year)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{year}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>{t("Genres")}</Text>
      <View style={styles.chipWrap}>
        {genreOptions.map((genre) => {
          const active = selectedGenres.includes(genre.id);
          return (
            <Pressable
              key={genre.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onToggleGenre(genre.id)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{genre.name}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>{t("Has Poster?")}</Text>
      <View style={styles.segmentedRow}>
        {([
          { value: "" as const, label: t("All") },
          { value: "yes" as const, label: t("Yes") },
          { value: "no" as const, label: t("No") },
        ]).map((opt) => (
          <Pressable
            key={opt.value}
            style={[styles.segment, hasPoster === opt.value && styles.segmentActive]}
            onPress={() => onChangeHasPoster(opt.value)}
          >
            <Text style={[styles.segmentText, hasPoster === opt.value && styles.segmentTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
