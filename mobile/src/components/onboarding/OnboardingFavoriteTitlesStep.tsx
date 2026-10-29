import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, Image, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import Pressable from "../common/TapSafePressable";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import { getMovies, getSeries } from "../../api/contentService";
import type { ContentType } from "../../types";
import type { PickedTitle, TastePreference } from "./onboardingTypes";

const POSTER_BASE = "https://image.tmdb.org/t/p/w92";
const SEARCH_DEBOUNCE_MS = 400;

interface Props {
  preference: TastePreference;
  pickedTitles: PickedTitle[];
  onTogglePick: (title: PickedTitle) => void;
  onNext: () => void;
  onSkip: () => void;
}

interface SearchRow {
  id: string;
  type: ContentType;
  title: string;
  posterPath?: string | null;
}

// Step 4 (optional) — a title picked here is carried into Step 5's grid,
// pre-selected, and never writes anything itself: Step 5's single batched
// "Add" action is the only write for the whole wizard (same single-action
// principle Step 5's own screen establishes).
export default function OnboardingFavoriteTitlesStep({ preference, pickedTitles, onTogglePick, onNext, onSkip }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const requestId = ++requestIdRef.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const wantMovies = preference !== "series";
        const wantSeries = preference !== "movies";
        const [movieRes, seriesRes] = await Promise.all([
          wantMovies ? getMovies(1, 10, q) : Promise.resolve({ items: [] }),
          wantSeries ? getSeries(1, 10, q) : Promise.resolve({ items: [] }),
        ]);
        if (requestId !== requestIdRef.current) return;
        const rows: SearchRow[] = [
          ...movieRes.items.map((m) => ({ id: m._id, type: "movie" as ContentType, title: m.title, posterPath: m.poster_path })),
          ...seriesRes.items.map((s) => ({ id: s._id, type: "series" as ContentType, title: s.name, posterPath: s.poster_path })),
        ];
        setResults(rows);
      } catch {
        if (requestId === requestIdRef.current) setResults([]);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, preference]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, padding: 20 },
        title: { fontSize: 24, fontFamily: fonts.bold, textAlign: "center", color: colors.primary, marginTop: 16 },
        subtitle: { textAlign: "center", color: colors.placeholder, marginTop: 6, marginBottom: 16 },
        input: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.base200,
          borderRadius: 8,
          padding: 12,
          fontSize: 16,
          color: colors.baseContent,
          marginBottom: 12,
        },
        pickedRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
        pickedChip: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          backgroundColor: colors.primary,
          borderRadius: 999,
          paddingHorizontal: 12,
          paddingVertical: 6,
        },
        pickedChipText: { color: colors.primaryContent, fontFamily: fonts.medium, fontSize: 12 },
        row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
        poster: { width: 36, height: 54, borderRadius: 4, backgroundColor: colors.base200 },
        rowTitle: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.baseContent },
        button: { backgroundColor: colors.primary, borderRadius: 8, padding: 14, alignItems: "center", marginTop: 16 },
        buttonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 16 },
        skipText: { textAlign: "center", marginTop: 16, color: colors.placeholder, fontFamily: fonts.medium },
      }),
    [colors]
  );

  const isPicked = (id: string, type: ContentType) => pickedTitles.some((p) => p.id === id && p.type === type);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("Any favorites?")}</Text>
      <Text style={styles.subtitle}>{t("Search for a few titles you already love.")}</Text>

      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder={t("Search movies or series")}
        placeholderTextColor={colors.placeholder}
      />

      {pickedTitles.length > 0 && (
        <View style={styles.pickedRow}>
          {pickedTitles.map((p) => (
            <Pressable key={`${p.type}-${p.id}`} style={styles.pickedChip} onPress={() => onTogglePick(p)}>
              <Text style={styles.pickedChipText} numberOfLines={1}>
                {p.title}
              </Text>
              <Ionicons name="close" size={12} color={colors.primaryContent} />
            </Pressable>
          ))}
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          renderItem={({ item }) => {
            const picked = isPicked(item.id, item.type);
            return (
              <Pressable
                style={styles.row}
                onPress={() => onTogglePick({ id: item.id, type: item.type, title: item.title, posterPath: item.posterPath })}
              >
                {item.posterPath ? (
                  <Image source={{ uri: `${POSTER_BASE}${item.posterPath}` }} style={styles.poster} />
                ) : (
                  <View style={styles.poster} />
                )}
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Ionicons
                  name={picked ? "checkmark-circle" : "add-circle-outline"}
                  size={22}
                  color={picked ? colors.primary : colors.placeholder}
                />
              </Pressable>
            );
          }}
        />
      )}

      <Pressable style={styles.button} onPress={onNext}>
        <Text style={styles.buttonText}>{t("Next")}</Text>
      </Pressable>
      <Pressable onPress={onSkip}>
        <Text style={styles.skipText}>{t("Skip for now")}</Text>
      </Pressable>
    </View>
  );
}
