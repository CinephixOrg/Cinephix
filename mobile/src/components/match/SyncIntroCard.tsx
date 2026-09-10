import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, View, Text, Pressable, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import { useRevealAnimation } from "../../hooks/useRevealAnimation";
import { getPopularThisWeek } from "../../api/feedService";
import type { PopularThisWeekItem } from "../../types";

const POSTER_BASE = "https://image.tmdb.org/t/p/w342";
const SLIDE_MS = 4200;
const FADE_MS = 450;

interface Props {
  onStart: () => void;
  // False on return visits (rendered below the filters, no CTA to press —
  // already dismissed once) — true only on the genuine first-ever visit.
  showButton?: boolean;
}

interface Highlight {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}

// Icon + label, staggering in one at a time — same technique
// AnimatedInsightList already uses for a small revealing list (Animated.
// stagger, 70ms apart, translateY+opacity), just inlined rather than
// reused: that component is built around one shared icon/color for every
// row, and these three each need their own icon, not worth generalizing
// it for a single one-off caller.
function HighlightItem({ icon, label, delay, color }: Highlight & { delay: number; color: string }) {
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 320,
      delay,
      useNativeDriver: true,
    }).start();
  }, [anim, delay]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        item: { flex: 1, alignItems: "center", gap: 8 },
        iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
        label: { fontSize: 11.5, fontFamily: fonts.medium, color: colors.baseContent, textAlign: "center" },
      }),
    [colors]
  );

  return (
    <Animated.View
      style={[
        styles.item,
        { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${color}1A` }]}>
        <Ionicons name={icon} size={19} color={color} />
      </View>
      <Text style={styles.label}>{label}</Text>
    </Animated.View>
  );
}

type BannerSlide = { kind: "poster"; posterPath?: string; caption: string } | { kind: "globe"; caption: string };

// An auto-advancing, fading "ad banner" — direct ask for something that
// reads as a real advertisement rather than a static card: a trending
// movie poster fading in with one caption, then a trending series poster
// with another, then a stylized "world map" slide (a globe glyph with a
// few scattered profile dots standing in for a real cartographic map —
// drawing actual continent outlines from real geographic path data wasn't
// a realistic scope for a decorative onboarding slide) with a "your
// cinema soulmate" style tagline. Movie/series posters are real, live data
// (getPopularThisWeek) rather than hand-picked titles, so this banner
// always reflects what's actually trending in this app right now instead
// of two names that could go stale.
function BannerSlides({ colors }: { colors: ReturnType<typeof useTheme>["colors"] }) {
  const { t } = useTranslation();
  const [movie, setMovie] = useState<PopularThisWeekItem | null>(null);
  const [series, setSeries] = useState<PopularThisWeekItem | null>(null);

  useEffect(() => {
    getPopularThisWeek(1, "movie")
      .then((r) => setMovie(r[0] ?? null))
      .catch(() => {});
    getPopularThisWeek(1, "series")
      .then((r) => setSeries(r[0] ?? null))
      .catch(() => {});
  }, []);

  const slides: BannerSlide[] = useMemo(() => {
    const list: BannerSlide[] = [];
    if (movie) list.push({ kind: "poster", posterPath: movie.content.poster_path, caption: t("See if you watch similar movies or genres!") });
    if (series) list.push({ kind: "poster", posterPath: series.content.poster_path, caption: t("Start a must-watch series together!") });
    list.push({ kind: "globe", caption: t("Your cinema soulmate might be closer than you think.") });
    return list;
  }, [movie, series, t]);

  const [slideIndex, setSlideIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() => {
        setSlideIndex((i) => (i + 1) % slides.length);
        Animated.timing(fade, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
      });
    }, SLIDE_MS);
    return () => clearInterval(id);
  }, [slides.length, fade]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        banner: {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: colors.base300,
          borderRadius: 14,
          padding: 12,
          marginTop: 18,
          minHeight: 88,
        },
        poster: { width: 56, height: 84, borderRadius: 8, backgroundColor: colors.base200 },
        globeWrap: { width: 56, height: 84, alignItems: "center", justifyContent: "center" },
        dot: { position: "absolute", width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
        caption: { flex: 1, fontSize: 12.5, fontFamily: fonts.medium, color: colors.baseContent, lineHeight: 17 },
      }),
    [colors]
  );

  const slide = slides[slideIndex];
  if (!slide) return null;

  return (
    <Animated.View style={[styles.banner, { opacity: fade }]}>
      {slide.kind === "poster" ? (
        slide.posterPath ? (
          <Image source={{ uri: `${POSTER_BASE}${slide.posterPath}` }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={styles.poster} />
        )
      ) : (
        <View style={styles.globeWrap}>
          <Ionicons name="globe-outline" size={44} color={colors.placeholder} />
          <View style={[styles.dot, { top: 8, left: 4 }]} />
          <View style={[styles.dot, { top: 30, right: 2 }]} />
          <View style={[styles.dot, { bottom: 10, left: 14 }]} />
        </View>
      )}
      <Text style={styles.caption}>{slide.caption}</Text>
    </Animated.View>
  );
}

const BUTTON_HEIGHT = 50;

// A one-time pitch for Sync, shown full-width above the filters on the
// viewer's very first-ever visit only — after that (STORAGE_KEYS.
// SYNC_INTRO_SEEN, match/index.tsx) this same component instead renders in
// the empty space below the filters on every return visit, `showButton`
// false since there's nothing left to "start." Redesigned to read as a
// real ad banner (BannerSlides above) rather than a static pitch card,
// direct ask ("daha estetik ve reklamsal durmalı").
export default function SyncIntroCard({ onStart, showButton = true }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { opacity, translateY } = useRevealAnimation("intro");

  const highlights: Highlight[] = [
    { icon: "speedometer-outline", label: t("Match Score") },
    { icon: "heart-outline", label: t("Shared Favorites") },
    { icon: "chatbubbles-outline", label: t("Conversation Starters") },
  ];
  const highlightColors = [colors.primary, colors.accent, colors.secondary];

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: colors.base200,
          borderRadius: 16,
          paddingVertical: 22,
          paddingHorizontal: 20,
          marginHorizontal: 16,
          marginTop: 8,
        },
        iconBadge: { alignSelf: "center", marginBottom: 12 },
        headline: { fontFamily: fonts.bold, fontSize: 19, color: colors.baseContent, textAlign: "center" },
        highlightsRow: { flexDirection: "row", marginTop: 22 },
        buttonWrap: { alignSelf: "center", marginTop: 22, borderRadius: BUTTON_HEIGHT / 2, overflow: "hidden" },
        button: {
          height: BUTTON_HEIGHT,
          paddingHorizontal: 30,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        },
        buttonText: { color: "#fff", fontFamily: fonts.bold, fontSize: 16, letterSpacing: 0.3 },
      }),
    [colors]
  );

  return (
    <Animated.View style={[styles.card, { opacity, transform: [{ translateY }] }]}>
      <Ionicons name="planet-outline" size={30} color={colors.primary} style={styles.iconBadge} />
      <Text style={styles.headline}>{t("Find Your Cinephix Buddy")}</Text>

      <BannerSlides colors={colors} />

      <View style={styles.highlightsRow}>
        {highlights.map((h, i) => (
          <HighlightItem key={h.label} icon={h.icon} label={h.label} delay={i * 90} color={highlightColors[i]} />
        ))}
      </View>

      {showButton && (
        <Pressable style={styles.buttonWrap} onPress={onStart}>
          <Svg width="100%" height={BUTTON_HEIGHT} style={{ position: "absolute" }}>
            <Defs>
              <LinearGradient id="syncIntroButtonGradient" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={colors.primary} />
                <Stop offset="1" stopColor={colors.secondary} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height={BUTTON_HEIGHT} fill="url(#syncIntroButtonGradient)" />
          </Svg>
          <View style={styles.button}>
            <Text style={styles.buttonText}>{t("Get Started")}</Text>
            <Ionicons name="arrow-forward" size={17} color="#fff" />
          </View>
        </Pressable>
      )}
    </Animated.View>
  );
}
