import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, View, Text, StyleSheet, type NativeSyntheticEvent, type NativeScrollEvent } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
// Same fix as PosterRow.tsx/PosterCoverflow.tsx: this scroller nests inside
// MatchAnalysisPanel's own per-card vertical ScrollView, itself inside the
// outer horizontal card-paging ScrollView — same-axis (vertical-in-vertical)
// nested scrolling loses the drag gesture to the outer one with a plain RN
// ScrollView.
import { ScrollView } from "react-native-gesture-handler";
import AnimatedInsightList from "./AnimatedInsightList";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import { localeUpper } from "../../utils/text";

// Sized generously against the real worst case (this session's own observed
// LLM output: up to ~3 items per category) rather than syncing height to
// variable content — the same "reserve for the true worst case" principle
// this feature already uses elsewhere. Item lists are capped so real content
// can't exceed what this comfortably fits.
const SECTION_HEIGHT = 210;
// Slightly shorter than a full section — the next section's own heading is
// genuinely peeking in from the very first frame at rest, not only visible
// after a full section's worth of scrolling.
const VIEWPORT_HEIGHT = 190;
const FADE_HEIGHT = 34;
const MAX_ITEMS = 4;
// Slow, gentle bob — same "family" of idle motion as MatchCloudBubble's own
// slow drift (1800-3200ms legs), just simpler (vertical only) since this is
// a small hint icon, not a floating bubble.
const BOB_MS = 900;
const BOB_DISTANCE = 5;
// Exact — content is always precisely 3 fixed-height sections, no measured
// content-size needed to know where "the end" is.
const MAX_SCROLL_Y = SECTION_HEIGHT * 3 - VIEWPORT_HEIGHT;
const END_THRESHOLD = 4;

interface Props {
  analysis: string;
  strengths: string[];
  weaknesses: string[];
  conversationStarters: string[];
}

