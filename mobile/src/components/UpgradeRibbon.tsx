import { useMemo } from "react";
import { Text, StyleSheet } from "react-native";
import Pressable from "./common/TapSafePressable";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";
import { mix } from "../utils/color";

interface Props {
  onPress: () => void;
  // Absolute width/height every caller shares (Sync's own filter card, both
  // podium ad pages) — kept fixed rather than measured, since a diagonal
  // ribbon's own visual balance depends on this staying the same everywhere
  // it appears, not on the longest translated "Upgrade" string.
  width?: number;
  // Positive = clockwise (banner reads bottom-left to top-right, the
  // classic "top-right corner" ribbon) — callers pass a negative angle for
  // a top-left corner instead.
  angle?: number;
}

const RIBBON_HEIGHT = 26;

/**
 * Where a top-right corner ribbon goes, for its caller's absolute wrapper.
 * Turned 38°, the ribbon's left end rises towards the top edge, and its text
 * with it: placed higher, the first letter was cut off by the edge. Here the
 * whole word sits inside the box and its centre — the ribbon's ends still
 * run off the top and right edges, as a corner ribbon's do.
 */
export const RIBBON_TOP_RIGHT = { position: "absolute", top: 18, right: -31 } as const;

// A corner "sale banner"-style ribbon, not a regular button — direct ask,
// replacing every plain Upgrade badge/button this app had (Sync's own
// filter card, both Discover/Media podium ad pages) with the same diagonal
// treatment. In the theme's primary colour, like the app's other primary
// actions (it was Premium's gold, which didn't fit the rest of the design),
// with a lighter band through the middle — the "dark → bright → dark" shine
// TierGradientText.tsx uses for Plus's name — so it reads as something other
// than a plain button. Every caller renders this inside its own
// `position:"absolute"` wrapper (RIBBON_TOP_RIGHT) — this component only owns
// the banner's own look + rotation.
export default function UpgradeRibbon({ onPress, width = 130, angle = 38 }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          width,
          height: RIBBON_HEIGHT,
          transform: [{ rotate: `${angle}deg` }],
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        },
        fill: { flex: 1, alignItems: "center", justifyContent: "center" },
        // A fixed line height with Android's extra font padding gone, so the
        // capitals sit in the band's true middle.
        text: {
          color: colors.primaryContent,
          fontFamily: fonts.bold,
          fontSize: 12,
          lineHeight: 15,
          letterSpacing: 0.4,
          includeFontPadding: false,
          textAlignVertical: "center",
        },
      }),
    [width, angle, colors]
  );

  return (
    <Pressable style={styles.wrap} onPress={onPress} accessibilityRole="button">
      <LinearGradient
        colors={[colors.primary, mix(colors.primary, "#ffffff", 0.35), colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.fill}
      >
        <Text style={styles.text}>{t("Upgrade").toLocaleUpperCase()}</Text>
      </LinearGradient>
    </Pressable>
  );
}
