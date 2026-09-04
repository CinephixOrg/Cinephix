import { useEffect, useMemo, useRef } from "react";
import { Animated, View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import { useRevealAnimation } from "../../hooks/useRevealAnimation";

interface Props {
  onStart: () => void;
}

const BUTTON_HEIGHT = 50;

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

// A one-time pitch for Sync, shown above the actual filter/search UI only
// until the viewer taps through it once (match/index.tsx persists that via
// SecureStore, STORAGE_KEYS.SYNC_INTRO_SEEN) — after that this never
// appears again and MatchFilterStrip is what greets a return visit
// immediately, same as before this existed. Deliberately a single static
// card, not a multi-step carousel or anything with continuous motion: the
// only animation is a one-shot reveal on mount (useRevealAnimation, the
// same fade+slide this whole feature already uses elsewhere) plus the
// three highlight icons staggering in once — enough to not read as a dead
// screenshot, nowhere near enough to feel like an onboarding tour.
export default function SyncIntroCard({ onStart }: Props) {
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
        subtext: { fontSize: 13.5, color: colors.placeholder, textAlign: "center", lineHeight: 19, marginTop: 8 },
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
      <Text style={styles.headline}>{t("Find Your Cinema Match")}</Text>
      <Text style={styles.subtext}>
        {t("See how your taste lines up with someone else's — a compatibility score, shared favorites, and conversation starters, all in one place.")}
      </Text>

      <View style={styles.highlightsRow}>
        {highlights.map((h, i) => (
          <HighlightItem key={h.label} icon={h.icon} label={h.label} delay={i * 90} color={highlightColors[i]} />
        ))}
      </View>

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
    </Animated.View>
  );
}
