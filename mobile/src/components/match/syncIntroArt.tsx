import { useEffect, useRef, useState } from "react";
import { Animated, Image, Text, View, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, RadialGradient, Stop } from "react-native-svg";
import { TIER_FRAME_STYLES } from "../../theme/tierFrames";
import { fonts } from "../../theme/typography";
import { getPopularThisWeek } from "../../api/feedService";
import type { PopularThisWeekItem } from "../../types";

// The 3 small hand-built animated illustrations behind the "Sync Your
// Taste -> Meet Your Match -> Watch Together" pitch — shared between
// SyncIntroStory.tsx (the full-screen, one-time first-visit takeover) and
// SyncIntroCard.tsx (the compact, always-visible, endlessly-looping return-
// visit card), direct ask: "reklam sayfasına geçtikten sonraki o altta
// duran kartı da aynı bununla değiştir... kart içi otomatik bu 3 geçişi
// yapsın." Each accepts a `scale` multiplier (1 = the story's own full
// size) rather than hardcoding two separate sets of dimensions, so both
// call sites stay visually identical in everything but overall size.
//
// Fixed, non-palette colors (not this device's current one of the app's 9
// theme palettes) — same reasoning app/_layout.tsx's own boot screen
// already establishes for a deliberately-composed branded moment that
// shouldn't vary with whichever palette is active.
export const BG = "#0A0A10";
export const GOLD = TIER_FRAME_STYLES.premium!.gradient;
export const TEAL = "#3FD6C8";
export const ON_GOLD = "#2B1E00";

export type SlideKey = "sync" | "match" | "watch";
export const SLIDES: SlideKey[] = ["sync", "match", "watch"];

const POSTER_BASE = "https://image.tmdb.org/t/p/w342";

// --- Slide 1: two tastes merging --------------------------------------------

export function SyncSlideArt({ scale = 1 }: { scale?: number }) {
  const pulseA = useRef(new Animated.Value(0)).current;
  const pulseB = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, { toValue: 1, duration: 1400, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      );
    const a = loop(pulseA, 0);
    const b = loop(pulseB, 250);
    a.start();
    b.start();
    const s = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true }));
    s.start();
    return () => {
      a.stop();
      b.stop();
      s.stop();
    };
  }, [pulseA, pulseB, spin]);

  const scaleA = pulseA.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const scaleB = pulseB.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const SIZE = 220 * scale;
  const R = 78 * scale;
  const OFFSET = 20 * scale;
  const BADGE = 56 * scale;

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ position: "absolute", left: OFFSET, transform: [{ scale: scaleA }] }}>
        <Svg width={R * 2} height={R * 2}>
          <Defs>
            <RadialGradient id="syncCircleA" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={GOLD[1]} stopOpacity={0.45} />
              <Stop offset="1" stopColor={GOLD[1]} stopOpacity={0.05} />
            </RadialGradient>
          </Defs>
          <Circle cx={R} cy={R} r={R - 2} fill="url(#syncCircleA)" stroke={GOLD[1]} strokeOpacity={0.5} strokeWidth={1.5} />
        </Svg>
      </Animated.View>
      <Animated.View style={{ position: "absolute", right: OFFSET, transform: [{ scale: scaleB }] }}>
        <Svg width={R * 2} height={R * 2}>
          <Defs>
            <RadialGradient id="syncCircleB" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={TEAL} stopOpacity={0.45} />
              <Stop offset="1" stopColor={TEAL} stopOpacity={0.05} />
            </RadialGradient>
          </Defs>
          <Circle cx={R} cy={R} r={R - 2} fill="url(#syncCircleB)" stroke={TEAL} strokeOpacity={0.5} strokeWidth={1.5} />
        </Svg>
      </Animated.View>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <View
          style={{
            width: BADGE,
            height: BADGE,
            borderRadius: BADGE / 2,
            backgroundColor: BG,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.15)",
          }}
        >
          <Ionicons name="sync" size={26 * scale} color="#fff" />
        </View>
      </Animated.View>
    </View>
  );
}

// --- Slide 2: match percentage ring -----------------------------------------

