import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { fonts } from "../../theme/typography";
import { useRevealAnimation } from "../../hooks/useRevealAnimation";
import { BG, GOLD, SLIDES, type SlideKey, SyncSlideArt, MatchSlideArt, WatchSlideArt } from "./syncIntroArt";

const SLIDE_MS = 4200;
const ART_SCALE = 0.46;
// Reserves exactly as much room as the tallest of the 3 slides' own art
// (SyncSlideArt, at 220*ART_SCALE ≈ 101) and a generous text block (1-line
// headline + up to 2-line sub) — real bug, reported live: without a fixed
// reserved height per block, the card's own overall height changed on every
// slide transition (each slide's art/copy is a different natural size), a
// visible "jump" direct ask to get rid of. Centering each slide's actual
// (smaller) content inside these fixed blocks instead keeps the card's own
// outer size constant regardless of which slide is showing.
const ART_HEIGHT = 104;
const TEXT_HEIGHT = 78;

interface Props {
  // Unused now that the first-ever-visit case moved to SyncIntroStory.tsx
  // (a full-screen takeover, not this card) — kept for API stability, in
  // case this card ever needs a CTA of its own again.
  onStart?: () => void;
  showButton?: boolean;
}

// The return-visit version of Sync's own pitch — permanently visible below
// the filters/Sync button (direct ask, "hep orda durmalı"), so unlike
// SyncIntroStory.tsx's one-shot first-visit takeover, this never finishes:
// it endlessly loops the same 3 slides (Sync Your Taste -> Meet Your Match
// -> Watch Together) inside a compact card instead of 3 full screens.
// Direct ask, same day as the story itself shipped: "reklam sayfasına
// geçtikten sonraki o altta duran [kartı] da aynı bununla değiştir... kart
// içi otomatik bu 3 geçişi yapsın" — reuses syncIntroArt.tsx's own 3
// illustrations (shared with SyncIntroStory.tsx) at a smaller `scale`
// rather than a second hand-tuned set of dimensions, and the identical
// fixed, non-palette cinematic colors (BG/GOLD/TEAL) so this card reads as
// the same thing as the full-screen version, just contained. No progress
// bar here (a follow-up direct ask removed it — "otomatik geçiş yeterli,
// çizgiyi göstermeye gerek yok") — the story's own segmented bar made sense
// there as a real navigation/position cue across 3 one-time full screens;
// here, where it just loops forever in the background, auto-advance alone
// is enough.
export default function SyncIntroCard({ onStart: _onStart, showButton: _showButton }: Props) {
  const { t } = useTranslation();
  const { opacity: revealOpacity, translateY } = useRevealAnimation("intro");
  const [index, setIndex] = useState(0);
  const contentOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, SLIDE_MS);
    return () => clearInterval(id);
  }, []);

  // Cross-fade on every slide change — same technique SyncIntroStory.tsx
  // uses for its own transitions.
  useEffect(() => {
    Animated.sequence([
      Animated.timing(contentOpacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(contentOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [index, contentOpacity]);

  const art: Record<SlideKey, React.ReactNode> = {
    sync: <SyncSlideArt scale={ART_SCALE} />,
    match: <MatchSlideArt scale={ART_SCALE} />,
    watch: <WatchSlideArt scale={ART_SCALE} />,
  };
  const copy: Record<SlideKey, { headline: string; sub: string }> = {
    sync: { headline: t("Sync Your Taste"), sub: t("We compare your ratings and genres with everyone else's to find real matches.") },
    match: { headline: t("Meet Your Match"), sub: t("See how many movies and shows you actually have in common.") },
    // Reuses the existing "Watch Together" key — see SyncIntroStory.tsx's
    // own identical comment.
    watch: { headline: t("Watch Together"), sub: t("Start a conversation about what to watch next.") },
  };
  const currentKey = SLIDES[index];

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: BG,
          borderRadius: 20,
          paddingVertical: 20,
          paddingHorizontal: 20,
          marginHorizontal: 16,
          marginTop: 8,
          overflow: "hidden",
        },
        borderStroke: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
        artWrap: { height: ART_HEIGHT, alignItems: "center", justifyContent: "center" },
        textWrap: { height: TEXT_HEIGHT, alignItems: "center", justifyContent: "center" },
        headline: { fontFamily: fonts.bold, fontSize: 17, color: "#fff", textAlign: "center" },
        sub: { fontFamily: fonts.medium, fontSize: 12, color: "rgba(255,255,255,0.6)", textAlign: "center", marginTop: 6, lineHeight: 16 },
      }),
    []
  );

  return (
    <Animated.View style={[styles.card, { opacity: revealOpacity, transform: [{ translateY }] }]}>
      {/* Same thin gold-frame stroke technique as the full-screen story (and
          ShareCard.tsx's own premiumBorder before that). */}
      <Svg style={styles.borderStroke} pointerEvents="none">
        <Defs>
          <RadialGradient id="syncCardGlow" cx="50%" cy="0%" r="70%">
            <Stop offset="0" stopColor={GOLD[1]} stopOpacity={0.14} />
            <Stop offset="1" stopColor={GOLD[1]} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="50%" cy="0%" r="70%" fill="url(#syncCardGlow)" />
      </Svg>

      <Animated.View style={{ opacity: contentOpacity, alignItems: "center" }}>
        <View style={styles.artWrap}>{art[currentKey]}</View>
        <View style={styles.textWrap}>
          <Text style={styles.headline} numberOfLines={1}>
            {copy[currentKey].headline}
          </Text>
          <Text style={styles.sub} numberOfLines={2}>
            {copy[currentKey].sub}
          </Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}
