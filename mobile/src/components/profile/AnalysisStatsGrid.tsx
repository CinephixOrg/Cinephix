import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import type { ColorPalette } from "../../theme/palettes";
import { fonts } from "../../theme/typography";

const COUNT_DURATION_MS = 900;
const ARROW_FADE_MS = 240;

export interface StatTileDef {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  // Already-formatted fallback, and what's shown outright for anything that
  // isn't a number to begin with (e.g. "Member Since").
  value: string;
  // Present for numeric tiles only — the target the tile counts up to.
  countTo?: number;
  decimals?: number;
  suffix?: string;
  // Monthly card only: which way this month moved against the last one.
  // "flat" still renders (a dash), so an unchanged figure is visibly
  // unchanged rather than looking like a tile that forgot its arrow.
  trend?: "up" | "down" | "flat";
  // The line under the label — "You watched 13 last month".
  caption?: string;
}

interface Props {
  tiles: StatTileDef[];
  // Sticky on the caller's side: flips true the first time this card is
  // reached and stays true, so the count-up plays exactly once.
  active: boolean;
}

// The closing "here's everything at once" card. Every numeric tile counts up
// from zero on a single shared progress value rather than one Animated.Value
// each — a dozen listeners all calling setState on the same frame is a dozen
// re-renders of the same grid, where one listener is one.
export default function AnalysisStatsGrid({ tiles, active }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  // Starts at zero, NOT at the final values: this card mounts off-screen
  // (the deck keeps every card mounted), so initialising at 1 and dropping
  // to 0 inside the effect is what made the real numbers flash for a frame
  // before the count-up started.
  const [progress, setProgress] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;
  // The trend arrow is the verdict on the number, so it has no business
  // being on screen before the number has finished arriving — it was
  // rendering statically from frame one while the value was still counting,
  // which read as the answer showing up before the question.
  const [countFinished, setCountFinished] = useState(false);
  const arrowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    const listener = anim.addListener(({ value }) => setProgress(value));
    const animation = Animated.timing(anim, {
      toValue: 1,
      duration: COUNT_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished) setCountFinished(true);
    });
    return () => {
      animation.stop();
      anim.removeListener(listener);
      // Whatever the tiles were mid-count, leave them on their real values —
      // nothing replays this card, so a stopped count must never strand a
      // tile at a partial number, or hide its arrow forever.
      setProgress(1);
      setCountFinished(true);
    };
  }, [active, anim]);

  useEffect(() => {
    if (!countFinished) return;
    Animated.timing(arrowOpacity, {
      toValue: 1,
      duration: ARROW_FADE_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [countFinished, arrowOpacity]);

  return (
    <View style={styles.grid}>
      {tiles.map((tile) => {
        const display =
          tile.countTo === undefined
            ? tile.value
            : `${(tile.countTo * progress).toFixed(tile.decimals ?? 0)}${tile.suffix ?? ""}`;
        const trendColor =
          tile.trend === "up" ? colors.success : tile.trend === "down" ? colors.error : colors.placeholder;
        return (
          <View key={tile.label} style={styles.tile}>
            <View style={styles.iconWrap}>
              <Ionicons name={tile.icon} size={16} color={colors.primary} />
            </View>
            <View style={styles.valueRow}>
              <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {display}
              </Text>
              {/* Always mounted, just transparent until the count lands —
                  fading in a view that wasn't occupying space would jog the
                  number sideways at the exact moment it settles. */}
              {tile.trend && (
                <Animated.View style={{ opacity: arrowOpacity }}>
                  <Ionicons
                    name={tile.trend === "up" ? "arrow-up" : tile.trend === "down" ? "arrow-down" : "remove"}
                    size={13}
                    color={trendColor}
                  />
                </Animated.View>
              )}
            </View>
            <Text style={styles.label}>{tile.label.toUpperCase()}</Text>
            {tile.caption && <Text style={styles.caption}>{tile.caption}</Text>}
          </View>
        );
      })}
    </View>
  );
}

function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    tile: {
      width: "47%",
      backgroundColor: colors.base300,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 8,
      alignItems: "center",
    },
    valueRow: { flexDirection: "row", alignItems: "center", gap: 3 },
    iconWrap: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.base200,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
    },
    value: { fontFamily: fonts.bold, fontSize: 18, color: colors.primary },
    label: {
      fontFamily: fonts.medium,
      fontSize: 9.5,
      color: colors.placeholder,
      marginTop: 4,
      letterSpacing: 0.3,
      textAlign: "center",
    },
    caption: { fontSize: 8.5, lineHeight: 12, color: colors.placeholder, marginTop: 5, textAlign: "center" },
  });
}
