import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View, Easing } from "react-native";
import Pressable from "../common/TapSafePressable";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { LinearGradient as ExpoLinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { fonts } from "../../theme/typography";
import AdBanner from "../ads/AdBanner";
import { AD_UNIT_IDS } from "../../constants/adUnitIds";
import { BG, GOLD, TEAL, ON_GOLD, SLIDES, type SlideKey, SyncSlideArt, MatchSlideArt, WatchSlideArt } from "./syncIntroArt";

// A full-screen, Instagram-story-style takeover for the viewer's very
// first-ever visit to Sync — replaces the earlier "pitch card above the
// filters" design entirely (SyncIntroCard.tsx now only ever renders on
// RETURN visits, inline below the filters, as its own compact, endlessly-
// looping version of these exact same 3 slides — see syncIntroArt.tsx,
// which both files share, for why the illustrations live there instead of
// in either file directly). Direct ask, twice: first "daha estetik ve
// reklamsal," then "kart tasarımından çıkartılıp tüm sayfaya yayılabilir...
// geçişler daha profesyonel olsun" — the card-based gold redesign still
// read as too small/contained, so this drops the card shape entirely for 3
// auto-advancing full-screen slides (Sync Your Taste -> Meet Your Match ->
// Watch Together), confirmed with the user before building: tap-to-advance
// + auto-advance only, no swipe gesture.

const SLIDE_MS = 4200;

interface Props {
  onFinish: () => void;
}

export default function SyncIntroStory({ onFinish }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const progress = useRef(SLIDES.map(() => new Animated.Value(0))).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;

  const isLast = index === SLIDES.length - 1;

  const goTo = (next: number) => {
    if (next === index) return;
    Animated.sequence([
      Animated.timing(contentOpacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(contentOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    setIndex(next);
  };
  const goNext = () => {
    if (index < SLIDES.length - 1) goTo(index + 1);
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

  const copy: Record<SlideKey, { kicker: string; headline: string; sub: string; art: React.ReactNode }> = {
    sync: {
      kicker: t("STEP {{n}}", { n: 1 }),
      headline: t("Sync Your Taste"),
      sub: t("We compare your ratings and genres with everyone else's to find real matches."),
      art: <SyncSlideArt />,
    },
    match: {
      kicker: t("STEP {{n}}", { n: 2 }),
      headline: t("Meet Your Match"),
      sub: t("See how many movies and shows you actually have in common."),
      art: <MatchSlideArt />,
    },
    watch: {
      kicker: t("STEP {{n}}", { n: 3 }),
      // Reuses the existing "Watch Together" key — same phrase, same
      // meaning, already translated everywhere from Sync's own shared-
      // watchlist card.
      headline: t("Watch Together"),
      sub: t("Start a conversation about what to watch next."),
      art: <WatchSlideArt />,
    },
  };

  const current = copy[SLIDES[index]];

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: BG },
        progressRow: { flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingTop: insets.top + 10 },
        progressTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)", overflow: "hidden" },
        progressFill: { height: "100%", backgroundColor: "#fff" },
        content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
        kicker: { fontFamily: fonts.bold, fontSize: 11.5, letterSpacing: 2, color: GOLD[1], marginBottom: 18 },
        headline: { fontFamily: fonts.bold, fontSize: 28, color: "#fff", textAlign: "center", marginTop: 26 },
        sub: { fontFamily: fonts.medium, fontSize: 14, color: "rgba(255,255,255,0.6)", textAlign: "center", marginTop: 10, lineHeight: 20, maxWidth: 300 },
        ctaArea: { paddingHorizontal: 24, paddingBottom: insets.bottom + 20, alignItems: "center" },
        buttonWrap: { width: "100%", borderRadius: 27, overflow: "hidden" },
        button: { height: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
        buttonText: { color: ON_GOLD, fontFamily: fonts.bold, fontSize: 16, letterSpacing: 0.3 },
        tapZones: { flexDirection: "row" },
        tapZoneLeft: { width: "35%" },
        tapZoneRight: { width: "65%" },
      }),
    [insets.top, insets.bottom]
  );

  return (
    <View style={styles.root}>
      {/* Ambient per-slide glow — deliberately the SAME two accent colors
          (gold/teal) across all 3 slides rather than a fresh palette per
          slide, so the whole story reads as one continuous experience; the
          glow's own position/size is what shifts per slide instead. */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="storyGlow1" cx="30%" cy="18%" r="45%">
            <Stop offset="0" stopColor={GOLD[1]} stopOpacity={0.16} />
            <Stop offset="1" stopColor={GOLD[1]} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="storyGlow2" cx="78%" cy="75%" r="45%">
            <Stop offset="0" stopColor={TEAL} stopOpacity={0.14} />
            <Stop offset="1" stopColor={TEAL} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="30%" cy="18%" r="45%" fill="url(#storyGlow1)" />
        <Circle cx="78%" cy="75%" r="45%" fill="url(#storyGlow2)" />
      </Svg>

      <View style={styles.progressRow}>
        {SLIDES.map((key, i) => (
          <View key={key} style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progress[i].interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                },
              ]}
            />
          </View>
        ))}
      </View>

      <Animated.View style={[styles.content, { opacity: contentOpacity }]}>
        <Text style={styles.kicker}>{current.kicker}</Text>
        {current.art}
        <Text style={styles.headline}>{current.headline}</Text>
        <Text style={styles.sub}>{current.sub}</Text>
      </Animated.View>

      {isLast && (
        <View style={styles.ctaArea}>
          <Pressable style={styles.buttonWrap} onPress={onFinish}>
            <ExpoLinearGradient colors={[GOLD[1], GOLD[0], GOLD[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.button}>
              <Text style={styles.buttonText}>{t("Get Started")}</Text>
              <Ionicons name="arrow-forward" size={17} color={ON_GOLD} />
            </ExpoLinearGradient>
          </Pressable>
          <AdBanner unitId={AD_UNIT_IDS.SYNC_INTRO_BANNER} />
        </View>
      )}

      {/* Tap-to-advance zones — stop short of the bottom CTA/ad area on the
          last slide (that area's own real height varies, this reserves a
          generous fixed estimate) so they never intercept a tap meant for
          the actual button/ad underneath. pointerEvents:"box-none" on the
          wrapper lets a tap pass through anywhere these two zones don't
          explicitly cover. */}
      <View style={[StyleSheet.absoluteFill, styles.tapZones, { bottom: isLast ? 170 : 0 }]} pointerEvents="box-none">
        <Pressable style={styles.tapZoneLeft} onPress={goBack} />
        <Pressable style={styles.tapZoneRight} onPress={goNext} />
      </View>
    </View>
  );
}