// Below the fixed match-title/MatchTierRow header, a vertically scrollable
// stack of 3 sections — the analysis paragraph, then Strengths+Weaknesses as
// two columns (styled like this feature's own "You"/{username} column
// pattern — MatchAnalysisPanel.tsx's ratingName/ratingColumn), then
// Conversation Starters as a stack of purely decorative "button" rows. A
// bottom-edge fade (mirrors PosterRow.tsx's own horizontal "there's more,
// scroll" fade, just oriented vertically) lets the next section's heading
// peek through, softened — that peek is the only "you can scroll" affordance,
// no separate page-dot indicator needed.
export default function MatchSummarySwiper({ analysis, strengths, weaknesses, conversationStarters }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const bobAnim = useRef(new Animated.Value(0)).current;
  const hintOpacity = useRef(new Animated.Value(1)).current;
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnim, { toValue: 1, duration: BOB_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bobAnim, { toValue: 0, duration: BOB_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bobAnim]);

  // Nothing left to scroll to once the last section is reached — the hint
  // would be pointing at a scroll that can't happen, so it fades out instead
  // of staying visible past its own usefulness.
  useEffect(() => {
    Animated.timing(hintOpacity, {
      toValue: atEnd ? 0 : 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [atEnd, hintOpacity]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setAtEnd(e.nativeEvent.contentOffset.y >= MAX_SCROLL_Y - END_THRESHOLD);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { width: "100%", height: VIEWPORT_HEIGHT, position: "relative" },
        // overflow:"hidden" is the real guarantee here — sections are plain
        // stacked siblings inside one snapToInterval-driven ScrollView, not
        // independently scrollable, so without this an unusually long
        // analysis/starter/insight-item text would render past its own
        // section's height and visibly bleed into whichever section is
        // next, not just look cramped. numberOfLines/ellipsizeMode on the
        // actual text below give a clean "…" truncation instead of an
        // abrupt hard clip when that happens, but this is what makes
        // sections never mix regardless of content length.
        section: { height: SECTION_HEIGHT, alignItems: "center", overflow: "hidden" },
        analysisSection: { justifyContent: "center", paddingHorizontal: 4 },
        // Same shape as columnHeader/startersHeader below — every other
        // section in this swiper has its own label; this one used to rely
        // on the card's own page-level "Sync Summary" title for that,
        // which moved down here once the LLM's match_title took over the
        // page-level corner as a badge instead (MatchTitleBadge.tsx).
        analysisHeader: {
          fontFamily: fonts.bold,
          fontSize: 13,
          color: colors.primary,
          textAlign: "center",
          letterSpacing: 0.5,
          marginBottom: 10,
        },
        paragraph: { fontSize: 14, color: colors.baseContent, lineHeight: 20, textAlign: "center" },
        columnsRow: { flexDirection: "row", width: "100%", gap: 16, paddingTop: 4 },
        column: { flex: 1 },
        columnHeader: {
          fontFamily: fonts.bold,
          fontSize: 13,
          textAlign: "center",
          letterSpacing: 0.5,
          marginBottom: 10,
        },
        startersHeader: {
          fontFamily: fonts.bold,
          fontSize: 13,
          color: colors.primary,
          textAlign: "center",
          letterSpacing: 0.5,
          marginBottom: 10,
        },
        starterButton: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingVertical: 9,
          paddingHorizontal: 14,
          marginBottom: 8,
          width: "100%",
        },
        starterButtonText: { fontSize: 13, color: colors.baseContent, textAlign: "center" },
        fade: { position: "absolute", left: 0, right: 0, bottom: 0 },
        // A dedicated row below the scroller/fade box, not overlaid on top of
        // it — the hint used to sit inside the fade area and could visually
        // clash with whatever section content was peeking through there.
        hintRow: { alignItems: "center", marginTop: 6 },
        scrollHint: {
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: colors.base100,
          alignItems: "center",
          justifyContent: "center",
        },
      }),
    [colors]
  );

  return (
    <View>
      <View style={styles.wrap}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          snapToInterval={SECTION_HEIGHT}
          decelerationRate="fast"
          onScroll={onScroll}
          scrollEventThrottle={32}
        >
          <View style={[styles.section, styles.analysisSection]}>
            <Text style={styles.analysisHeader}>{localeUpper(t("Sync Summary"))}</Text>
            <Text style={styles.paragraph} numberOfLines={7} ellipsizeMode="tail">
              {analysis}
            </Text>
          </View>

          <View style={[styles.section, { justifyContent: "center" }]}>
            <View style={styles.columnsRow}>
              <View style={styles.column}>
                <Text style={[styles.columnHeader, { color: colors.success }]}>{localeUpper(t("Strengths"))}</Text>
                {/* numberOfLines={0} (unlike every other AnimatedInsightList
                    caller, which keeps its 2-line default) — direct ask:
                    these should read fully, not clip a longer sentence with
                    "…". */}
                <AnimatedInsightList items={strengths.slice(0, MAX_ITEMS)} icon="checkmark-circle" iconColor={colors.success} numberOfLines={0} />
              </View>
              <View style={styles.column}>
                <Text style={[styles.columnHeader, { color: colors.warning }]}>{localeUpper(t("Weaknesses"))}</Text>
                <AnimatedInsightList items={weaknesses.slice(0, MAX_ITEMS)} icon="alert-circle" iconColor={colors.warning} numberOfLines={0} />
              </View>
            </View>
          </View>

          <View style={[styles.section, { justifyContent: "center" }]}>
            <Text style={styles.startersHeader}>{localeUpper(t("Conversation Starters"))}</Text>
            {conversationStarters.slice(0, MAX_ITEMS).map((s, i) => (
              <View key={i} style={styles.starterButton}>
                <Text style={styles.starterButtonText} numberOfLines={2} ellipsizeMode="tail">
                  {s}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <Svg width="100%" height={FADE_HEIGHT} style={styles.fade} pointerEvents="none">
          <Defs>
            <LinearGradient id="summaryFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.base200} stopOpacity={0} />
              <Stop offset="1" stopColor={colors.base200} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width="100%" height={FADE_HEIGHT} fill="url(#summaryFade)" />
        </Svg>
      </View>

      <View style={styles.hintRow}>
        <Animated.View
          style={[
            styles.scrollHint,
            { opacity: hintOpacity, transform: [{ translateY: bobAnim.interpolate({ inputRange: [0, 1], outputRange: [0, BOB_DISTANCE] }) }] },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="chevron-down" size={16} color={colors.primary} />
        </Animated.View>
      </View>
    </View>
  );
}
