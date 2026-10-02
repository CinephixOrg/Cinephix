import { memo, useEffect, useMemo } from "react";
import { Animated, Easing, View, Text, Image, StyleSheet } from "react-native";
import Pressable from "../common/TapSafePressable";
import { Ionicons } from "@expo/vector-icons";
// Plain RN ScrollView loses horizontal pan gestures to the outer card-paging
// ScrollView this row lives inside (same-axis nested scrolling is a known
// weak spot for RN's responder system) — gesture-handler's has proper native
// arbitration. Note this row renders inside a <Modal>, which is its own
// native window — common/GestureModal is what gives it a gesture root, since
// the app-root one doesn't reach in there.
import { ScrollView } from "react-native-gesture-handler";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { formatFiveScale } from "../../utils/rating";
import type { ProfileAnalysisItem } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import type { ColorPalette } from "../../theme/palettes";
import { fonts } from "../../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w200";
const POSTER_WIDTH = 82;
const POSTER_HEIGHT = 123;
// Right-edge fade into the card's own background — a deterministic "there's
// more, scroll →" affordance rather than hoping the item count happens to
// leave a partial poster showing at the edge.
const FADE_WIDTH = 30;
const ITEM_STAGGER_MS = 55;

interface Props {
  items: ProfileAnalysisItem[];
  // Unique per mounted instance: both poster rows in this deck are mounted
  // at once (cards stay mounted, just scrolled off-screen), and two
  // <LinearGradient> defs sharing one id in the same tree collide.
  gradientId: string;
  active: boolean;
  // Opens the title's own detail page. Omitted where returning to this modal
  // afterwards isn't wired up (see ProfileAnalysisModal's `navigable`), in
  // which case posters stay non-interactive rather than stranding the user
  // on a screen hidden behind an open Modal.
  onPressItem?: (item: ProfileAnalysisItem) => void;
  // "grid" wraps every item into rows instead of one horizontal strip —
  // what a card's "See all" toggle switches to, so the full set is visible
  // at once instead of hidden behind sideways scrolling.
  layout?: "row" | "grid";
}

// The real titles behind a card's percentages — posters, names, and (for
// anything rated) the score the user actually gave it. Deliberately its own
// component rather than match/PosterRow: this one carries a rating chip and
// its own staggered entrance, and PosterRow's 20px corner badge can't fit a
// half-star value like "4.5".
function AnalysisPosterRow({ items, gradientId, active, onPressItem, layout = "row" }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);

  const itemsKey = items.map((i) => i._id).join("|");
  const anims = useMemo(() => items.map(() => new Animated.Value(0)), [itemsKey]);

  useEffect(() => {
    if (!active) return;
    anims.forEach((v) => v.setValue(0));
    const animation = Animated.stagger(
      ITEM_STAGGER_MS,
      anims.map((v) =>
        Animated.timing(v, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true })
      )
    );
    animation.start();
    return () => animation.stop();
  }, [active, anims]);

  if (items.length === 0) return null;

  // Each poster slides in as it appears. The animation sits on the inner
  // view, so the tappable wrapper stays a plain Pressable (see
  // common/TapSafePressable.tsx).
  const posters = items.map((item, i) => (
    <Pressable key={item._id} onPress={onPressItem ? () => onPressItem(item) : undefined} disabled={!onPressItem}>
      <Animated.View
        style={[
          styles.item,
          {
            opacity: anims[i],
            transform: [{ translateX: anims[i].interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
          },
        ]}
      >
        <View style={styles.posterWrap}>
          {item.poster_path ? (
            <Image source={{ uri: `${POSTER_BASE}${item.poster_path}` }} style={styles.poster} />
          ) : (
            <View style={[styles.poster, styles.posterEmpty]}>
              <Ionicons name={item.type === "series" ? "tv-outline" : "film-outline"} size={20} color={colors.placeholder} />
            </View>
          )}
          {typeof item.rating === "number" && (
            <View style={styles.ratingChip}>
              <Ionicons name="star" size={9} color={colors.primaryContent} />
              <Text style={styles.ratingText}>{formatFiveScale(item.rating)}</Text>
            </View>
          )}
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {item.title ?? item.name}
        </Text>
      </Animated.View>
    </Pressable>
  ));

  // Wrapped grid: no horizontal scroller, so no edge fade either — there's
  // nothing off-screen left to hint at.
  if (layout === "grid") {
    return <View style={styles.grid}>{posters}</View>;
  }

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {posters}
      </ScrollView>

      <Svg width={FADE_WIDTH} height={POSTER_HEIGHT} style={styles.fade} pointerEvents="none">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.base200} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.base200} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={FADE_WIDTH} height={POSTER_HEIGHT} fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
}

// Memoized: the deck re-renders on every swipe and every selection change,
// and re-rendering a row of 20 posters (each with its own Animated style)
// for a card the user isn't even looking at is pure waste. Props are stable
// by construction — `items` comes from a memoized slice and `onPressItem` is
// a useCallback in ProfileAnalysisModal.
export default memo(AnalysisPosterRow);

function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    wrap: { position: "relative" },
    row: { flexDirection: "row", gap: 10 },
    // Centered, not flex-start: posters are a fixed 82px wide, so a row
    // almost never divides evenly into the card's content width and the
    // leftover was all piling up on the right, leaving the whole block
    // visibly shoved left of the heading above it. Centering splits that
    // remainder evenly, including on a short final row.
    grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10 },
    item: { width: POSTER_WIDTH },
    posterWrap: { width: POSTER_WIDTH, height: POSTER_HEIGHT, borderRadius: 10, overflow: "hidden" },
    poster: { width: POSTER_WIDTH, height: POSTER_HEIGHT, borderRadius: 10, backgroundColor: colors.base300 },
    posterEmpty: { alignItems: "center", justifyContent: "center" },
    ratingChip: {
      position: "absolute",
      left: 4,
      bottom: 4,
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    ratingText: { fontFamily: fonts.bold, fontSize: 9.5, color: colors.primaryContent },
    title: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.baseContent, marginTop: 6, textAlign: "center" },
    fade: { position: "absolute", right: 0, top: 0 },
  });
}
