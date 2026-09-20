import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, View, Text, StyleSheet } from "react-native";
import Pressable from "../common/TapSafePressable";
import { genreColor } from "../match/CineMatchGenreRing";
import { useTheme } from "../../context/ThemeContext";
import type { ColorPalette } from "../../theme/palettes";
import { fonts } from "../../theme/typography";

const ROW_STAGGER_MS = 70;
const FILL_DURATION_MS = 620;
// Below this, a recent-vs-all-time genre swing reads as noise rather than a
// real lean — a genre that's +2% this month isn't "trending," it's rounding.
export const DELTA_NOISE_FLOOR = 4;

export interface GenreBarItem {
  genre: string;
  // Drives the bar's own width — always a 0-100 share, never a raw count.
  percentage: number;
  // Right-aligned figure: a raw count on Recent Taste, a percentage on the
  // weighting lists. Caller formats it so this component never has to know
  // which of the two it's showing.
  valueLabel: string;
  // Recent Taste only: this genre's share of the last 30 days minus its
  // all-time share. Renders as an ↑/↓ chip; omitted lists show no column.
  delta?: number;
}

interface Props {
  items: GenreBarItem[];
  bgLuminance: number;
  // Plays the fill-in once, the first time this card is actually reached.
  // Sticky on the caller's side — swiping back to an already-seen card
  // leaves the bars as they are rather than replaying.
  active: boolean;
  // Pass both to make rows tappable: selecting a genre filters the poster
  // row underneath the bars to that genre's own titles.
  selectedGenre?: string | null;
  onSelectGenre?: (genre: string) => void;
}

// The shared bar list behind Genre Breakdown, Recent Taste and Favorite
// Genres. Each row's fill animates out from zero on a stagger, so the card
// "counts itself in" instead of appearing pre-filled — the width is what
// animates (not a native-driver transform) because a scaleX would squash
// the rounded cap at the bar's end.
export default function AnalysisGenreBars({ items, bgLuminance, active, selectedGenre, onSelectGenre }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const hasDelta = items.some((i) => typeof i.delta === "number");

  const itemsKey = items.map((i) => `${i.genre}:${i.percentage}`).join("|");
  const anims = useMemo(() => items.map(() => new Animated.Value(0)), [itemsKey]);
  const running = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!active) return;
    anims.forEach((v) => v.setValue(0));
    running.current = Animated.stagger(
      ROW_STAGGER_MS,
      anims.map((v) =>
        Animated.timing(v, {
          toValue: 1,
          duration: FILL_DURATION_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        })
      )
    );
    running.current.start();
    return () => running.current?.stop();
  }, [active, anims]);

  return (
    <View>
      {items.map((item, i) => {
        const trending = typeof item.delta === "number" && item.delta >= DELTA_NOISE_FLOOR;
        const cooling = typeof item.delta === "number" && item.delta <= -DELTA_NOISE_FLOOR;
        const isSelected = selectedGenre === item.genre;
        // The row fades in; only some lists make it tappable. The animation
        // sits on the inner view either way, so the tappable wrapper stays a
        // plain Pressable (see common/TapSafePressable.tsx).
        const row = (
          <Animated.View style={[styles.row, isSelected && styles.rowSelected, { opacity: anims[i] }]}>
            <Text style={[styles.label, isSelected && styles.labelSelected]} numberOfLines={1}>
              {item.genre}
            </Text>
            <View style={styles.track}>
              <Animated.View
                style={[
                  styles.fill,
                  {
                    backgroundColor: genreColor(i, items.length, bgLuminance),
                    width: anims[i].interpolate({
                      inputRange: [0, 1],
                      // Never fully zero-width: a hairline of color at the
                      // left edge keeps a 1%-share genre visible instead of
                      // rendering as an empty track.
                      outputRange: ["2%", `${Math.max(item.percentage, 2)}%`],
                    }),
                  },
                ]}
              />
            </View>
            <Text style={styles.value}>{item.valueLabel}</Text>
            {hasDelta && (
              <Text style={[styles.delta, trending && styles.deltaUp, cooling && styles.deltaDown]}>
                {trending ? `↑${item.delta}%` : cooling ? `↓${Math.abs(item.delta as number)}%` : "•"}
              </Text>
            )}
          </Animated.View>
        );
        return onSelectGenre ? (
          <Pressable key={item.genre} onPress={() => onSelectGenre(item.genre)}>
            {row}
          </Pressable>
        ) : (
          <View key={item.genre}>{row}</View>
        );
      })}
    </View>
  );
}

function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 6,
      gap: 8,
      paddingVertical: 4,
      paddingHorizontal: 6,
      borderRadius: 8,
    },
    rowSelected: { backgroundColor: colors.base300 },
    label: { color: colors.baseContent, fontSize: 12, width: 74 },
    labelSelected: { fontFamily: fonts.bold, color: colors.primary },
    track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.base300, overflow: "hidden" },
    fill: { height: "100%", borderRadius: 4 },
    value: { color: colors.placeholder, fontSize: 11, width: 30, textAlign: "right" },
    delta: { fontSize: 10.5, fontFamily: fonts.bold, color: colors.placeholder, width: 36, textAlign: "right" },
    deltaUp: { color: colors.success },
    deltaDown: { color: colors.error },
  });
}
