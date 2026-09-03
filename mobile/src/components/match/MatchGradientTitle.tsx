import { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

interface Props {
  text: string;
  fontSize?: number;
  // Every gradient-using SVG in this feature hand-picks its own unique id
  // (cloudHeaderGradient, posterRowFade, ...) rather than sharing one —
  // this card deck keeps every card mounted at once (just scrolled off-
  // screen, not unmounted), so two cards using this component at the same
  // time would otherwise both try to define the same <LinearGradient id>
  // within the same overall render tree.
  gradientId: string;
}

// Gradient-filled TEXT itself (not a gradient background behind flat text)
// — matches MatchFilterStrip's own primary->secondary "Match" button
// gradient, just applied to glyphs via react-native-svg's own Text
// fill="url(#...)" support rather than a new dependency. width="100%" +
// textAnchor="middle" centers without needing to measure the rendered
// width up front. Shared by the Sync Summary card's own match_title and
// the closing "cover" card's own headline — extracted once actually
// reused in two places, not preemptively.
export default function MatchGradientTitle({ text, fontSize = 17, gradientId }: Props) {
  const { colors } = useTheme();
  const height = fontSize + 11;
  const styles = useMemo(() => StyleSheet.create({ wrap: { marginBottom: 4 } }), []);

  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={height}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.primary} />
            <Stop offset="1" stopColor={colors.secondary} />
          </LinearGradient>
        </Defs>
        <SvgText
          x="50%"
          y={height - 8}
          textAnchor="middle"
          fontFamily={fonts.bold}
          fontSize={fontSize}
          fontWeight="bold"
          fill={`url(#${gradientId})`}
        >
          {text}
        </SvgText>
      </Svg>
    </View>
  );
}
