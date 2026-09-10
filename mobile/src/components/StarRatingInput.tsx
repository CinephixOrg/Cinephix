import { useMemo, useRef, useState } from "react";
import { View, PanResponder, StyleSheet } from "react-native";
import Svg, { Path, Defs, ClipPath, Rect } from "react-native-svg";
import { useTheme } from "../context/ThemeContext";
import type { ColorPalette } from "../theme/palettes";

// Matches frontend/src/components/StarRating.jsx: 5 stars displayed, but
// backed by the same 1-10 integer scale the backend validates
// (middleware/validation.js addRating: value 1-10). Each star covers two
// values — its left half is the odd (lower) value, its right half is the
// even (upper) value — so tapping/dragging gives half-star granularity.
interface Props {
  value: number; // 1-10
  onChange: (value: number) => void;
  disabled?: boolean;
  size?: number;
}

const STAR_COUNT = 5;
const GAP = 4;

// A chunkier 10-point star (inner/outer radius ratio ~0.41, fuller than a
// typical thin glyph) in a 24x24 viewBox, centered at (12,12), point up.
const STAR_PATH =
  "M12 1 L14.64 8.36 L22.46 8.6 L16.28 13.39 L18.47 20.9 L12 16.5 L5.53 20.9 L7.72 13.39 L1.54 8.6 L9.36 8.36 Z";

function buildStyles(size: number) {
  const totalWidth = STAR_COUNT * size + (STAR_COUNT - 1) * GAP;
  return StyleSheet.create({
    row: { flexDirection: "row", gap: GAP, alignSelf: "center", width: totalWidth },
    starWrap: { width: size, height: size },
  });
}

function Star({ fill, size, colors, clipId }: { fill: "full" | "half" | "empty"; size: number; colors: ColorPalette; clipId: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={STAR_PATH} fill={colors.border} />
      {fill !== "empty" && (
        <>
          <Defs>
            <ClipPath id={clipId}>
              <Rect x={0} y={0} width={fill === "half" ? 12 : 24} height={24} />
            </ClipPath>
          </Defs>
          <Path d={STAR_PATH} fill={colors.primary} clipPath={`url(#${clipId})`} />
        </>
      )}
    </Svg>
  );
}

export default function StarRatingInput({ value, onChange, disabled, size = 30 }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(size), [size]);
  const [liveValue, setLiveValue] = useState<number | null>(null);
  const displayValue = liveValue ?? value;

  // The PanResponder below is constructed exactly once (recreating it every
  // render risks interrupting an in-flight gesture) — but that means its
  // handlers close over whatever onChange/disabled/size were on that FIRST
  // render, forever. Since `onChange` here is ContentDetailScreen's
  // `handleRate`, redefined fresh every render (never memoized) and closing
  // over the *current* myRating/inWatchlist/ratingSaved, calling a
  // first-render-frozen copy of it meant every interaction after the very
  // first was evaluated against stale state — exactly the "presses star 5,
  // display goes wrong" symptom. Mirroring the latest values into a ref
  // (updated unconditionally every render) and having the handlers read
  // `stateRef.current` instead of closing over the props directly fixes
  // this without needing to recreate the PanResponder itself.
  const stateRef = useRef({ onChange, disabled, size });
  stateRef.current = { onChange, disabled, size };

  // Computes a 1-10 value directly from a touch X position local to the
  // row, rather than routing through per-star Pressables — lets a single
  // continuous drag sweep across all 5 stars and land precisely on either
  // half, which independent per-half tap targets (each widened by hitSlop
  // into its neighbor's territory right at the boundary that matters most)
  // couldn't do reliably. Purely positional — no dependency on any
  // *previous* value — so any single touch, forward or backward across the
  // row, already resolves correctly on its own.
  const computeValue = (x: number) => {
    const { size } = stateRef.current;
    const starSpan = size + GAP;
    const totalWidth = STAR_COUNT * size + (STAR_COUNT - 1) * GAP;
    const clampedX = Math.max(0, Math.min(x, totalWidth - 1));
    const starIndex = Math.min(STAR_COUNT - 1, Math.floor(clampedX / starSpan));
    const withinStar = clampedX - starIndex * starSpan;
    const isUpperHalf = withinStar >= size / 2;
    return starIndex * 2 + (isUpperHalf ? 2 : 1);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !stateRef.current.disabled,
      onMoveShouldSetPanResponder: () => !stateRef.current.disabled,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => setLiveValue(computeValue(evt.nativeEvent.locationX)),
      onPanResponderMove: (evt) => setLiveValue(computeValue(evt.nativeEvent.locationX)),
      onPanResponderRelease: (evt) => {
        const finalValue = computeValue(evt.nativeEvent.locationX);
        stateRef.current.onChange(finalValue);
        setLiveValue(null);
      },
    })
  ).current;

  return (
    <View style={styles.row} {...panResponder.panHandlers}>
      {Array.from({ length: STAR_COUNT }, (_, i) => {
        const leftValue = i * 2 + 1;
        const rightValue = i * 2 + 2;
        const fill = displayValue >= rightValue ? "full" : displayValue >= leftValue ? "half" : "empty";
        return (
          // key includes `fill`, not just the star's own index — same fix
          // as ShareCard.tsx's poll buttons (same bug class): react-native-
          // svg's <ClipPath>/<Rect> can leave a stale clip painted when only
          // the Rect's own width prop changes between renders (an in-place
          // half<->full<->empty update on a reused native SVG view), which
          // is exactly the reported bug — dragging across stars left some
          // of them showing an old fill state instead of the just-computed
          // one. Forcing a fresh native view per fill state, instead of
          // reusing/restyling one in place, guarantees no stale paint.
          <View key={`${i}-${fill}`} style={styles.starWrap} pointerEvents="none">
            <Star fill={fill} size={size} colors={colors} clipId={`star-half-clip-${i}`} />
          </View>
        );
      })}
    </View>
  );
}
