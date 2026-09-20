import { memo, useCallback, useMemo } from "react";
import { FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import Pressable from "../common/TapSafePressable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import SheetModal, { SheetHeader } from "../collection/SheetModal";
import { MOVIE_GENRE_OPTIONS, SERIES_GENRE_OPTIONS, type GenreOption } from "../../constants/contentGenreIds";
import { DEFAULT_RECOMMEND_QUERY, recommendFilterCount, toggleIn, type RecommendQuery } from "../../utils/recommend";
import type { ContentType } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

type Colors = ReturnType<typeof useTheme>["colors"];

const YEARS = (() => {
  const now = new Date().getFullYear();
  return Array.from({ length: now - 1900 + 1 }, (_, i) => String(now - i));
})();

export function genreOptionsFor(type: ContentType): GenreOption[] {
  return type === "movie" ? MOVIE_GENRE_OPTIONS : SERIES_GENRE_OPTIONS;
}

function createStyles(colors: Colors, bottomInset: number) {
  return StyleSheet.create({
    body: { paddingTop: 8, paddingBottom: 12, gap: 22 },
    section: { gap: 10 },
    sectionLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.placeholder, paddingHorizontal: 20 },
    typeRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20 },
    typeCard: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      height: 56,
      borderRadius: 16,
      borderWidth: 1.5,
      paddingHorizontal: 14,
      borderColor: colors.border,
      backgroundColor: colors.base200,
    },
    typeCardActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}1A` },
    typeLabel: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent },
    typeLabelActive: { color: colors.primary },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 20 },
    yearList: { paddingHorizontal: 20, gap: 8 },
    chip: {
      height: 36,
      borderRadius: 18,
      paddingHorizontal: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.base200,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.baseContent },
    chipTextActive: { fontFamily: fonts.bold, color: colors.primaryContent },
    pressed: { opacity: 0.7 },
    footer: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: bottomInset + 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    clearButton: {
      height: 50,
      borderRadius: 14,
      paddingHorizontal: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.base200,
    },
    disabled: { opacity: 0.4 },
    clearText: { fontFamily: fonts.bold, fontSize: 14, color: colors.baseContent },
    showButton: {
      flex: 1,
      height: 50,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    showText: { fontFamily: fonts.bold, fontSize: 15, color: colors.primaryContent },
  });
}

type Styles = ReturnType<typeof createStyles>;

const Chip = memo(function Chip({
  label,
  active,
  onPress,
  styles,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  styles: Styles;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
    >
      <Text style={active ? [styles.chipText, styles.chipTextActive] : styles.chipText}>{label}</Text>
    </Pressable>
  );
});

interface Props {
  visible: boolean;
  onClose: () => void;
  query: RecommendQuery;
  onChange: (query: RecommendQuery) => void;
}

// The Recommend screen's filter menu — the same sheet, type cards and footer
// as the Watched List's, holding what used to be a Movies/Series tab bar
// above the search plus the year and genre filters.
//
// Every choice applies the moment it's tapped; the footer just closes.
function RecommendFilterSheet({ visible, onClose, query, onChange }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.bottom), [colors, insets.bottom]);
  const genres = genreOptionsFor(query.type);

  const setType = (type: ContentType) => {
    if (type === query.type) return;
    // Genre ids differ between movies and series; keep only those both share.
    const available = new Set(genreOptionsFor(type).map((genre) => genre.id));
    onChange({ ...query, type, genres: query.genres.filter((id) => available.has(id)) });
  };

  const toggleYear = useCallback((year: string) => onChange({ ...query, years: toggleIn(query.years, year) }), [onChange, query]);

  const canClear = recommendFilterCount(query) > 0;

  return (
    <SheetModal visible={visible} onClose={onClose} header={<SheetHeader title={t("Filters")} onClose={onClose} />}>
      <ScrollView contentContainerStyle={styles.body} bounces={false} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("Type")}</Text>
          <View style={styles.typeRow}>
            {(
              [
                { type: "movie", label: "Movies", icon: "film-outline" },
                { type: "series", label: "Series", icon: "tv-outline" },
              ] as const
            ).map((option) => {
              const active = query.type === option.type;
              return (
                <Pressable
                  key={option.type}
                  onPress={() => setType(option.type)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  style={({ pressed }) => [styles.typeCard, active && styles.typeCardActive, pressed && { transform: [{ scale: 0.97 }] }]}
                >
                  <Ionicons name={option.icon} size={20} color={active ? colors.primary : colors.baseContent} />
                  <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>{t(option.label)}</Text>
                  <Ionicons
                    name={active ? "checkmark-circle" : "ellipse-outline"}
                    size={20}
                    color={active ? colors.primary : colors.border}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("Genres")}</Text>
          <View style={styles.chips}>
            {genres.map((genre) => (
              <Chip
                key={genre.id}
                label={t(genre.name)}
                active={query.genres.includes(genre.id)}
                onPress={() => onChange({ ...query, genres: toggleIn(query.genres, genre.id) })}
                styles={styles}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("Years")}</Text>
          <FlatList
            horizontal
            data={YEARS}
            keyExtractor={(year) => year}
            contentContainerStyle={styles.yearList}
            showsHorizontalScrollIndicator={false}
            initialNumToRender={8}
            extraData={query.years}
            renderItem={({ item }) => (
              <Chip label={item} active={query.years.includes(item)} onPress={() => toggleYear(item)} styles={styles} />
            )}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={() => onChange({ ...DEFAULT_RECOMMEND_QUERY, query: query.query })}
          disabled={!canClear}
          accessibilityRole="button"
          style={({ pressed }) => [styles.clearButton, !canClear && styles.disabled, pressed && styles.pressed]}
        >
          <Text style={styles.clearText}>{t("Clear all")}</Text>
        </Pressable>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          style={({ pressed }) => [styles.showButton, pressed && { transform: [{ scale: 0.98 }] }]}
        >
          <Text style={styles.showText}>{t("Show results")}</Text>
        </Pressable>
      </View>
    </SheetModal>
  );
}

export default memo(RecommendFilterSheet);
