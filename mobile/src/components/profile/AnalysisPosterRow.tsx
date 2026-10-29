import { memo, useEffect, useMemo, useState } from "react";
import { Animated, Easing, View, Text, Image, type LayoutChangeEvent, StyleSheet } from "react-native";
import Pressable from "../common/TapSafePressable";
import { Ionicons } from "@expo/vector-icons";
import { formatFiveScale } from "../../utils/rating";
import type { ProfileAnalysisItem } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import type { ColorPalette } from "../../theme/palettes";
import { fonts } from "../../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w200";
const POSTER_ASPECT = 3 / 2; // height / width
const GRID_COLUMNS = 4;
const GRID_ROWS = 2;
const PAGE_SIZE = GRID_COLUMNS * GRID_ROWS;
const GRID_GAP = 10;
const ITEM_STAGGER_MS = 55;

interface Props {
  items: ProfileAnalysisItem[];
  active: boolean;
  // Opens the title's own detail page. Omitted where returning afterwards
  // isn't wired up, in which case posters stay non-interactive rather than
  // stranding the user on a screen hidden behind an open surface.
  onPressItem?: (item: ProfileAnalysisItem) => void;
}

// The real titles behind a card's percentages — posters and (for anything
// rated) the score the user actually gave it. A paginated grid (4 columns
// x 2 rows, <-/-> arrows below once there's more than one page) — direct
// ask, replacing the old horizontal-scrolling rail entirely: once the
// story/deck's own navigation between cards became a horizontal swipe
// gesture, a nested horizontal-scrolling rail inside a card was a real,
// same-axis gesture conflict with it. No name caption under each poster
// either, direct ask — just the poster and its rating chip. Deliberately
// its own component rather than match/PosterRow: this one carries a
// rating chip its own staggered entrance, and PosterRow's 20px corner
// badge can't fit a half-star value like "4.5".
function AnalysisPosterRow({ items, active, onPressItem }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);

  const [containerWidth, setContainerWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width);
  const posterWidth = containerWidth > 0 ? (containerWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS : 0;
  const posterHeight = posterWidth * POSTER_ASPECT;

  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  // Callers already key this whole component by selection (see each call
  // site in ProfileAnalysisCardDeck.tsx), so a fresh selection always
  // remounts it — page resetting to 0 on a new items set falls out of that
  // for free, no extra effect needed here.
  const [page, setPage] = useState(0);
  const visibleItems = items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const pageKey = visibleItems.map((i) => i._id).join("|");
  const anims = useMemo(() => visibleItems.map(() => new Animated.Value(0)), [pageKey]);

  useEffect(() => {
    if (!active) return;
    anims.forEach((v) => v.setValue(0));
    const animation = Animated.stagger(
      ITEM_STAGGER_MS,
      anims.map((v) => Animated.timing(v, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }))
    );
    animation.start();
    return () => animation.stop();
  }, [active, anims]);

  if (items.length === 0) return null;

  return (
    <View onLayout={onLayout}>
      {containerWidth > 0 && (
        <View style={styles.grid}>
          {visibleItems.map((item, i) => (
            <Pressable key={item._id} onPress={onPressItem ? () => onPressItem(item) : undefined} disabled={!onPressItem}>
              <Animated.View
                style={[
                  { width: posterWidth, opacity: anims[i] },
                  { transform: [{ translateY: anims[i].interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] },
                ]}
              >
                <View style={[styles.posterWrap, { width: posterWidth, height: posterHeight }]}>
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
              </Animated.View>
            </Pressable>
          ))}
        </View>
      )}

      {pageCount > 1 && (
        <View style={styles.pager}>
          <Pressable style={styles.pagerArrow} onPress={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} hitSlop={8}>
            <View style={[styles.pagerCircle, page === 0 && styles.pagerCircleDisabled]}>
              <Ionicons name="chevron-back" size={15} color={colors.baseContent} />
            </View>
          </Pressable>
          <Pressable
            style={styles.pagerArrow}
            onPress={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page === pageCount - 1}
            hitSlop={8}
          >
            <View style={[styles.pagerCircle, page === pageCount - 1 && styles.pagerCircleDisabled]}>
              <Ionicons name="chevron-forward" size={15} color={colors.baseContent} />
            </View>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// Memoized: the deck/story re-renders on every swipe and every selection
// change, and re-rendering a grid of posters (each with its own Animated
// style) for a card the user isn't even looking at is pure waste. Props
// are stable by construction — `items` comes from a memoized slice and
// `onPressItem` is a useCallback at the caller.
export default memo(AnalysisPosterRow);

function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    // Centered, not flex-start: the final row is rarely a full 4 wide, and
    // centering splits that remainder evenly instead of piling it on one
    // side.
    grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: GRID_GAP },
    posterWrap: { borderRadius: 10, overflow: "hidden", position: "relative" },
    poster: { width: "100%", height: "100%", backgroundColor: colors.base300 },
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
    pager: { flexDirection: "row", justifyContent: "center", gap: 20, marginTop: 10 },
    pagerArrow: { padding: 2 },
    pagerCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.placeholder + "29",
      alignItems: "center",
      justifyContent: "center",
    },
    pagerCircleDisabled: { opacity: 0.35 },
  });
}
