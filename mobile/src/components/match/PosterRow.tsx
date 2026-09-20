import { useMemo } from "react";
import { View, Image, Text, StyleSheet } from "react-native";
import Pressable from "../common/TapSafePressable";
import { Ionicons } from "@expo/vector-icons";
// Plain RN ScrollView loses horizontal pan gestures to the outer card-paging
// ScrollView this row lives inside (a real, reported bug — same-axis nested
// ScrollViews are a known weak spot for RN's default responder system).
// gesture-handler's ScrollView has proper native gesture arbitration and
// correctly lets this inner row win when a drag starts on it —
// GestureHandlerRootView is already mounted at the app root (app/_layout.tsx),
// so no extra setup is needed to use it here.
import { ScrollView } from "react-native-gesture-handler";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import type { LightweightContent } from "../../api/contentService";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w200";
const POSTER_WIDTH = 84;
const POSTER_HEIGHT = 126;
// Deterministic "there's more, scroll →" affordance — a right-edge fade into
// the card's own background, rather than relying on item-count-vs-row-width
// math happening to leave a partial poster visible at the edge.
const FADE_WIDTH = 32;

// An Ionicons glyph, or a single bold character (e.g. MatchSharedFavorites'
// own "=" for an exact-title match) for symbols Ionicons has no icon for —
// rendered as plain Text inside the same badge circle rather than an icon.
export type PosterBadge = { icon: keyof typeof Ionicons.glyphMap; color: string } | { char: string; color: string };

interface Props {
  items: LightweightContent[];
  // Both optional — MatchSharedFavorites doesn't pass either, so its posters
  // stay exactly as non-interactive as before, just visually bigger/titled.
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  // Optional small corner badge per item (e.g. MatchSharedFavorites tagging
  // "exact title match" vs. "same genre") — overlays the poster, doesn't add
  // a row, so callers that don't pass it (the Shared Genres carousel) are
  // visually unaffected.
  badgeFor?: (item: LightweightContent) => PosterBadge | null;
}

// Poster-thumbnail row shared by MatchSharedFavorites and MatchAnalysisPanel's
// shared-genre content — bigger posters + a title under each (was a bare
// thumbnail before), a tappable selected state when a caller opts in, and an
// edge fade hinting the row scrolls.
export default function PosterRow({ items, selectedId, onSelect, badgeFor }: Props) {
  const { colors } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { position: "relative" },
        row: { flexDirection: "row", gap: 10 },
        item: { width: POSTER_WIDTH },
        // Explicit size (rather than shrink-wrapping the Image) + overflow:
        // hidden — without both, the Image's own square corners poked past
        // this border's rounded ones, making the ring look like it didn't
        // fully wrap the poster.
        posterBorder: { width: POSTER_WIDTH, height: POSTER_HEIGHT, borderRadius: 10, borderWidth: 2, borderColor: "transparent", overflow: "hidden" },
        posterBorderSelected: { borderColor: colors.primary },
        poster: { width: POSTER_WIDTH, height: POSTER_HEIGHT, borderRadius: 8, backgroundColor: colors.base300 },
        title: { fontFamily: fonts.medium, fontSize: 11, color: colors.baseContent, marginTop: 6, textAlign: "center" },
        fade: { position: "absolute", right: 0, top: 0 },
        badge: {
          position: "absolute",
          top: -4,
          right: -4,
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: colors.base100,
          alignItems: "center",
          justifyContent: "center",
        },
        badgeChar: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 15 },
      }),
    [colors]
  );

  if (items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((item) => {
          const isSelected = item._id === selectedId;
          const badge = badgeFor?.(item);
          return (
            <Pressable key={item._id} style={styles.item} onPress={() => onSelect?.(item._id)}>
              <View style={[styles.posterBorder, isSelected && styles.posterBorderSelected]}>
                {item.poster_path ? (
                  <Image source={{ uri: `${POSTER_BASE}${item.poster_path}` }} style={styles.poster} />
                ) : (
                  <View style={styles.poster} />
                )}
              </View>
              {badge && (
                <View style={styles.badge} pointerEvents="none">
                  {"icon" in badge ? (
                    <Ionicons name={badge.icon} size={14} color={badge.color} />
                  ) : (
                    <Text style={[styles.badgeChar, { color: badge.color }]}>{badge.char}</Text>
                  )}
                </View>
              )}
              <Text style={styles.title} numberOfLines={2}>
                {item.title ?? item.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Svg width={FADE_WIDTH} height={POSTER_HEIGHT} style={styles.fade} pointerEvents="none">
        <Defs>
          <LinearGradient id="posterRowFade" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.base200} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.base200} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={FADE_WIDTH} height={POSTER_HEIGHT} fill="url(#posterRowFade)" />
      </Svg>
    </View>
  );
}
