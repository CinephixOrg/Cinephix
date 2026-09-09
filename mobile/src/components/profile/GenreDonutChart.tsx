import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import Svg, { G, Circle } from "react-native-svg";
import { genreColor } from "../match/CineMatchGenreRing";
import { useTheme } from "../../context/ThemeContext";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Per-segment entrance: each arc grows outward from nothing to full stroke
// width, one after the next, so the ring assembles itself rather than
// appearing fully formed. Stroke width (not arc length) is what animates —
// react-native-svg has no animatable dash-length path, and "petals thicken
// into place" reads better than a wipe anyway.
const GROW_STAGGER_MS = 90;
const GROW_DURATION_MS = 420;
// How much wider the selected arc sits than its neighbours — enough to read
// as "this one," not so much that the ring stops looking like a ring.
const SELECTED_EXTRA_WIDTH = 7;

interface Segment {
  genre: string;
  count: number;
  // Overrides the generated per-index hue — used for the aggregate "Other"
  // slice, which is a leftover rather than a genre and shouldn't be dressed
  // up in a genre color.
  color?: string;
}

interface Props {
  segments: Segment[];
  bgLuminance: number;
  // Card is the one currently on screen — replays the entrance every time
  // the deck swipes back to it, so it never feels like a static image.
  active: boolean;
  selectedIndex?: number | null;
  size?: number;
  strokeWidth?: number;
}

// A real per-genre donut, not a decorative one — each ring segment's arc
// length is literally `count / total` of the circle, the same numbers the
// legend beside it prints. Built with stacked <Circle> strokes (the standard
// "dasharray as a fraction of circumference, dashoffset to stagger the
// start" technique) rather than <Path> arcs — simpler math for a chart
// that's always a full 360° of contiguous segments, no partial arcs needed.
export default function GenreDonutChart({
  segments,
  bgLuminance,
  active,
  selectedIndex = null,
  size = 168,
  strokeWidth = 24,
}: Props) {
  const { colors } = useTheme();
  const radius = (size - strokeWidth - SELECTED_EXTRA_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.count, 0) || 1;

  const arcs = useMemo(() => {
    let cumulative = 0;
    return segments.map((seg, i) => {
      const fraction = seg.count / total;
      const dashLength = fraction * circumference;
      // Negative offset walks the dash pattern's start point forward
      // (clockwise) around the circle by however much of it prior segments
      // already claimed.
      const dashOffset = -cumulative * circumference;
      cumulative += fraction;
      return {
        genre: seg.genre,
        color: seg.color ?? genreColor(i, segments.length, bgLuminance),
        dashArray: `${dashLength} ${circumference}`,
        dashOffset,
      };
    });
  }, [segments, total, circumference, bgLuminance]);

  // Rebuilt whenever the segment set itself changes (not just its length) —
  // same reasoning as AnimatedInsightList's own anims: this chart isn't
  // remounted between analyses, so a fixed-size ref would go stale and, if a
  // later analysis had more genres, index out of bounds.
  const segmentsKey = segments.map((s) => s.genre).join("|");
  const grow = useMemo(() => segments.map(() => new Animated.Value(0)), [segmentsKey]);
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    entrance.setValue(0);
    grow.forEach((v) => v.setValue(0));
    Animated.parallel([
      Animated.spring(entrance, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
      Animated.stagger(
        GROW_STAGGER_MS,
        grow.map((v) =>
          Animated.timing(v, {
            toValue: 1,
            duration: GROW_DURATION_MS,
            easing: Easing.out(Easing.cubic),
            // SVG props can't ride the native driver.
            useNativeDriver: false,
          })
        )
      ),
    ]).start();
  }, [active, grow, entrance]);

  // The hole is left empty on purpose — the caller overlays its own label
  // there so it can cross-fade on selection without restarting this ring's
  // entrance animation.
  const styles = useMemo(
    () => StyleSheet.create({ wrap: { alignItems: "center", justifyContent: "center", width: size, height: size } }),
    [size]
  );

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          opacity: entrance,
          transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) }],
        },
      ]}
    >
      <Svg width={size} height={size}>
        {/* Rotated -90deg so the first segment starts at 12 o'clock instead
            of SVG's default 3 o'clock — reads as a clock face, matching how
            every other percentage ring in this app (and elsewhere) starts. */}
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.base300} strokeWidth={strokeWidth} fill="none" />
          {arcs.map((a, i) => (
            <AnimatedCircle
              key={a.genre}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={a.color}
              strokeWidth={grow[i].interpolate({
                inputRange: [0, 1],
                outputRange: [0, i === selectedIndex ? strokeWidth + SELECTED_EXTRA_WIDTH : strokeWidth],
              })}
              strokeDasharray={a.dashArray}
              strokeDashoffset={a.dashOffset}
              opacity={selectedIndex === null || i === selectedIndex ? 1 : 0.45}
              fill="none"
            />
          ))}
        </G>
      </Svg>
    </Animated.View>
  );
}
