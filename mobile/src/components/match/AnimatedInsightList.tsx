import { useEffect, useMemo } from "react";
import { Animated, View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";

interface Props {
  items: string[];
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  // Omit for the full, untruncated sentence — direct ask for Strengths/
  // Weaknesses specifically (MatchSummarySwiper.tsx), which used to always
  // clip at 2 lines with "…" here. Left at 2 for every other caller
  // (SyncIntroCard's highlights, GenreDonutChart's legend, Conversation
  // Starters) — those are short by design already, so this only matters as
  // a safety net there, not a real behavior change.
  numberOfLines?: number;
}

// Strengths/Weaknesses/Conversation Starters are the same shape three times
// (an icon + a list of one-liners) — extracted once instead of tripling the
// animation logic. A staggered fade+slide-in per row on mount, native-driver
// only — appropriate motion for narrative/list content (each row is prose,
// not a number), not a data visualization.
//
// Each row is a tinted "chip" (iconColor at ~10% opacity background), not a
// bare icon+text line — plain rows read too flat/scan-poorly side by side in
// the two-column Strengths/Weaknesses layout; a light color-block per item
// gives each one visual weight and makes the two columns easier to compare
// at a glance. Filled tint (not a bordered outline, unlike the Conversation
// Starters "button" rows in the same swiper) is the deliberate visual
// distinction between the two — same rounded-container language, different
// weight.
export default function AnimatedInsightList({ items, icon, iconColor, numberOfLines = 2 }: Props) {
  const { colors } = useTheme();
  // Rebuilt (not a one-time useRef) whenever the actual content changes, not
  // just its length — this list isn't remounted when MatchAnalysisPanel
  // switches candidates (no `key` on that card), so a fixed-size ref here
  // would both go stale (no replay on switch) and, worse, go out of bounds
  // the moment a new candidate's list is longer than the previous one's
  // (anims[i] undefined -> crash on .interpolate).
  const itemsKey = items.join("|");
  const anims = useMemo(() => items.map(() => new Animated.Value(0)), [itemsKey]);

  useEffect(() => {
    Animated.stagger(
      70,
      anims.map((v) =>
        Animated.timing(v, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        })
      )
    ).start();
  }, [anims]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        listRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 7, borderRadius: 9, paddingVertical: 6, paddingHorizontal: 8 },
        listItem: { flex: 1, color: colors.baseContent, fontSize: 12.5, lineHeight: 17 },
      }),
    [colors]
  );

  return (
    <View>
      {items.map((item, i) => (
        <Animated.View
          key={i}
          style={[
            styles.listRow,
            {
              backgroundColor: `${iconColor}1A`,
              opacity: anims[i],
              transform: [{ translateY: anims[i].interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
            },
          ]}
        >
          <Ionicons name={icon} size={14} color={iconColor} />
          <Text style={styles.listItem} numberOfLines={numberOfLines || undefined} ellipsizeMode="tail">
            {item}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
}
