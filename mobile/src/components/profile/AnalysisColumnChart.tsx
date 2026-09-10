import { useEffect, useMemo } from "react";
import { Animated, Easing, View, Text, Pressable, StyleSheet } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import type { ColorPalette } from "../../theme/palettes";
import { fonts } from "../../theme/typography";

const CHART_HEIGHT = 116;
const COLUMN_STAGGER_MS = 55;
const GROW_DURATION_MS = 520;
// A column with a real (non-zero) value never renders as nothing — without a
// floor, a month with one rating is a 1px sliver that reads as "no data."
const MIN_VISIBLE_HEIGHT = 4;

export interface ChartColumn {
  // Stable identity for selection — the visible label may repeat or be
  // localized, so it can't double as a key.
  key: string;
  label: string;
  value: number;
  // The tallest bar. Marked with a small dot ABOVE the column rather than a
  // brighter fill: full-accent used to mean "peak", and selecting any other
  // bar turned it full-accent too, so the two states were indistinguishable.
  // Fill brightness now means selection and nothing else.
  highlight?: boolean;
}

interface Props {
  columns: ChartColumn[];
  accent: string;
  // Sticky on the caller's side: the columns grow once, the first time the
  // card is reached, then stay put on later visits.
  active: boolean;
  // Pass both to make columns tappable — selecting one reveals the titles
  // behind that bucket below the chart.
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
}

// Vertical bar chart shared by the two Premium cards (Rating Curve and Watch
// Timeline) — both are "a value per bucket, in a fixed order," which a
// horizontal bar list reads poorly for: rating 1-10 and Jan-Jun are
// sequences, and a sequence belongs on an x-axis.
export default function AnalysisColumnChart({ columns, accent, active, selectedKey, onSelect }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const max = Math.max(...columns.map((c) => c.value), 1);

  const columnsKey = columns.map((c) => `${c.key}:${c.value}`).join("|");
  const anims = useMemo(() => columns.map(() => new Animated.Value(0)), [columnsKey]);

  useEffect(() => {
    if (!active) return;
    const animation = Animated.stagger(
      COLUMN_STAGGER_MS,
      anims.map((v) =>
        Animated.timing(v, {
          toValue: 1,
          duration: GROW_DURATION_MS,
          easing: Easing.out(Easing.cubic),
          // Bar height isn't native-drivable.
          useNativeDriver: false,
        })
      )
    );
    animation.start();
    return () => animation.stop();
  }, [active, anims]);

  return (
    <View>
      <View style={styles.plot}>
        {columns.map((column, i) => {
          const target = column.value > 0 ? Math.max((column.value / max) * CHART_HEIGHT, MIN_VISIBLE_HEIGHT) : 0;
          const isSelected = selectedKey === column.key;
          // An empty bucket has nothing to reveal, so it stays inert rather
          // than offering a tap that opens an empty row.
          const selectable = Boolean(onSelect) && column.value > 0;
          return (
            <Pressable
              key={column.key}
              style={styles.columnWrap}
              onPress={selectable ? () => onSelect?.(column.key) : undefined}
              disabled={!selectable}
            >
              <Animated.Text style={[styles.columnValue, isSelected && { color: accent }, { opacity: anims[i] }]}>
                {column.value > 0 ? column.value : ""}
              </Animated.Text>
              {/* Peak marker. A dot, not a brighter bar — brightness is
                  reserved for "this is the one you tapped". */}
              <View style={[styles.peakDot, column.highlight ? { backgroundColor: accent } : styles.peakDotHidden]} />
              <Animated.View
                style={[
                  styles.column,
                  {
                    height: anims[i].interpolate({ inputRange: [0, 1], outputRange: [0, target] }),
                    backgroundColor: isSelected ? accent : `${accent}59`,
                  },
                ]}
              />
              <Text style={[styles.columnLabel, isSelected && { color: accent, fontFamily: fonts.bold }]} numberOfLines={1}>
                {column.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    plot: { flexDirection: "row", alignItems: "flex-end", gap: 5 },
    columnWrap: { flex: 1, alignItems: "center" },
    columnValue: { fontFamily: fonts.bold, fontSize: 9.5, color: colors.placeholder, marginBottom: 2, height: 13 },
    // Always laid out (just transparent when not the peak) so no column is
    // 4px taller than its neighbours purely for having the marker.
    peakDot: { width: 4, height: 4, borderRadius: 2, marginBottom: 3 },
    peakDotHidden: { backgroundColor: "transparent" },
    column: { width: "100%", borderRadius: 5, minHeight: 0 },
    columnLabel: { fontSize: 9, color: colors.placeholder, marginTop: 6, textAlign: "center" },
  });
}
