import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getProfileAnalysis, getProfileAnalysisHistory } from "../../api/userService";
import AnalysisHistoryCard from "./AnalysisHistoryCard";
import type { ProfileAnalysis, ProfileAnalysisHistoryEntry } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

interface Props {
  // Fires both when a fresh analysis just completed and when an existing
  // history card is tapped — either way, the caller just needs to show it.
  onViewAnalysis: (data: ProfileAnalysis) => void;
}

export default function ProfileAnalysesTab({ onViewAnalysis }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { alignSelf: "stretch", paddingHorizontal: 20, paddingTop: 8 },
        upsellCard: {
          backgroundColor: colors.base200,
          borderRadius: 12,
          padding: 20,
          alignItems: "center",
        },
        upsellTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.baseContent, marginBottom: 8 },
        upsellText: {
          color: colors.placeholder,
          fontSize: 13,
          textAlign: "center",
          lineHeight: 19,
          marginBottom: 16,
        },
        upsellButton: {
          backgroundColor: colors.primary,
          borderRadius: 8,
          paddingHorizontal: 20,
          paddingVertical: 12,
        },
        upsellButtonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 14 },
        analyzeButton: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          paddingVertical: 14,
          alignItems: "center",
        },
        analyzeButtonText: { fontFamily: fonts.medium, color: colors.baseContent },
        hint: { color: colors.placeholder, fontSize: 12, textAlign: "center", marginTop: 10 },
        historySection: { marginTop: 28 },
        historyTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent, marginBottom: 12 },
        historyEmpty: { color: colors.placeholder, fontSize: 13, textAlign: "center", marginTop: 8 },
      }),
    [colors]
  );

  const tier = user?.accountTier ?? "free";
  const hasAccess = tier === "pro" || tier === "premium" || tier === "dev";

  const [analyzing, setAnalyzing] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [, forceTick] = useState(0);
  const [history, setHistory] = useState<ProfileAnalysisHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const entries = await getProfileAnalysisHistory();
      setHistory(entries);
    } catch {
      // Best-effort — the analyze flow itself doesn't depend on this.
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (!cooldownUntil) return;
    const interval = setInterval(() => {
      if (Date.now() >= cooldownUntil) {
        setCooldownUntil(null);
      } else {
        forceTick((n) => n + 1);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  // A tier change shortens (or removes) the cooldown window, but the timer
  // above was computed under the previous tier — clear it so the next tap
  // re-checks with the server instead of coasting on a stale estimate.
  useEffect(() => {
    setCooldownUntil(null);
  }, [tier]);

  useEffect(() => {
    if (hasAccess) loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess]);

  const formatCooldown = (ms: number) => {
    const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const data = await getProfileAnalysis();
      onViewAnalysis(data);
      loadHistory();
    } catch (e: any) {
      const retryAfterMs = e?.response?.data?.errors?.retryAfterMs;
      if (e?.response?.status === 429 && retryAfterMs) {
        setCooldownUntil(Date.now() + retryAfterMs);
      } else {
        showToast(e?.response?.data?.message || t("Something went wrong. Please try again."));
      }
    } finally {
      setAnalyzing(false);
    }
  };

  if (!hasAccess) {
    return (
      <View style={styles.container}>
        <View style={styles.upsellCard}>
          <Text style={styles.upsellTitle}>{t("Analyses are a Pro feature")}</Text>
          <Text style={styles.upsellText}>
            {t(
              "Upgrade to Pro or Premium to unlock AI-powered taste analysis, genre breakdowns, and how your taste evolves over time."
            )}
          </Text>
          <Pressable style={styles.upsellButton} onPress={() => router.push("/profile/settings")}>
            <Text style={styles.upsellButtonText}>{t("Upgrade Account")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.analyzeButton}
        onPress={handleAnalyze}
        disabled={analyzing || Boolean(cooldownUntil)}
      >
        {analyzing ? (
          <ActivityIndicator color={colors.baseContent} />
        ) : cooldownUntil ? (
          <Text style={styles.analyzeButtonText}>
            {t("Available in")} {formatCooldown(cooldownUntil - Date.now())}
          </Text>
        ) : (
          <Text style={styles.analyzeButtonText}>{t("Analyze Profile")}</Text>
        )}
      </Pressable>
      <Text style={styles.hint}>
        {t("Generates a fresh AI breakdown of your taste based on your ratings and watch history.")}
      </Text>

      <View style={styles.historySection}>
        <Text style={styles.historyTitle}>{t("Your Analyses")}</Text>
        {historyLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : history.length === 0 ? (
          <Text style={styles.historyEmpty}>{t("Your past analyses will show up here.")}</Text>
        ) : (
          history.map((entry) => (
            <AnalysisHistoryCard key={entry._id} entry={entry} onPress={() => onViewAnalysis(entry.result)} />
          ))
        )}
      </View>
    </View>
  );
}
