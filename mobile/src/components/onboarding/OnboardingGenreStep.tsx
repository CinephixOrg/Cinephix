import { useMemo } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import Pressable from "../common/TapSafePressable";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import { MOVIE_GENRE_OPTIONS } from "../../constants/contentGenreIds";

interface Props {
  selectedGenreIds: number[];
  onToggleGenre: (id: number) => void;
  onNext: () => void;
  onSkip: () => void;
}

// Step 3 — reuses ContentFilterSheetContent.tsx's own chip markup/pattern
// (rounded Pressable, filled-primary+bold when active, flexWrap row).
// Movie genres only, regardless of Step 2's movies/series/both answer —
// direct decision: a separate movie-vs-series genre taxonomy here was
// needless complexity for a "get a feel for your taste" step; movie
// genres alone are enough signal, and Step 5 still suggests series too
// when the picked genre ids happen to overlap (most do). Skippable (skip
// ⇒ empty selection, Step 5 falls back to a plain popularity-sorted
// catalog).
export default function OnboardingGenreStep({ selectedGenreIds, onToggleGenre, onNext, onSkip }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const genreOptions = MOVIE_GENRE_OPTIONS;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { padding: 20, flexGrow: 1 },
        title: { fontSize: 24, fontFamily: fonts.bold, textAlign: "center", color: colors.primary, marginTop: 16 },
        subtitle: { textAlign: "center", color: colors.placeholder, marginTop: 6, marginBottom: 24 },
        chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
        chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: colors.border },
        chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
        chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.baseContent },
        chipTextActive: { fontFamily: fonts.bold, color: colors.primaryContent },
        button: { backgroundColor: colors.primary, borderRadius: 8, padding: 14, alignItems: "center", marginTop: 28 },
        buttonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 16 },
        skipText: { textAlign: "center", marginTop: 16, color: colors.placeholder, fontFamily: fonts.medium },
      }),
    [colors]
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t("Pick a few favorite genres")}</Text>
      <Text style={styles.subtitle}>{t("We'll use these to suggest titles next.")}</Text>

      <View style={styles.chipsWrap}>
        {genreOptions.map((genre) => {
          const active = selectedGenreIds.includes(genre.id);
          return (
            <Pressable key={genre.id} style={[styles.chip, active && styles.chipActive]} onPress={() => onToggleGenre(genre.id)}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{genre.name}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable style={styles.button} onPress={onNext}>
        <Text style={styles.buttonText}>{t("Next")}</Text>
      </Pressable>

      <Pressable onPress={onSkip}>
        <Text style={styles.skipText}>{t("Skip for now")}</Text>
      </Pressable>
    </ScrollView>
  );
}
