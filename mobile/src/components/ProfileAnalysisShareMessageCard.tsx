import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTranslation } from "react-i18next";
import PremiumChatCard, { CARD, cardText } from "./chat/PremiumChatCard";
import { cineGraphSlices, type GenreSlice } from "../utils/shareCards";
import type { Message, ProfileAnalysis } from "../types";
import { fonts } from "../theme/typography";

const DONUT = 84;
const STROKE = 11;
const RADIUS = (DONUT - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SLICE_COLORS = ["#A78BFA", "#F472B6", "#22D3EE"];
const OTHER_COLOR = "rgba(255,255,255,0.16)";
const ACCENT = "#A78BFA";

const styles = StyleSheet.create({
  bottomRow: { flexDirection: "row", alignItems: "center", gap: 14, padding: 12, paddingTop: 0 },
  donutCenter: { position: "absolute", top: 0, left: 0, width: DONUT, height: DONUT, alignItems: "center", justifyContent: "center" },
  donutTop: { fontFamily: fonts.extrabold, fontSize: 17, color: CARD.white },
  legend: { flex: 1, minWidth: 0, gap: 6 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendGenre: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: CARD.white },
  legendPct: { fontFamily: fonts.bold, fontSize: 12.5, color: CARD.text },
  nickname: { fontFamily: fonts.extrabold, fontSize: 15.5, lineHeight: 20, color: CARD.white },
});

/** The snapshot ring: each top genre's share in its colour, the rest in a faint grey. */
const MiniDonut = memo(function MiniDonut({ top, other }: { top: GenreSlice[]; other: number }) {
  // Arc lengths and offsets, worked out once per analysis.
  const arcs = useMemo(() => {
    const slices = [...top.map((slice, i) => ({ pct: slice.percentage, color: SLICE_COLORS[i] })), { pct: other, color: OTHER_COLOR }];
    let offset = 0;
    return slices
      .filter((slice) => slice.pct > 0)
      .map((slice) => {
        const length = (slice.pct / 100) * CIRCUMFERENCE;
        const arc = { color: slice.color, dash: `${Math.max(0, length - 2)} ${CIRCUMFERENCE}`, offset: -offset };
        offset += length;
        return arc;
      });
  }, [top, other]);

  return (
    <View style={{ width: DONUT, height: DONUT }}>
      <Svg width={DONUT} height={DONUT} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={DONUT / 2} cy={DONUT / 2} r={RADIUS} stroke="rgba(255,255,255,0.08)" strokeWidth={STROKE} fill="none" />
        {arcs.map((arc, i) => (
          <Circle
            key={i}
            cx={DONUT / 2}
            cy={DONUT / 2}
            r={RADIUS}
            stroke={arc.color}
            strokeWidth={STROKE}
            strokeDasharray={arc.dash}
            strokeDashoffset={arc.offset}
            fill="none"
          />
        ))}
      </Svg>
      {top[0] ? (
        <View style={styles.donutCenter}>
          <Text style={styles.donutTop}>{top[0].percentage}%</Text>
        </View>
      ) : null}
    </View>
  );
});

interface Props {
  message: Message;
  isOwn: boolean;
  onPress: () => void;
}

// A shared CineGraph analysis as a data snapshot: a small ring of the top
// three genres with their shares, the analysis's nickname ("The Auteur") and
// whose it is. The genres are the analysis's own computed breakdown, never
// invented; an older analysis without one shows the nickname alone.
function ProfileAnalysisShareMessageCard({ message, isOwn, onPress }: Props) {
  const { t } = useTranslation();
  const analysis = message.analysisData as ProfileAnalysis | undefined;
  const { top, other } = useMemo(() => cineGraphSlices(analysis?.stats?.genreBreakdown), [analysis]);
  const owner = message.sender.username;
  const nickname = analysis?.nickname?.trim();

  return (
    <PremiumChatCard
      isOwn={isOwn}
      eyebrow={t("CineGraph Analysis")}
      eyebrowIcon="pie-chart"
      eyebrowColor={ACCENT}
      accent={ACCENT}
      heroHeight={top.length > 0 ? DONUT + 60 : 84}
      hero={
        top.length > 0 ? (
          <View style={styles.bottomRow}>
            <MiniDonut top={top} other={other} />
            <View style={styles.legend}>
              {top.map((slice, i) => (
                <View key={slice.genre} style={styles.legendRow}>
                  <View style={[styles.dot, { backgroundColor: SLICE_COLORS[i] }]} />
                  <Text style={styles.legendGenre} numberOfLines={1}>
                    {t(slice.genre)}
                  </Text>
                  <Text style={styles.legendPct}>{slice.percentage}%</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null
      }
      body={
        <View>
          {nickname ? (
            <Text style={styles.nickname} numberOfLines={2}>
              {nickname}
            </Text>
          ) : null}
          <Text style={cardText.meta} numberOfLines={1}>
            {t("@{{username}}'s CineGraph", { username: owner })}
          </Text>
        </View>
      }
      ctaLabel={t("View Analysis")}
      onPress={onPress}
      accessibilityLabel={`${t("CineGraph Analysis")}: ${nickname ?? ""}, ${top.map((s) => `${t(s.genre)} ${s.percentage}%`).join(", ")}`}
    />
  );
}

export default memo(ProfileAnalysisShareMessageCard);
