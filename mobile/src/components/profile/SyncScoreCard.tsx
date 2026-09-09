import { memo, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { prefetchMatchAnalysis } from "../../api/matchService";
import { SYNC_SCORE_FILTERS, getCachedSyncScore, prefetchSyncScore } from "../../api/syncScoreCache";
import MatchPercentageRing from "../MatchPercentageRing";
import MatchGradientTitle from "../match/MatchGradientTitle";
import SyncAnalysisModal from "./SyncAnalysisModal";
import type { MatchWithUserResult, SyncCandidate } from "../../types";
import { sameShape } from "../../utils/cache";
import { useTheme } from "../../context/ThemeContext";
import type { ColorPalette } from "../../theme/palettes";
import { fonts } from "../../theme/typography";

interface Props {
  userId: string;
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (n: number) => Math.round(f(n) * 255).toString(16).padStart(2, "0");
  return `#${toHex(0)}${toHex(8)}${toHex(4)}`;
}

// Red at 0%, green at 100%. This used to flood the whole card as a saturated
// gradient with white text on top, which fought with every other surface on
// the profile — it now tints just the ring, so the at-a-glance signal
// survives while the card itself sits in the app's normal palette.
function scoreColor(percent: number): string {
  const clamped = Math.max(0, Math.min(100, percent));
  return hslToHex((clamped / 100) * 120, 62, 46);
}

function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    wrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
    card: {
      backgroundColor: colors.base200,
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    // The wordmark is SVG text sized `width="100%"`, so it needs a box with
    // a real width to lay out in — it can't shrink-wrap its glyphs the way
    // <Text> does. Height comes from the component's own Svg.
    titleWrap: { flex: 1 },
    infoButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.base300,
      alignItems: "center",
      justifyContent: "center",
    },
    stateCard: {
      backgroundColor: colors.base200,
      borderRadius: 16,
      paddingVertical: 18,
      alignItems: "center",
    },
    error: { fontSize: 12.5, color: colors.placeholder, textAlign: "center", paddingHorizontal: 16, fontFamily: fonts.medium },
  });
}

// Sits at the top of a public profile's CineGraph tab: how well your taste
// lines up with theirs, and a way into the full breakdown.
//
// Previously this printed the score twice — once inside the ring and again
// as "72% Compatibility" right beside it. The ring already says the number,
// so the text beside it is now the feature's name instead.
function SyncScoreCard({ userId }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => buildStyles(colors), [colors]);

  // Seeded from the shared cache, which the profile screen starts filling
  // the moment it opens (api/publicProfileCache.ts) — so by the time this
  // tab is reached the number is usually already here, and this card renders
  // with it rather than mounting into a spinner.
  const cached = getCachedSyncScore(userId);
  const [matchResult, setMatchResult] = useState<MatchWithUserResult | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const known = getCachedSyncScore(userId);
    if (known) {
      setMatchResult(known);
      setLoading(false);
    }
    setError(null);
    // Joins the profile screen's in-flight prefetch when there is one, so
    // this never opens a second request for the same number.
    prefetchSyncScore(userId)
      .then((result) => {
        // Identity-preserving so an unchanged score doesn't re-render the
        // card (and, through it, remount the analysis modal's candidate).
        if (!cancelled) setMatchResult((prev) => (sameShape(prev, result) ? prev : result));
      })
      .catch((e) => {
        if (!cancelled && !known) setError(e?.response?.data?.message || t("Failed to calculate match."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
        // Warm the LLM analysis so opening the breakdown is instant — but
        // strictly AFTER the score has landed, never alongside it.
        //
        // These two used to fire together on mount. That call takes several
        // seconds and holds an HTTP connection the whole time, and the
        // platform only allows a handful per host at once, so it was
        // competing for a slot with the one request the user is actually
        // staring at — while the profile bundle's own requests were often
        // still in flight too. Deferring it costs nothing (nobody can tap
        // ⓘ before the card has rendered) and takes the score off the
        // queue behind it.
        if (!cancelled) {
          prefetchMatchAnalysis(userId, SYNC_SCORE_FILTERS).catch(() => {
            // Silent — the panel retries on its own, with its own handling.
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <View style={styles.wrap}>
        <View style={styles.stateCard}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  if (error || !matchResult) {
    return (
      <View style={styles.wrap}>
        <View style={styles.stateCard}>
          <Text style={styles.error}>{error || t("Failed to calculate match.")}</Text>
        </View>
      </View>
    );
  }

  // MatchAnalysisPanel speaks in SyncCandidate, and everything it needs is
  // already in the match result — matchInsights is optional and only
  // populated for the Sync page's own queue.
  const candidate: SyncCandidate = {
    user: matchResult.targetUser,
    contentType: SYNC_SCORE_FILTERS.type,
    matchPercentage: matchResult.matchPercentage,
    breakdown: matchResult.breakdown,
  };
  const accent = scoreColor(matchResult.matchPercentage);

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <MatchPercentageRing
          percentage={matchResult.matchPercentage}
          size={44}
          strokeWidth={4}
          trackColor={colors.base300}
          fillColor={accent}
          textColor={colors.baseContent}
        />
        <View style={styles.titleWrap}>
          <MatchGradientTitle text={t("Sync Score")} gradientId="syncScoreCardTitle" fontSize={17} />
        </View>
        <Pressable
          style={styles.infoButton}
          onPress={() => setModalVisible(true)}
          hitSlop={8}
          accessibilityLabel={t("Sync Analysis")}
        >
          <Ionicons name="information-circle-outline" size={20} color={colors.baseContent} />
        </Pressable>
      </View>

      {/* Mounted only once opened: MatchAnalysisPanel kicks off its own
          fetches on mount, and there's no reason to pay for those unless
          someone actually asks for the breakdown. */}
      {modalVisible && (
        <SyncAnalysisModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          candidate={candidate}
          filters={SYNC_SCORE_FILTERS}
        />
      )}
    </View>
  );
}

// The public profile keeps its tabs mounted once visited, so this would
// otherwise re-render on every unrelated change to that screen.
export default memo(SyncScoreCard);
