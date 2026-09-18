import { useMemo } from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { TIER_FRAME_STYLES } from "../theme/tierFrames";
import { fonts } from "../theme/typography";

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

// A corner "sale banner"-style ribbon, not a regular button — direct ask,
// replacing every plain Upgrade badge/button this app had (Sync's own
// filter card, both Discover/Media podium ad pages) with the same diagonal
// treatment. The gold gradient is Premium's own TIER_FRAME_STYLES pair
// (matching the avatar ring + ShareCard's gold post-frame), with a bright
// center stop added — the same "dark → bright → dark" shine-sweep 3-stop
// technique TierGradientText.tsx already uses for Plus's own name gradient,
// just painting a solid fill here instead of text glyphs (direct ask: "dolgunun
// efekti", not a glow around the shape). Every caller renders this inside
// its own `position:"absolute"` wrapper (top/right or top/left values differ
// per placement) — this component only owns the banner's own look + rotation.
export default function UpgradeRibbon({ onPress, width = 130, angle = 38 }: Props) {
  const { t } = useTranslation();
  const gold = TIER_FRAME_STYLES.premium!.gradient;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          width,
          height: RIBBON_HEIGHT,
          transform: [{ rotate: `${angle}deg` }],
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        },
        fill: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
        text: { color: "#fff", fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.4 },
      }),
    [width, angle]
  );

  return (
    <Pressable style={styles.wrap} onPress={onPress}>
      <LinearGradient
        colors={[gold[1], gold[0], gold[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.fill}
      >
        <Text style={styles.text}>{t("Upgrade").toUpperCase()}</Text>
      </LinearGradient>
    </Pressable>
  );
}
