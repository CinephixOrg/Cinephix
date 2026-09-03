import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, View, Text, Pressable, StyleSheet } from "react-native";
import Svg, { Polygon, Line, Circle } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { CATEGORY_KEYS, categoryMeta } from "./matchCategoryMeta";
import { useRevealAnimation } from "../../hooks/useRevealAnimation";
import type { MatchBreakdown } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

const SIZE = 240;
const LABEL_PAD = 38;
const CENTER = SIZE / 2;
const MAX_RADIUS = CENTER - LABEL_PAD;
const GRID_LEVELS = [0.25, 0.5, 0.75, 1];
// Matches MatchAvatarRing's own fill-in pacing for this feature's other
// on-mount SVG reveal, so the two read as the same "family" of motion.
const FILL_MS = 700;
const DETAIL_REVEAL_MS = 480;
// Fixed height for the detail area below the chart, always reserved in
// layout (whether a category is active or not) so opening/closing/switching
// a category's description never shifts the chart above it — sized to
// comfortably fit the longest category description at SIZE's width.
const DETAIL_HEIGHT = 175;

// Per-category radius tweak for the axis labels — "Taste" (collaborative,
// straight up at the top) sat noticeably farther from the chart than felt
// right; the others are untouched. Mirrors the VERTICAL_NUDGE/HORIZONTAL_NUDGE
// per-item nudge pattern already established in CineMatchGenreRing.tsx.
const LABEL_RADIUS_NUDGE: Partial<Record<keyof MatchBreakdown, number>> = {
  collaborative: -10,
};

function angleFor(i: number) {
  return -Math.PI / 2 + i * ((2 * Math.PI) / CATEGORY_KEYS.length);
}

function polygonPoints(radiusFor: (i: number) => number) {
  return CATEGORY_KEYS.map((_, i) => {
    const a = angleFor(i);
    const r = radiusFor(i);
    return `${CENTER + r * Math.cos(a)},${CENTER + r * Math.sin(a)}`;
  }).join(" ");
}

interface Props {
  breakdown: MatchBreakdown;
}

