import { useMemo } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import type { GenreOption } from "../constants/contentGenreIds";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";
import { localeUpper } from "../utils/text";

interface Props {
  genreOptions: GenreOption[];
  selectedYears: string[];
  onToggleYear: (year: string) => void;
  selectedGenres: number[];
  onToggleGenre: (id: number) => void;
}

// Tall enough for 3 full rows plus a sliver of a 4th — that partial row is
// a deliberate scroll affordance (you can see there's more, no icon/hint
// text needed) rather than an exact "3 rows and stop" cut.
const BOX_HEIGHT = 132;
const YEAR_BOX_WIDTH = 92;
const CHAR_WIDTH_ESTIMATE = 7; // rough px/char at this row's fontSize, for sizing the genre box

// Shared by Movies and Series screens — same filter UI rendered twice for
// the same reason (near-identical browse screens), unlike Cinematch's two
// distinct call sites which each got their own trimmed filter panel.
// Years/Genres are two small elevated "card" lists, sized to their own
// content (Years just wide enough for "YYYY", Genres wide enough for its
// single longest option) rather than stretched half-and-half — each a
// short peek-height box you drag inside to reveal the rest.
export default function ContentFilterPanel({
  genreOptions,
  selectedYears,
  onToggleYear,
  selectedGenres,
  onToggleGenre,
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
    columnsRow: { flexDirection: "row", gap: 20, justifyContent: "center" },
    label: {
      fontFamily: fonts.bold,
      fontSize: 11,
      color: colors.placeholder,
      textAlign: "center",
      letterSpacing: 0.6,
      marginBottom: 8,
    },
    box: {
      height: BOX_HEIGHT,
      borderRadius: 14,
      backgroundColor: colors.base100,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOpacity: 0.18,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    row: { paddingVertical: 10, alignItems: "center", justifyContent: "center" },
    rowText: { fontSize: 14, color: colors.baseContent },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: 14 },
    badge: { backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 4 },
    badgeText: { fontSize: 14, color: colors.primaryContent, fontFamily: fonts.bold },
  }), [colors]);

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: now - 1900 + 1 }, (_, i) => String(now - i));
  }, []);

  const genreBoxWidth = useMemo(() => {
    const longest = genreOptions.reduce((max, g) => Math.max(max, g.name.length), 0);
    return Math.min(220, Math.max(92, longest * CHAR_WIDTH_ESTIMATE + 36));
  }, [genreOptions]);

  return (
    <View style={styles.panel}>
      <View style={styles.columnsRow}>
        <View style={{ width: YEAR_BOX_WIDTH }}>
          <Text style={styles.label}>{localeUpper(t("Years"))}</Text>
          <ScrollView style={styles.box} nestedScrollEnabled>
            {years.map((year, i) => {
              const active = selectedYears.includes(year);
              return (
                <View key={year}>
                  <Pressable style={styles.row} onPress={() => onToggleYear(year)}>
                    {active ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{year}</Text>
                      </View>
                    ) : (
                      <Text style={styles.rowText}>{year}</Text>
                    )}
                  </Pressable>
                  {i < years.length - 1 && <View style={styles.divider} />}
                </View>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ width: genreBoxWidth }}>
          <Text style={styles.label}>{localeUpper(t("Genres"))}</Text>
          <ScrollView style={styles.box} nestedScrollEnabled>
            {genreOptions.map((genre, i) => {
              const active = selectedGenres.includes(genre.id);
              return (
                <View key={genre.id}>
                  <Pressable style={styles.row} onPress={() => onToggleGenre(genre.id)}>
                    {active ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{genre.name}</Text>
                      </View>
                    ) : (
                      <Text style={styles.rowText}>{genre.name}</Text>
                    )}
                  </Pressable>
                  {i < genreOptions.length - 1 && <View style={styles.divider} />}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}
