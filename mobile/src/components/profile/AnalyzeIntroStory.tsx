import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import Pressable from "../common/TapSafePressable";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import GradientIcon from "../GradientIcon";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

// A full-screen, Instagram-story-style takeover for the viewer's very
// first-ever tap on the Profile header's Analyze icon — direct ask,
// "aynı syncdeki gibi hikayeli tanıtım," same mechanics as
// SyncIntroStory.tsx (progress bar, auto-advance, tap-left/right zones,
// a final CTA) reused deliberately rather than reinvented, including that
// same file's ambient per-slide glow (direct follow-up report: a flat
// theme background alone read as less polished than Sync's own) — same
// two soft radial gradients, just tinted with this app's own theme colors
// instead of Sync's hardcoded gold/teal, so it still can't mismatch
// against a light theme. GradientIcon "art" instead of bespoke per-slide
// SVG illustrations stays a deliberate difference (lighter-weight, reuses
// the same gradient-glyph language the header's own Analyze icon already
// established). Every subsequent tap skips straight to AnalyzeInfoModal —
// see profile/index.tsx's own AnalyzeIntroStory + AnalyzeInfoModal pairing
// for that "once per account, ever" gate (SecureStore, same per-user-keyed
// convention as Sync's own intro).
const SLIDE_MS = 4200;
const SLIDE_COUNT = 3;

interface Props {
  // Direct follow-up ask: the final slide's CTA now starts the real
  // analysis itself (same call AnalyzeInfoModal's own confirm button
  // makes) rather than just dismissing into that same info box one more
  // time — so `onFinish` is awaited, not fired-and-forgotten, while this
  // button shows `statusMessage` in its place.
  onFinish: () => void | Promise<void>;
  // useAnalyzeProfile.ts's own rotating "still working" line + its
  // cross-fade opacity (direct follow-up ask: a bare spinner read as
  // "stuck/maybe broken" during the real network wait) — owned by the
  // parent (profile/index.tsx), which is what actually calls that hook,
  // since `onFinish` here routes back into its own `runAnalysis`.
  statusMessage: string;
  statusOpacity: Animated.Value;
}

