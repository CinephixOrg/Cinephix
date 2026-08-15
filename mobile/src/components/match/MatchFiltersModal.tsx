import { useMemo, useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView, Modal, Switch, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { MOVIE_GENRES, SERIES_GENRES } from "../../constants/genreConstants";
import type { ContentType } from "../../types";
import type { MatchFilters } from "../../api/matchService";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

type FilterMode = "general" | "specific";

interface Props {
  visible: boolean;
  onClose: () => void;
  filters: MatchFilters;
  onApply: (filters: MatchFilters) => void;
}

// Pro/Premium-only filter sheet for the swipe stack — Free never sees this
// (server enforces the default filters regardless, this is purely the UI
// gate). Redesigned as a bottom sheet instead of the old always-visible
// inline panel, matching the app's other picker/edit sheets
// (UserSharePickerModal, EditFavoritesModal) rather than a bespoke layout.
export default function MatchFiltersModal({ visible, onClose, filters, onApply }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [type, setType] = useState<ContentType>(filters.type);
  const [mode, setMode] = useState<FilterMode>(filters.genres.length > 0 ? "specific" : "general");
  const [genres, setGenres] = useState<string[]>(filters.genres);
  const [useCount, setUseCount] = useState(filters.useCount);
  const [useAvgRating, setUseAvgRating] = useState(filters.useAvgRating);

  // Re-seed from the caller's current filters each time the sheet opens, so
  // reopening after an apply reflects what's actually active, and dismissing
  // without applying (back gesture, backdrop tap) never leaks edits.
  useEffect(() => {
    if (visible) {
      setType(filters.type);
      setMode(filters.genres.length > 0 ? "specific" : "general");
      setGenres(filters.genres);
      setUseCount(filters.useCount);
      setUseAvgRating(filters.useAvgRating);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const genreList = type === "movie" ? MOVIE_GENRES : SERIES_GENRES;
  const criteriaValid = useCount || useAvgRating;
  const genresValid = mode === "general" || genres.length > 0;
  const canApply = criteriaValid && genresValid;

  const changeType = (next: ContentType) => {
    setType(next);
    setGenres([]);
  };

  const changeMode = (next: FilterMode) => {
    setMode(next);
    setGenres([]);
  };

  const toggleGenre = (genre: string) => {
    setGenres((prev) => (prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]));
  };

  const handleApply = () => {
    if (!canApply) return;
    onApply({
      type,
      genres: mode === "specific" ? genres : [],
      useCount,
      useAvgRating,
    });
    onClose();
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
        sheet: {
          backgroundColor: colors.base200,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          maxHeight: "88%",
        },
        header: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          padding: 18,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        title: { fontFamily: fonts.bold, fontSize: 17, color: colors.baseContent },
        scrollContent: { padding: 20, paddingBottom: 8 },
        sectionLabel: {
          fontFamily: fonts.bold,
          fontSize: 12,
          color: colors.placeholder,
          marginBottom: 10,
        },
        section: { marginBottom: 24 },
        segmentedRow: { flexDirection: "row", gap: 10 },
        segment: {
          flex: 1,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          paddingVertical: 12,
          alignItems: "center",
        },
        segmentActive: { backgroundColor: colors.primary, borderColor: colors.primary },
        segmentText: { fontFamily: fonts.medium, color: colors.baseContent, fontSize: 14 },
        segmentTextActive: { color: colors.primaryContent },
        radioCard: {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          padding: 14,
          marginBottom: 10,
        },
        radioCardActive: { borderColor: colors.primary, backgroundColor: colors.base300 },
        radioDot: {
          width: 18,
          height: 18,
          borderRadius: 9,
          borderWidth: 2,
          borderColor: colors.border,
        },
        radioDotActive: { borderColor: colors.primary, backgroundColor: colors.primary },
        radioLabel: { color: colors.baseContent, fontSize: 14, fontFamily: fonts.medium, flex: 1 },
        genreWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
        genreChip: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 18,
          paddingHorizontal: 14,
          paddingVertical: 8,
        },
        genreChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
        genreChipText: { fontSize: 13, color: colors.baseContent },
        genreChipTextActive: { color: colors.primaryContent, fontFamily: fonts.medium },
        switchCard: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          marginBottom: 10,
        },
        switchLabel: { color: colors.baseContent, fontSize: 14, fontFamily: fonts.medium },
        errorText: { color: colors.error, fontSize: 12, marginTop: 4 },
        footer: { padding: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
        applyButton: {
          backgroundColor: colors.primary,
          borderRadius: 12,
          paddingVertical: 15,
          alignItems: "center",
        },
        applyButtonDisabled: { opacity: 0.5 },
        applyButtonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 15 },
      }),
    [colors]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{t("Filters")}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.baseContent} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t("CONTENT TYPE")}</Text>
              <View style={styles.segmentedRow}>
                {(["movie", "series"] as ContentType[]).map((opt) => (
                  <Pressable
                    key={opt}
                    style={[styles.segment, type === opt && styles.segmentActive]}
                    onPress={() => changeType(opt)}
                  >
                    <Text style={[styles.segmentText, type === opt && styles.segmentTextActive]}>
                      {opt === "movie" ? t("Movies") : t("Series")}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t("GENRE MATCHING")}</Text>
              <Pressable
                style={[styles.radioCard, mode === "general" && styles.radioCardActive]}
                onPress={() => changeMode("general")}
              >
                <View style={[styles.radioDot, mode === "general" && styles.radioDotActive]} />
                <Text style={styles.radioLabel}>{t("Match my entire CineGraph")}</Text>
              </Pressable>
              <Pressable
                style={[styles.radioCard, mode === "specific" && styles.radioCardActive]}
                onPress={() => changeMode("specific")}
              >
                <View style={[styles.radioDot, mode === "specific" && styles.radioDotActive]} />
                <Text style={styles.radioLabel}>{t("Match specific genres")}</Text>
              </Pressable>

              {mode === "specific" && (
                <View style={styles.genreWrap}>
                  {genreList.map((genre) => {
                    const active = genres.includes(genre);
                    return (
                      <Pressable
                        key={genre}
                        style={[styles.genreChip, active && styles.genreChipActive]}
                        onPress={() => toggleGenre(genre)}
                      >
                        <Text style={[styles.genreChipText, active && styles.genreChipTextActive]}>
                          {genre}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
              {!genresValid && (
                <Text style={styles.errorText}>{t("Select at least one genre.")}</Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t("SIGNALS TO USE")}</Text>
              <View style={styles.switchCard}>
                <Text style={styles.switchLabel}>{t("Watched Count")}</Text>
                <Switch
                  value={useCount}
                  onValueChange={setUseCount}
                  trackColor={{ true: colors.primary, false: colors.border }}
                />
              </View>
              <View style={styles.switchCard}>
                <Text style={styles.switchLabel}>{t("Average Rating")}</Text>
                <Switch
                  value={useAvgRating}
                  onValueChange={setUseAvgRating}
                  trackColor={{ true: colors.primary, false: colors.border }}
                />
              </View>
              {!criteriaValid && (
                <Text style={styles.errorText}>{t("You must select at least one criterion.")}</Text>
              )}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              style={[styles.applyButton, !canApply && styles.applyButtonDisabled]}
              onPress={handleApply}
              disabled={!canApply}
            >
              <Text style={styles.applyButtonText}>{t("Apply Filters")}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
