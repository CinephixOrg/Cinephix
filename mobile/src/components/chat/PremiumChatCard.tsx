import { memo, useMemo, useRef, type ReactNode } from "react";
import { Animated, Image, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Pressable from "../common/TapSafePressable";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import { localeUpper } from "../../utils/text";

type IconName = keyof typeof Ionicons.glyphMap;

// The card's own palette: always dark, whatever the app theme — these cards
// are pieces of media, like a poster on a wall, and have to read the same
// in every theme.
export const CARD = {
  white: "#FFFFFF",
  ink: "#0C0C12",
  gold: "#FBBF24",
  text: "rgba(255,255,255,0.72)",
  faint: "rgba(255,255,255,0.62)",
  line: "rgba(255,255,255,0.14)",
  glass: "rgba(0,0,0,0.38)",
  glassLine: "rgba(255,255,255,0.22)",
  chip: "rgba(255,255,255,0.12)",
} as const;

const MAX_WIDTH = 264;

/** A card's width: the recommendation card's, capped so it always fits a chat bubble's column. */
export function usePremiumCardWidth(): number {
  const { width } = useWindowDimensions();
  return Math.min(MAX_WIDTH, Math.round((width - 32) * 0.72));
}

// Type styles every card shares. Fixed colours, so built once rather than per
// render or per theme.
export const cardText = StyleSheet.create({
  title: { fontFamily: fonts.extrabold, fontSize: 16.5, lineHeight: 20.5, color: CARD.white, letterSpacing: -0.2 },
  meta: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: CARD.text, marginTop: 4 },
  body: { fontSize: 12.5, lineHeight: 17.5, color: CARD.faint },
  pillText: { fontFamily: fonts.bold, fontSize: 11.5, color: CARD.white },
  chipText: { fontFamily: fonts.bold, fontSize: 11, color: CARD.white },
});

const staticStyles = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, transform: [{ scale: 1.35 }] },
  topRow: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: CARD.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CARD.glassLine,
  },
  eyebrow: { fontFamily: fonts.bold, fontSize: 9.5, letterSpacing: 0.9, color: CARD.white, flexShrink: 1 },
  body: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 12, gap: 10, backgroundColor: CARD.ink },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 36, borderRadius: 12 },
  ctaText: { fontFamily: fonts.bold, fontSize: 13.5 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: CARD.chip },
});

/** A small glass pill for the card's top corners — a rating, a type. */
export function PremiumPill({ icon, iconColor = CARD.gold, text }: { icon: IconName; iconColor?: string; text: string }) {
  return (
    <View style={staticStyles.pill}>
      <Ionicons name={icon} size={11} color={iconColor} />
      <Text style={cardText.pillText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

/** Up to a few short labels as glass chips — genres, mostly. */
export function PremiumChips({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <View style={staticStyles.chips}>
      {items.map((item) => (
        <View key={item} style={staticStyles.chip}>
          <Text style={cardText.chipText} numberOfLines={1}>
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

interface Props {
  isOwn: boolean;
  /** The label in the top-left pill, uppercased for the app's language. */
  eyebrow: string;
  eyebrowIcon: IconName;
  eyebrowColor?: string;
  topRight?: ReactNode;
  /** An image to blur into the backdrop (a poster, an avatar). */
  backdropUri?: string | null;
  /** Colours the backdrop, and glows from its top-left corner — a match's tone, say. */
  accent?: string;
  heroHeight: number;
  /** Sits at the bottom of the backdrop area. */
  hero: ReactNode;
  /** Between the backdrop and the button. */
  body?: ReactNode;
  ctaLabel: string;
  ctaIcon?: IconName;
  onPress: () => void;
  /** Report / block, from a chat (ChatRoom passes it for other people's messages). */
  onLongPress?: () => void;
  accessibilityLabel: string;
}

/**
 * The shared look of every rich item in a chat — a recommended title, a
 * shared profile, a Sync, a CineGraph analysis: a dark card with a blurred
 * backdrop fading into ink, a label pill, whatever the item shows, and a
 * clear button. The sender's side is marked by the squared bottom corner,
 * as with every other message.
 *
 * Each item type only supplies its content; the frame, the press animation
 * and the button are all here, so a new shareable type matches the others
 * without copying any of them.
 */
function PremiumChatCard({
  isOwn,
  eyebrow,
  eyebrowIcon,
  eyebrowColor = CARD.gold,
  topRight,
  backdropUri,
  accent,
  heroHeight,
  hero,
  body,
  ctaLabel,
  ctaIcon = "arrow-forward",
  onPress,
  onLongPress,
  accessibilityLabel,
}: Props) {
  const { colors } = useTheme();
  const width = usePremiumCardWidth();
  const scale = useRef(new Animated.Value(1)).current;

  const frame = useMemo(
    () =>
      StyleSheet.create({
        card: {
          width,
          borderRadius: 20,
          overflow: "hidden",
          backgroundColor: CARD.ink,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: CARD.line,
          ...(isOwn ? { borderBottomRightRadius: 6 } : { borderBottomLeftRadius: 6 }),
        },
        // Clips the backdrop, which is scaled past its edges to hide the
        // blur's soft rim.
        hero: { height: heroHeight, justifyContent: "flex-end", overflow: "hidden" },
      }),
    [width, heroHeight, isOwn]
  );

  // Over a picture: darkening toward the bottom so white text always reads.
  // Without one: a deep colour of the card's own, from its accent if it has one.
  const gradient = useMemo(
    () =>
      backdropUri
        ? (["rgba(12,12,18,0.25)", "rgba(12,12,18,0.62)", CARD.ink] as const)
        : ([accent ? `${accent}3D` : "#2A2440", "#15131F", CARD.ink] as const),
    [backdropUri, accent]
  );

  const cta = useMemo(
    () => ({
      background: { backgroundColor: isOwn ? colors.primary : "rgba(255,255,255,0.12)" },
      color: isOwn ? colors.primaryContent : CARD.white,
    }),
    [isOwn, colors.primary, colors.primaryContent]
  );

  const pressTo = (value: number) =>
    Animated.spring(scale, { toValue: value, speed: 40, bounciness: value === 1 ? 6 : 0, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        style={frame.card}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        onPressIn={() => pressTo(0.97)}
        onPressOut={() => pressTo(1)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <View style={frame.hero}>
          {backdropUri ? <Image source={{ uri: backdropUri }} style={staticStyles.backdrop} blurRadius={12} resizeMode="cover" /> : null}
          <LinearGradient colors={gradient} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
          {accent ? (
            <LinearGradient
              colors={[`${accent}40`, `${accent}00`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.9, y: 0.8 }}
              style={StyleSheet.absoluteFill}
            />
          ) : null}

          <View style={staticStyles.topRow}>
            <View style={staticStyles.pill}>
              <Ionicons name={eyebrowIcon} size={11} color={eyebrowColor} />
              <Text style={staticStyles.eyebrow} numberOfLines={1}>
                {localeUpper(eyebrow)}
              </Text>
            </View>
            {topRight}
          </View>

          {hero}
        </View>

        <View style={staticStyles.body}>
          {body}
          <View style={[staticStyles.cta, cta.background]}>
            <Text style={[staticStyles.ctaText, { color: cta.color }]}>{ctaLabel}</Text>
            <Ionicons name={ctaIcon} size={15} color={cta.color} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default memo(PremiumChatCard);
