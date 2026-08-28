import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { getMatchWithUser, analyzeMatchWithUser, type MatchFilters } from "../../api/matchService";
import MatchPercentageRing from "../MatchPercentageRing";
import AnalyzeModal from "../AnalyzeModal";
import type { MatchAnalysis, MatchWithUserResult } from "../../types";
import { fonts } from "../../theme/typography";

interface Props {
  userId: string;
}

// Same weighted-match filters Cinematch/Analyze used to default to before
// the standalone buttons on the public profile were replaced by this — the
// compatibility % is now computed automatically the moment someone opens
// this person's CineGraph tab.
const DEFAULT_FILTERS: MatchFilters = { type: "movie", genres: [], useCount: true, useAvgRating: true };

// Module-level (not component-state) so it survives remounts — leaving the
// CineGraph tab and coming back, or navigating away from this profile and
// back, doesn't re-pay the ~5-6s LLM call a second time. Cleared only on a
// full app reload, which is fine for a per-session "already saw this"
// cache; nothing here is stale-sensitive enough to need a TTL/invalidation.
const analysisCache = new Map<string, MatchAnalysis>();

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (n: number) => Math.round(f(n) * 255).toString(16).padStart(2, "0");
  return `#${toHex(0)}${toHex(8)}${toHex(4)}`;
}

// Red at 0%, green at 100%, everything between interpolated through the
// same hue sweep — a diagonal 2-stop gradient of that hue (darker to
// brighter) gives the card some sheen instead of a flat fill.
function scoreGradient(percent: number): [string, string] {
  const clamped = Math.max(0, Math.min(100, percent));
  const hue = (clamped / 100) * 120;
  return [hslToHex(hue, 68, 34), hslToHex(hue, 72, 46)];
}

// Sits at the very top of a public profile's CineGraph category tab — a
// single-row gradient card (color shifts red→green with the score) showing
// the compatibility % at a glance, with a detail button that opens the full
// LLM-written analysis. Replaces the earlier standalone ring + corner info
// button design.
export default function CineGraphCompatibilityCard({ userId }: Props) {
  const { t } = useTranslation();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
        card: {
          borderRadius: 16,
          paddingVertical: 12,
          paddingHorizontal: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        },
        label: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: "#fff" },
        detailButton: {
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: "rgba(255,255,255,0.22)",
          alignItems: "center",
          justifyContent: "center",
        },
        errorCard: {
          borderRadius: 16,
          paddingVertical: 14,
          alignItems: "center",
        },
        error: { fontSize: 12, color: "#fff", textAlign: "center" },
        loadingCard: {
          borderRadius: 16,
          paddingVertical: 18,
          alignItems: "center",
        },
      }),
    []
  );

  const [matchResult, setMatchResult] = useState<MatchWithUserResult | null>(null);
  const [matchLoading, setMatchLoading] = useState(true);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [analyzeData, setAnalyzeData] = useState<MatchAnalysis | null>(analysisCache.get(userId) ?? null);
  const [prefetching, setPrefetching] = useState(!analysisCache.has(userId));
  const [analyzeModalVisible, setAnalyzeModalVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setMatchLoading(true);
    setMatchError(null);
    getMatchWithUser(userId, DEFAULT_FILTERS)
      .then((result) => {
        if (!cancelled) setMatchResult(result);
      })
      .catch((e) => {
        if (!cancelled) setMatchError(e?.response?.data?.message || t("Failed to calculate match."));
      })
      .finally(() => {
        if (!cancelled) setMatchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Fires alongside the score fetch above (not after the user taps the
  // detail button) so the LLM call's ~5-6s latency happens invisibly while
  // they're looking at the score — by the time they tap for details, it's
  // usually already sitting in analysisCache.
  useEffect(() => {
    if (analysisCache.has(userId)) {
      setAnalyzeData(analysisCache.get(userId)!);
      setPrefetching(false);
      return;
    }
    let cancelled = false;
    setPrefetching(true);
    analyzeMatchWithUser(userId, DEFAULT_FILTERS)
      .then((data) => {
        analysisCache.set(userId, data);
        if (!cancelled) setAnalyzeData(data);
      })
      .catch(() => {
        // Silent — the detail button below falls back to an on-demand call
        // (with its own error handling) if this prefetch didn't pan out.
      })
      .finally(() => {
        if (!cancelled) setPrefetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleDetailPress = async () => {
    if (analyzeData) {
      setAnalyzeModalVisible(true);
      return;
    }
    // Prefetch hasn't resolved (or failed) yet — fall back to an on-demand
    // call rather than leaving the button dead.
    setPrefetching(true);
    try {
      const data = await analyzeMatchWithUser(userId, DEFAULT_FILTERS);
      analysisCache.set(userId, data);
      setAnalyzeData(data);
      setAnalyzeModalVisible(true);
    } catch (e: any) {
      setMatchError(e?.response?.data?.message || t("Failed to analyze match."));
    } finally {
      setPrefetching(false);
    }
  };

  if (matchLoading) {
    return (
      <View style={styles.wrap}>
        <View style={[styles.loadingCard, { backgroundColor: "rgba(120,120,120,0.15)" }]}>
          <ActivityIndicator />
        </View>
      </View>
    );
  }

  if (matchError || !matchResult) {
    return (
      <View style={styles.wrap}>
        <View style={[styles.errorCard, { backgroundColor: hslToHex(0, 55, 40) }]}>
          <Text style={styles.error}>{matchError || t("Failed to calculate match.")}</Text>
        </View>
      </View>
    );
  }

  const [from, to] = scoreGradient(matchResult.matchPercentage);
  // Only shows a spinner on the button when there's truly nothing to show
  // yet (no cached/prefetched data) — once analyzeData exists, tapping is
  // instant even if a stale on-demand retry were somehow still pending.
  const detailPending = prefetching && !analyzeData;

  return (
    <View style={styles.wrap}>
      <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <MatchPercentageRing
          percentage={matchResult.matchPercentage}
          size={40}
          strokeWidth={4}
          trackColor="rgba(255,255,255,0.35)"
          fillColor="#fff"
          textColor="#fff"
        />
        <Text style={styles.label} numberOfLines={1}>
          {t("{{percent}}% Compatibility", { percent: matchResult.matchPercentage })}
        </Text>
        <Pressable
          style={styles.detailButton}
          onPress={handleDetailPress}
          disabled={detailPending}
          hitSlop={8}
          accessibilityLabel={t("Analyze Compatibility")}
        >
          {detailPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="information-circle-outline" size={20} color="#fff" />
          )}
        </Pressable>
      </LinearGradient>

      <AnalyzeModal
        visible={analyzeModalVisible}
        onClose={() => setAnalyzeModalVisible(false)}
        data={analyzeData}
        shareTargetUserId={userId}
      />
    </View>
  );
}
