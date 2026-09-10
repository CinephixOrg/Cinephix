import { useMemo } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

// Same gold/silver/bronze medal colors as LeaderboardCard.tsx/
// PeoplePodiumCard.tsx — duplicated here rather than imported, matching
// this app's own established convention for this exact small constant
// (already independently copied in both of those files).
const MEDAL_COLORS = { 1: "#FFC94A", 2: "#C7CBD1", 3: "#CD7F32" } as const;
const MEDAL_HIGHLIGHT_COLORS = { 1: "#FFF3C4", 2: "#F2F3F5", 3: "#F0C08A" } as const;
const FRAME_RADIUS = 8;
const STROKE_WIDTH = 3;
// An SVG stroke straddles its own path — half its own width renders
// *outside* the path's nominal bounds. The previous version tried to fix
// this with `overflow:"visible"` on the Svg alone (the same technique
// TierGradientText.tsx/MatchTitleBadge.tsx use), but that turned out not
// to be enough here — real, reported clipping remained, especially on the
// ad page's smaller frames. Fixed properly instead: the Svg canvas itself
// is now genuinely larger than the visible circle/poster (extends
// STROKE_MARGIN px past it on every side, via negative left/right/top/
// bottom below), and the Rect is drawn with fixed pixel insets (not the
// old percentage-based ones) so its stroke's own outer edge — path ±
// STROKE_WIDTH/2 — always lands comfortably inside that larger canvas.
// No longer relies on overflow:"visible" actually doing anything (kept
// anyway, purely defensive, in case a platform's SVG renderer still
// clips a same-bounds canvas despite the style).
const STROKE_MARGIN = 4;

interface Props {
  rank: 1 | 2 | 3;
  // "poster" matches LeaderboardCard's 2:3 rectangle, "circle" matches
  // PeoplePodiumCard's round avatar frame — same two shapes this app's
  // real podium cards already use, just with nothing inside.
  shape: "poster" | "circle";
  size: number;
  // Optional — mirrors the real LeaderboardCard's own metricRow icon
  // (star for favorited, gift for recommended), placed the same distance
  // below the platform line, just without the count next to it (nothing
  // real to show). `metricIconOpacity` lets a parent cross-fade just this
  // icon between two metric types on a timer (e.g. LeaderboardPodium's own
  // Free-tier ad page alternating star ⇄ gift) without re-animating the
  // frame itself, which stays static.
  metricIcon?: keyof typeof Ionicons.glyphMap;
  metricIconOpacity?: Animated.Value | Animated.AnimatedInterpolation<number>;
}

// The empty "frame only" podium slot used by LeaderboardPodium.tsx's and
// PeoplePodium.tsx's own Free-tier ad pages — same rank-medal gradient-
// stroke ring + rank badge + platform line as the real
// LeaderboardCard/PeoplePodiumCard, just with a blank placeholder fill
// instead of a real poster/avatar and no name/metric text underneath.
// Exists specifically so the Free-tier podium teaser never has to blur a
// real image or number to hide it (blurring still leaves the name/metric
// readable underneath, the exact reported problem) — there's simply no
// real data rendered into an unfilled slot at all.
export default function PodiumSkeletonSlot({ rank, shape, size, metricIcon, metricIconOpacity }: Props) {
  const { colors } = useTheme();
  const medalColor = MEDAL_COLORS[rank];
  const highlightColor = MEDAL_HIGHLIGHT_COLORS[rank];
  const isCircle = shape === "circle";
  const gradientId = `podiumSkeletonGradient-${shape}-${rank}`;
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { alignItems: "center", width: size },
        shapeWrap: { position: "relative" },
        shapeFill: isCircle
          ? { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.base300 }
          : { width: size, aspectRatio: 2 / 3, borderRadius: FRAME_RADIUS, backgroundColor: colors.base300 },
        // Extends STROKE_MARGIN px past shapeFill's own bounds on every
        // side (negative insets on an absolutely-positioned element sized
        // off its relatively-positioned parent) — see STROKE_MARGIN's own
        // comment above for why.
        frameSvg: { position: "absolute", left: -STROKE_MARGIN, right: -STROKE_MARGIN, top: -STROKE_MARGIN, bottom: -STROKE_MARGIN, overflow: "visible" },
        // Circle badges center on the avatar's own top edge (matching
        // PeoplePodiumCard's rankBadge exactly); poster badges sit in the
        // top-left corner (matching LeaderboardCard's rankBadge exactly) —
        // a corner reads fine on a rectangle but looks off-axis on a circle.
        rankBadge: isCircle
          ? { position: "absolute", top: -9, left: "50%", marginLeft: -10 }
          : { position: "absolute", top: -6, left: -6 },
        rankBadgeInner: {
          minWidth: 20,
          height: 20,
          paddingHorizontal: 4,
          borderRadius: 10,
          backgroundColor: medalColor,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 2,
          borderColor: colors.base100,
        },
        rankBadgeText: { color: "#3d2b00", fontSize: 10, fontFamily: fonts.bold },
        platformLine: { width: size, height: 5, borderRadius: 3, backgroundColor: medalColor, marginTop: 8 },
        metricIconWrap: { marginTop: 6, alignItems: "center" },
      }),
    [colors, isCircle, medalColor, size]
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.shapeWrap}>
        <View style={styles.shapeFill} />
        <Svg style={styles.frameSvg} pointerEvents="none">
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={highlightColor} />
              <Stop offset="1" stopColor={medalColor} />
            </LinearGradient>
          </Defs>
          <Rect
            x={STROKE_MARGIN}
            y={STROKE_MARGIN}
            width={size}
            height={isCircle ? size : size * 1.5}
            rx={isCircle ? size / 2 : FRAME_RADIUS}
            stroke={`url(#${gradientId})`}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
        </Svg>
        <View style={styles.rankBadge}>
          <View style={styles.rankBadgeInner}>
            <Text style={styles.rankBadgeText}>{rank}</Text>
          </View>
        </View>
      </View>
      <View style={styles.platformLine} />
      {metricIcon && (
        <Animated.View style={[styles.metricIconWrap, metricIconOpacity != null && { opacity: metricIconOpacity }]}>
          <Ionicons name={metricIcon} size={13} color={colors.warning} />
        </Animated.View>
      )}
    </View>
  );
}