export default function AnalyzeIntroStory({ onFinish, statusMessage, statusOpacity }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const progress = useRef(Array.from({ length: SLIDE_COUNT }, () => new Animated.Value(0))).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;

  const isLast = index === SLIDE_COUNT - 1;

  const goTo = (next: number) => {
    if (next === index) return;
    Animated.sequence([
      Animated.timing(contentOpacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(contentOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    setIndex(next);
  };
  const goNext = () => {
    if (index < SLIDE_COUNT - 1) goTo(index + 1);
  };
  const goBack = () => {
    if (index > 0) goTo(index - 1);
  };

  useEffect(() => {
    progress.forEach((pv, i) => {
      if (i < index) pv.setValue(1);
      else if (i > index) pv.setValue(0);
    });
    if (isLast) {
      progress[index].setValue(1);
      return;
    }
    progress[index].setValue(0);
    const anim = Animated.timing(progress[index], { toValue: 1, duration: SLIDE_MS, easing: Easing.linear, useNativeDriver: false });
    anim.start(({ finished }) => {
      if (finished) goTo(index + 1);
    });
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Headlines for slides 1-2 deliberately reuse the real card titles
  // (ProfileAnalysisCardDeck.tsx's own "Cinematic Persona"/"Genre
  // Breakdown") rather than new phrasing — same words the viewer will
  // actually see once they analyze, already translated everywhere.
  const slides = [
    {
      icon: "color-wand" as const,
      kicker: t("STEP {{n}}", { n: 1 }),
      headline: t("Cinematic Persona"),
      sub: t("An AI-written take on your taste, built from your own ratings — not a generic label."),
    },
    {
      icon: "pie-chart" as const,
      kicker: t("STEP {{n}}", { n: 2 }),
      headline: t("Genre Breakdown"),
      sub: t("See which genres you actually watch the most, visualized — and how that's shifted recently."),
    },
    {
      icon: "trending-up" as const,
      kicker: t("STEP {{n}}", { n: 3 }),
      headline: t("Track How You Change"),
      sub: t("All-time stats, monthly trends, and (on Premium) your full rating curve over time."),
    },
  ];
  const current = slides[index];

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.base100 },
        progressRow: { flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingTop: insets.top + 10 },
        progressTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.border, overflow: "hidden" },
        progressFill: { height: "100%", backgroundColor: colors.primary },
        content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
        iconWrap: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", backgroundColor: colors.base200, marginBottom: 24 },
        kicker: { fontFamily: fonts.bold, fontSize: 11.5, letterSpacing: 2, color: colors.primary, marginBottom: 14 },
        headline: { fontFamily: fonts.bold, fontSize: 26, color: colors.baseContent, textAlign: "center" },
        sub: { fontFamily: fonts.medium, fontSize: 14, color: colors.placeholder, textAlign: "center", marginTop: 10, lineHeight: 20, maxWidth: 300 },
        ctaArea: { paddingHorizontal: 24, paddingBottom: insets.bottom + 20, alignItems: "center" },
        buttonWrap: { width: "100%", borderRadius: 27, overflow: "hidden" },
        button: { height: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
        buttonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 16, letterSpacing: 0.3 },
        tapZones: { flexDirection: "row" },
        tapZoneLeft: { width: "35%" },
        tapZoneRight: { width: "65%" },
      }),
    [colors, insets.top, insets.bottom]
  );

  const handlePress = async () => {
    setSubmitting(true);
    try {
      await onFinish();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Ambient per-slide glow, same two-circle layout SyncIntroStory.tsx
          uses — primary in the upper-left, secondary in the lower-right,
          both low-opacity so they read as a soft tint rather than a
          second background. */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="analyzeGlow1" cx="30%" cy="18%" r="45%">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={0.16} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="analyzeGlow2" cx="78%" cy="75%" r="45%">
            <Stop offset="0" stopColor={colors.secondary} stopOpacity={0.14} />
            <Stop offset="1" stopColor={colors.secondary} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="30%" cy="18%" r="45%" fill="url(#analyzeGlow1)" />
        <Circle cx="78%" cy="75%" r="45%" fill="url(#analyzeGlow2)" />
      </Svg>

      <View style={styles.progressRow}>
        {slides.map((_, i) => (
          <View key={i} style={styles.progressTrack}>
            <Animated.View
              style={[styles.progressFill, { width: progress[i].interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]}
            />
          </View>
        ))}
      </View>

      <Animated.View style={[styles.content, { opacity: contentOpacity }]}>
        <Text style={styles.kicker}>{current.kicker}</Text>
        <View style={styles.iconWrap}>
          <GradientIcon name={current.icon} size={40} colors={[colors.primary, colors.secondary]} />
        </View>
        <Text style={styles.headline}>{current.headline}</Text>
        <Text style={styles.sub}>{current.sub}</Text>
      </Animated.View>

      {isLast && (
        <View style={styles.ctaArea}>
          <Pressable style={styles.buttonWrap} onPress={handlePress} disabled={submitting}>
            <LinearGradient colors={[colors.primary, colors.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.button}>
              {submitting ? (
                <Animated.Text style={[styles.buttonText, { opacity: statusOpacity }]} numberOfLines={1}>
                  {statusMessage}
                </Animated.Text>
              ) : (
                <>
                  <Text style={styles.buttonText}>{t("Analyze Now")}</Text>
                  <Ionicons name="arrow-forward" size={17} color={colors.primaryContent} />
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      )}

      {/* Tap-to-advance zones — same 170px reserve above the CTA area on
          the last slide as SyncIntroStory.tsx's own, so a tap meant for
          the button/arrow never gets intercepted. */}
      <View style={[StyleSheet.absoluteFill, styles.tapZones, { bottom: isLast ? 170 : 0 }]} pointerEvents="box-none">
        <Pressable style={styles.tapZoneLeft} onPress={goBack} />
        <Pressable style={styles.tapZoneRight} onPress={goNext} />
      </View>
    </View>
  );
}
