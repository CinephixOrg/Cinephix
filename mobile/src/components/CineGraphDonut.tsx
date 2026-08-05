import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import type { CineGraphStats } from "../types";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

interface Props {
  title: string;
  stats: CineGraphStats;
}

// Same palette as frontend/src/components/CineGraph.jsx, so genre colors
// match between web and mobile.
const SLICE_COLORS = [
  "#34d399", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#3b82f6", // Blue
  "#a855f7", // Purple
  "#ec4899", // Pink
  "#6b7280", // Gray
  "#14b8a6", // Teal
];

const SIZE = 160;
const STROKE_WIDTH = 28;
const STROKE_WIDTH_SELECTED = 34;
const RADIUS = (SIZE - STROKE_WIDTH_SELECTED) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function CineGraphDonut({ title, stats }: Props) {
  const entries = Object.entries(stats);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  const [selected, setSelected] = useState<string | null>(null);

  const toggleSelected = (genre: string) => {
    setSelected((prev) => (prev === genre ? null : genre));
  };

  const centerLabel = selected
    ? { genre: selected, count: stats[selected], pct: ((stats[selected] / total) * 100).toFixed(1) }
    : null;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>

      {entries.length === 0 ? (
        <Text style={styles.empty}>No data for {title} yet.</Text>
      ) : (
        <>
          <View style={styles.chartRow}>
            <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <G rotation="-90" origin={`${SIZE / 2}, ${SIZE / 2}`}>
                {(() => {
                  let offset = 0;
                  return entries.map(([genre, count], i) => {
                    const sliceLength = (count / total) * CIRCUMFERENCE;
                    const dashArray = `${sliceLength} ${CIRCUMFERENCE - sliceLength}`;
                    const dashOffset = -offset;
                    offset += sliceLength;
                    const isSelected = selected === genre;
                    return (
                      <Circle
                        key={genre}
                        cx={SIZE / 2}
                        cy={SIZE / 2}
                        r={RADIUS}
                        stroke={SLICE_COLORS[i % SLICE_COLORS.length]}
                        strokeWidth={isSelected ? STROKE_WIDTH_SELECTED : STROKE_WIDTH}
                        strokeOpacity={selected && !isSelected ? 0.35 : 1}
                        strokeDasharray={dashArray}
                        strokeDashoffset={dashOffset}
                        fill="none"
                        onPress={() => toggleSelected(genre)}
                      />
                    );
                  });
                })()}
              </G>
            </Svg>
            <Text style={styles.centerLabel} pointerEvents="none">
              {centerLabel ? (
                <>
                  {centerLabel.genre}
                  {"\n"}
                  {centerLabel.count} · {centerLabel.pct}%
                </>
              ) : (
                <>
                  {total}
                  {"\n"}items
                </>
              )}
            </Text>
          </View>

          <View style={styles.legend}>
            {entries.map(([genre, count], i) => (
              <Pressable
                key={genre}
                style={[styles.legendRow, selected === genre && styles.legendRowSelected]}
                onPress={() => toggleSelected(genre)}
              >
                <View
                  style={[styles.swatch, { backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length] }]}
                />
                <Text style={styles.legendLabel} numberOfLines={1}>
                  {genre}
                </Text>
                <Text style={styles.legendValue}>
                  {count} · {((count / total) * 100).toFixed(1)}%
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 20, alignItems: "center", alignSelf: "stretch" },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.baseContent, marginBottom: 12 },
  empty: { color: colors.placeholder, fontSize: 13 },
  chartRow: { alignItems: "center", justifyContent: "center" },
  centerLabel: {
    position: "absolute",
    textAlign: "center",
    color: colors.baseContent,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  legend: { alignSelf: "stretch", marginTop: 16, gap: 4 },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  legendRowSelected: { backgroundColor: colors.base200 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, color: colors.baseContent, fontSize: 13 },
  legendValue: { color: colors.placeholder, fontSize: 12 },
});
