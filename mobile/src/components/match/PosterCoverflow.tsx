import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  Pressable,
  Text,
  View,
  StyleSheet,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
// Same fix as PosterRow.tsx: this row nests inside MatchAnalysisPanel's own
// card-paging ScrollView (same horizontal axis) — a plain RN ScrollView loses
// the drag gesture to the outer one.
import { ScrollView as GHScrollView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import type { LightweightContent } from "../../api/contentService";
import { useTheme } from "../../context/ThemeContext";
import type { PosterBadge } from "./PosterRow";
import { fonts } from "../../theme/typography";

// Animated.event(..., {useNativeDriver:true}) returns the raw AnimatedEvent
// object, not a callable function — RN's own base ScrollView._handleScroll
// does `this.props.onScroll(e)` unconditionally, so passing that object as
// onScroll straight to gesture-handler's (un-Animated) ScrollView throws
// "Object is not a function" the instant a scroll event fires (confirmed live
// on-device). Animated.createAnimatedComponent is what actually knows how to
// __attach a native-driven AnimatedEvent to the underlying native view
// instead of trying to call it as JS — the same wrapping RN's own
// Animated.ScrollView applies to the plain ScrollView it's built on.
const AnimatedGHScrollView = Animated.createAnimatedComponent(GHScrollView);

const POSTER_BASE = "https://image.tmdb.org/t/p/w200";
const ASPECT_RATIO = 126 / 84; // matches PosterRow.tsx's own poster proportions
const SIDE_RATIO = 0.3;
// Kept modest relative to SIDE_RATIO/GAP below — see the non-overlap check.
const CENTER_RATIO = 0.35;
// Fixed breathing room between posters, on top of their own size. At rest
// this alone would keep neighbors apart, but the CENTERED poster grows past
// its own slot (that's the coverflow effect) — CENTER_RATIO is deliberately
// kept small enough that even at full growth (centerW = sideW + 2*GAP would
// be the exact touching point) it stays under that bound across the realistic
// viewport range (up to ~432, MatchAnalysisPanel's own widest card), so
// posters never actually touch even mid-scroll, not just at rest.
const GAP = 14;

interface Props {
  items: LightweightContent[];
  badgeFor?: (item: LightweightContent) => PosterBadge | null;
  // null reports "resting on the leading empty slot" — only reachable when
  // leadingEmptySlot is true.
  onFocusChange: (id: string | null) => void;
  // Off by default (MatchActivityFeed.tsx's own usage, unchanged) — when
  // on (MatchSharedFavorites.tsx, the Shared Genres card), the row rests on
  // a genuine blank slot before item 0 instead of auto-focusing it, the
  // same "nothing selected at rest, matches the tap-based fallback's own
  // idle state" convention MatchVarietyRings.tsx's GenreCoverflow already
  // established — so a caller can show the same "tap/scroll to see
  // details" hint regardless of whether it's showing the <3-item fallback
  // row or this coverflow, instead of the coverflow jumping straight to
  // item 0's detail with no equivalent hint state at all.
  leadingEmptySlot?: boolean;
}

// Center-focused "coverflow" carousel: the centered poster renders larger,
// each neighbor only half-visible at the row's edges and smaller — sizing is
// measured off the row's own available width (not hardcoded), so
// CENTER_W + SIDE_W === viewportWidth by construction: the centered poster
// fully visible plus exactly one side poster's width split as a half-peek on
// each edge. Scaling is transform-only (no layout width/height animated),
// driven by the scroll position continuously, so the next poster visibly
// grows as it approaches center rather than snapping to size only on settle.
export default function PosterCoverflow({ items, badgeFor, onFocusChange, leadingEmptySlot = false }: Props) {
  const { colors } = useTheme();
  const [viewportWidth, setViewportWidth] = useState(0);
  // Mirrors focusedIndexRef, but as real state — only used to paint the
  // currently-centered poster on top of its neighbors (zIndex), since RN's
  // default array-order stacking gets the paint order backwards when
  // scrolling toward a lower index (the shrinking item would otherwise
  // render on top of the one growing into focus). -1 (only reachable with
  // leadingEmptySlot) means the empty slot itself is centered.
  const [centerIndex, setCenterIndex] = useState(leadingEmptySlot ? -1 : 0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const focusedIndexRef = useRef(leadingEmptySlot ? -1 : 0);
  const scrollRef = useRef<any>(null);
  // How many pitch-widths every item is shifted by — a real leading slot
  // (a plain blank View, same width as any other) rendered before `items`
  // below, not a manual offset computed by hand — normal flex flow then
  // places item i at content position (i+1)*pitch for free, the same
  // technique MatchVarietyRings.tsx's GenreCoverflow uses for its own
  // leading empty slot.
  const slotOffset = leadingEmptySlot ? 1 : 0;

  const sideW = viewportWidth * SIDE_RATIO;
  const centerW = viewportWidth * CENTER_RATIO;
  const centerH = centerW * ASPECT_RATIO;
  const sideH = sideW * ASPECT_RATIO;
  // Slot pitch (distance between item centers) — bigger than the poster's own
  // width, so at-rest neighbors sit with visible breathing room instead of
  // touching edge-to-edge.
  const pitch = sideW + GAP;

  const onLayout = (e: LayoutChangeEvent) => setViewportWidth(e.nativeEvent.layout.width);

  // Tapping a poster that's already visible (centered, or only peeking in
  // from the side) jumps straight to it instead of requiring an actual
  // scroll gesture — the listener below still reports whichever slot ends
  // up centered the same way regardless of how it got there.
  const goToIndex = (i: number) => {
    scrollRef.current?.scrollTo({ x: (i + slotOffset) * pitch, animated: true });
  };

  // Committing focus (React state, plus the onFocusChange call that drives
  // the parent's detail panel) on every intermediate scroll frame — the
  // previous approach, via a continuous scrollX listener — meant a fast
  // fling through a long list (100+ shared titles) fired that state update,
  // and the re-render it drives in the parent, once per frame: visibly
  // unable to keep up with the gesture on a long list. The centered
  // poster's own grow/shrink (the `scale` interpolation below) stays fully
  // native-driven off scrollX regardless, so it's just as smooth mid-flick;
  // only the *committed* focus (and therefore the detail panel) now waits
  // for the scroll to actually settle before updating, so a fast flick
  // through many items commits once, right when it stops, instead of many
  // times while it's still moving.
  const commitFocus = (idx: number) => {
    if (idx !== focusedIndexRef.current) {
      focusedIndexRef.current = idx;
      setCenterIndex(idx);
      onFocusChange(idx === -1 ? null : items[idx]._id);
    }
  };

  const handleScrollSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pitch === 0 || items.length === 0) return;
    const rawIdx = Math.round(e.nativeEvent.contentOffset.x / pitch) - slotOffset;
    const idx = Math.max(leadingEmptySlot ? -1 : 0, Math.min(items.length - 1, rawIdx));
    commitFocus(idx);
  };

  // Fresh item list (e.g. a different candidate) — rest back on whichever
  // slot the scroll position (still 0 on a fresh mount) actually sits on:
  // the leading empty slot when there is one, item 0 otherwise.
  useEffect(() => {
    focusedIndexRef.current = leadingEmptySlot ? -1 : 0;
    setCenterIndex(leadingEmptySlot ? -1 : 0);
    if (leadingEmptySlot) {
      onFocusChange(null);
    } else if (items.length > 0) {
      onFocusChange(items[0]._id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => i._id).join(","), leadingEmptySlot]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { width: "100%" },
        row: { alignItems: "center" },
        item: { alignItems: "center", justifyContent: "center" },
        posterBorder: { borderRadius: 10, borderWidth: 2, borderColor: "transparent", overflow: "hidden" },
        poster: { backgroundColor: colors.base300 },
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
    <View style={styles.wrap} onLayout={onLayout}>
      {viewportWidth > 0 && (
        <AnimatedGHScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={pitch}
          decelerationRate="fast"
          contentContainerStyle={[styles.row, { paddingHorizontal: (viewportWidth - pitch) / 2, height: centerH }]}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
          scrollEventThrottle={16}
          onMomentumScrollEnd={handleScrollSettle}
          onScrollEndDrag={handleScrollSettle}
        >
          {leadingEmptySlot && <View style={{ width: pitch, height: centerH }} />}
          {items.map((item, i) => {
            const itemPos = (i + slotOffset) * pitch;
            const scale = scrollX.interpolate({
              inputRange: [itemPos - pitch, itemPos, itemPos + pitch],
              outputRange: [1, centerW / sideW, 1],
              extrapolate: "clamp",
            });
            const badge = badgeFor?.(item);
            return (
              <View key={item._id} style={[styles.item, { width: pitch, height: centerH, zIndex: i === centerIndex ? 10 : 0 }]}>
                <Pressable onPress={() => goToIndex(i)}>
                  <Animated.View style={{ transform: [{ scale }] }}>
                    <View style={[styles.posterBorder, { width: sideW, height: sideH }]}>
                      {item.poster_path ? (
                        <Image source={{ uri: `${POSTER_BASE}${item.poster_path}` }} style={[styles.poster, { width: sideW, height: sideH }]} />
                      ) : (
                        <View style={[styles.poster, { width: sideW, height: sideH }]} />
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
                  </Animated.View>
                </Pressable>
              </View>
            );
          })}
        </AnimatedGHScrollView>
      )}
    </View>
  );
}