export function MatchSlideArt({ scale = 1 }: { scale?: number }) {
  const SIZE = 180 * scale;
  const STROKE = 10 * scale;
  const R = (SIZE - STROKE) / 2;
  const AVATAR_OFFSET = 34 * scale;
  // The ring's own circumference, at THIS instance's actual scaled radius —
  // not a fixed module-level constant, since a smaller/larger ring (the
  // compact card vs. the full-screen story) needs a correspondingly
  // smaller/larger dash length, or the "fill" animation would under/overshoot
  // the ring's real circle.
  const circumference = 2 * Math.PI * R;

  const fill = useRef(new Animated.Value(0)).current;
  const avatarsIn = useRef(new Animated.Value(0)).current;
  const [dashOffset, setDashOffset] = useState(circumference);
  const [percentText, setPercentText] = useState(0);

  useEffect(() => {
    const id = fill.addListener(({ value }) => {
      setDashOffset(circumference * (1 - value));
      setPercentText(Math.round(value * 94));
    });
    Animated.sequence([
      Animated.timing(avatarsIn, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(fill, { toValue: 1, duration: 1400, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
    return () => fill.removeListener(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          position: "absolute",
          left: -AVATAR_OFFSET,
          opacity: avatarsIn,
          transform: [{ translateX: avatarsIn.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }],
        }}
      >
        <AvatarGlyph tint={GOLD[1]} scale={scale} />
      </Animated.View>
      <Animated.View
        style={{
          position: "absolute",
          right: -AVATAR_OFFSET,
          opacity: avatarsIn,
          transform: [{ translateX: avatarsIn.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        }}
      >
        <AvatarGlyph tint={TEAL} scale={scale} />
      </Animated.View>

      <Svg width={SIZE} height={SIZE}>
        <Defs>
          <SvgLinearGradient id="matchRingGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={GOLD[0]} />
            <Stop offset="1" stopColor={TEAL} />
          </SvgLinearGradient>
        </Defs>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="rgba(255,255,255,0.1)" strokeWidth={STROKE} fill="none" />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke="url(#matchRingGradient)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 34 * scale, color: "#fff" }}>{percentText}%</Text>
      </View>
    </View>
  );
}

function AvatarGlyph({ tint, scale }: { tint: string; scale: number }) {
  const SIZE = 52 * scale;
  return (
    <View
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        backgroundColor: `${tint}26`,
        borderWidth: 1.5,
        borderColor: tint,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name="person" size={24 * scale} color={tint} />
    </View>
  );
}

// --- Slide 3: two posters, real trending data -------------------------------

export function WatchSlideArt({ scale = 1 }: { scale?: number }) {
  const [movie, setMovie] = useState<PopularThisWeekItem | null>(null);
  const [series, setSeries] = useState<PopularThisWeekItem | null>(null);
  const slideA = useRef(new Animated.Value(0)).current;
  const slideB = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    getPopularThisWeek(1, "movie")
      .then((r) => setMovie(r[0] ?? null))
      .catch(() => {});
    getPopularThisWeek(1, "series")
      .then((r) => setSeries(r[0] ?? null))
      .catch(() => {});
    Animated.parallel([
      Animated.spring(slideA, { toValue: 1, friction: 7, tension: 50, useNativeDriver: true }),
      Animated.spring(slideB, { toValue: 1, friction: 7, tension: 50, delay: 90, useNativeDriver: true }),
    ]).start();
  }, [slideA, slideB]);

  const POSTER_W = 108 * scale;
  const POSTER_H = 162 * scale;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          width: POSTER_W,
          height: POSTER_H,
          borderRadius: 14 * scale,
          overflow: "hidden",
          backgroundColor: "#1a1a22",
          marginRight: -18 * scale,
          transform: [
            { translateX: slideA.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) },
            { rotate: "-6deg" },
          ],
          opacity: slideA,
          borderWidth: 2,
          borderColor: GOLD[1],
          zIndex: 1,
        }}
      >
        {movie?.content.poster_path && (
          <Image source={{ uri: `${POSTER_BASE}${movie.content.poster_path}` }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        )}
      </Animated.View>
      <Animated.View
        style={{
          width: POSTER_W,
          height: POSTER_H,
          borderRadius: 14 * scale,
          overflow: "hidden",
          backgroundColor: "#1a1a22",
          transform: [
            { translateX: slideB.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) },
            { rotate: "6deg" },
          ],
          opacity: slideB,
          borderWidth: 2,
          borderColor: TEAL,
        }}
      >
        {series?.content.poster_path && (
          <Image source={{ uri: `${POSTER_BASE}${series.content.poster_path}` }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        )}
      </Animated.View>
    </View>
  );
}