// Custom-SVG radar/spider chart of the 5 weighted match categories — chosen
// over bars/rings deliberately (approved over the simpler alternative) for a
// more premium/professional read. Polygon's `points` string can't be handed
// an Animated.Value directly the way AnimatedCircle's numeric props can
// (MatchAvatarRing's approach), so the fill-in is driven by a plain
// useState progress mirrored off the Animated.Value via a listener — the
// same JS-thread-mirror technique already established in this feature
// (MatchCloudBubble's bobAnim -> lineBobAnim sync), just unthrottled since
// this is a single short one-shot mount animation, not a continuous idle one.
export default function MatchRadarChart({ breakdown }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<keyof MatchBreakdown | null>(null);
  const [progress, setProgress] = useState(0);
  const fillAnim = useRef(new Animated.Value(0)).current;
  // Re-plays every time a different category is tapped (not just on first
  // open) — a soft top-to-bottom fade rather than an instant swap, even
  // when going straight from one open category to another.
  const { opacity: detailOpacity, translateY: detailTranslateY } = useRevealAnimation(activeCategory, DETAIL_REVEAL_MS);
  // Starts visible (no category active on mount) — only animates on actual
  // null<->active transitions, not on every category switch, so it stays
  // hidden (not flickering back) while switching directly between two
  // active categories.
  const hintAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(hintAnim, {
      toValue: activeCategory ? 0 : 1,
      duration: DETAIL_REVEAL_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory === null]);

  useEffect(() => {
    fillAnim.setValue(0);
    const id = fillAnim.addListener(({ value }) => setProgress(value));
    Animated.timing(fillAnim, {
      toValue: 1,
      duration: FILL_MS,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
    return () => fillAnim.removeListener(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakdown.collaborative, breakdown.contentBased, breakdown.social, breakdown.diversity, breakdown.bonus]);

  const dataPoints = useMemo(
    () =>
      polygonPoints((i) => {
        const key = CATEGORY_KEYS[i];
        const pct = Math.max(0, Math.min(100, breakdown[key]));
        return (pct / 100) * MAX_RADIUS * progress;
      }),
    [breakdown, progress]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { alignItems: "center" },
        // A touch lower than dead-flush with the card title above it.
        box: { width: SIZE, height: SIZE, marginTop: 14 },
        label: { position: "absolute", alignItems: "center", justifyContent: "center" },
        labelText: { fontFamily: fonts.bold, fontSize: 12 },
        // Fixed-position divider between the chart and the reserved detail
        // area below it — a plain sibling, not part of detailReserve, so it
        // can never shift regardless of which of that reserve's states
        // (hint or a category's detail) is currently showing. Mirrors the
        // same divider MatchAnalysisPanel's Shared Genres card uses between
        // its poster row and its own detail reserve. Margins sum to the same
        // 10px the chart-to-reserve gap always was, so adding this line
        // doesn't move the detail/description content's own position at all.
        divider: { width: SIZE, height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginTop: 4, marginBottom: 5 },
        // Always mounted, fixed height — reserves the same vertical space
        // regardless of whether the hint or a category's detail is showing,
        // so neither the chart above nor anything else ever shifts as they
        // cross-fade in place inside it.
        detailReserve: { width: SIZE, height: DETAIL_HEIGHT, position: "relative" },
        // `bottom` trimmed (instead of the full absoluteFill's 0) so the
        // vertically-centered content sits a bit higher than dead-center —
        // matched on `detail` below so the hint and a category's detail
        // line up in the exact same spot as they cross-fade.
        hintWrap: { ...StyleSheet.absoluteFill, bottom: 42, alignItems: "center", justifyContent: "center" },
        hint: { fontSize: 11, fontStyle: "italic", color: colors.placeholder, textAlign: "center" },
        // Tied to SIZE (the SVG box's own width) rather than alignSelf:"stretch"
        // — the box is reliably centered by `wrap`'s alignItems:"center", so
        // matching its exact width and centering the same way keeps this
        // block aligned under it regardless of how wide the ScrollView this
        // whole chart sits inside ends up being. Absolutely fills the same
        // reserved area the hint occupies, so the two cross-fade in place.
        detail: {
          ...StyleSheet.absoluteFill,
          bottom: 42,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 10,
          backgroundColor: colors.base200,
          alignItems: "center",
          justifyContent: "center",
        },
        // Sits below MatchAnalysisPanel's own card-title text (its `sectionTitle`
        // style, ~15) — this needs to read as clearly one level down from that,
        // not compete with or exceed it.
        detailTitle: {
          fontFamily: fonts.bold,
          fontSize: 13,
          marginBottom: 6,
          textAlign: "center",
          textTransform: "uppercase",
          letterSpacing: 0.6,
        },
        detailDesc: { color: colors.baseContent, fontSize: 12.5, lineHeight: 18, textAlign: "center" },
        detailScore: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.placeholder, marginTop: 6, textAlign: "center" },
      }),
    [colors]
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.box}>
        <Svg width={SIZE} height={SIZE}>
          {GRID_LEVELS.map((level) => (
            <Polygon key={level} points={polygonPoints(() => level * MAX_RADIUS)} stroke={colors.border} strokeWidth={1} fill="none" />
          ))}
          {CATEGORY_KEYS.map((key, i) => {
            const a = angleFor(i);
            return (
              <Line
                key={key}
                x1={CENTER}
                y1={CENTER}
                x2={CENTER + MAX_RADIUS * Math.cos(a)}
                y2={CENTER + MAX_RADIUS * Math.sin(a)}
                stroke={colors.border}
                strokeWidth={1}
              />
            );
          })}
          <Polygon points={dataPoints} stroke={colors.primary} strokeWidth={2} fill={colors.primary} fillOpacity={0.25} />
          {CATEGORY_KEYS.map((key, i) => {
            const a = angleFor(i);
            const pct = Math.max(0, Math.min(100, breakdown[key]));
            const r = (pct / 100) * MAX_RADIUS * progress;
            const meta = categoryMeta(key, colors, t);
            return <Circle key={key} cx={CENTER + r * Math.cos(a)} cy={CENTER + r * Math.sin(a)} r={4} fill={meta.color} />;
          })}
        </Svg>

        {CATEGORY_KEYS.map((key, i) => {
          const a = angleFor(i);
          const labelR = MAX_RADIUS + LABEL_PAD * 0.72 + (LABEL_RADIUS_NUDGE[key] ?? 0);
          const meta = categoryMeta(key, colors, t);
          const isActive = activeCategory === key;
          return (
            <Pressable
              key={key}
              onPress={() => setActiveCategory(isActive ? null : key)}
              hitSlop={6}
              style={[styles.label, { left: CENTER + labelR * Math.cos(a) - 30, top: CENTER + labelR * Math.sin(a) - 12, width: 60 }]}
            >
              <Text style={[styles.labelText, { color: isActive ? meta.color : colors.placeholder }]}>{meta.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.divider} />

      <View style={styles.detailReserve}>
        <Animated.View style={[styles.hintWrap, { opacity: hintAnim }]} pointerEvents="none">
          <Text style={styles.hint}>{t("Tap a category to see its description.")}</Text>
        </Animated.View>

        {activeCategory && (
          <Animated.View
            style={[
              styles.detail,
              {
                opacity: detailOpacity,
                transform: [{ translateY: detailTranslateY }],
              },
            ]}
          >
            <Text style={[styles.detailTitle, { color: categoryMeta(activeCategory, colors, t).color }]}>
              {categoryMeta(activeCategory, colors, t).label}
            </Text>
            <Text style={styles.detailDesc}>{categoryMeta(activeCategory, colors, t).desc}</Text>
            <Text style={styles.detailScore}>{Math.round(breakdown[activeCategory])}%</Text>
          </Animated.View>
        )}
      </View>
    </View>
  );
}
