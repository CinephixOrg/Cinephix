import { useMemo } from "react";
import { Animated, View, Text, StyleSheet } from "react-native";
import Modal from "../common/GestureModal";
import Pressable from "../common/TapSafePressable";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAnalyzeProfile } from "../../hooks/useAnalyzeProfile";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

interface Props {
  visible: boolean;
  onClose: () => void;
}

// The centered info box shown from the new "Analyze Profile" button at the
// end of the username row (profile/index.tsx) — direct ask, replacing the
// old Analyze tab's own always-visible button+hint. Entitled viewers get
// one explainer paragraph + a confirm button; Free sees the same upsell
// this tab's own gate already showed, folded into this one box instead of
// a separate screen state. Confirming runs the exact same
// getProfileAnalysis() call + cooldown/429 handling the old tab's
// handleAnalyze had, then stages the result via
// setPendingProfileAnalysis and pushes the new full-screen story
// (app/(app)/profile/analyze-story.tsx).
export default function AnalyzeInfoModal({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();

  const tier = user?.accountTier ?? "free";
  const hasAccess = tier === "plus" || tier === "premium" || tier === "dev";

  // Shared with AnalyzeIntroStory's own final-slide CTA (useAnalyzeProfile.ts)
  // — same cooldown/429 handling, same countdown formatting, same rotating
  // "still working" status line, one call site for the actual "run it and
  // go look" logic.
  const { analyzing, statusMessage, statusOpacity, cooldownUntil, formatCooldown, runAnalysis } = useAnalyzeProfile();

  const handleAnalyze = async () => {
    if (await runAnalysis()) onClose();
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", paddingHorizontal: 24 },
        box: { backgroundColor: colors.base100, borderRadius: 20, padding: 24, alignItems: "center", position: "relative" },
        closeButton: { position: "absolute", top: 12, right: 12, padding: 4 },
        iconWrap: { marginBottom: 12 },
        title: { fontFamily: fonts.bold, fontSize: 18, color: colors.baseContent, textAlign: "center", marginBottom: 10 },
        body: { fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.placeholder, textAlign: "center", marginBottom: 20 },
        confirmButton: {
          alignSelf: "stretch",
          backgroundColor: colors.primary,
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: "center",
        },
        confirmButtonText: { fontFamily: fonts.bold, fontSize: 15, color: colors.primaryContent },
      }),
    [colors]
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8} accessibilityLabel={t("Close")}>
            <Ionicons name="close" size={20} color={colors.placeholder} />
          </Pressable>
          <View style={styles.iconWrap}>
            <Ionicons name="sparkles-outline" size={30} color={colors.primary} />
          </View>
          <Text style={styles.title}>{t("Analyze Profile")}</Text>
          {hasAccess ? (
            <>
              <Text style={styles.body}>
                {t(
                  "A personalized breakdown of your taste — favorite genres, how it's shifted recently, and your all-time stats, built from your ratings and watch history."
                )}
              </Text>
              <Pressable style={styles.confirmButton} onPress={handleAnalyze} disabled={analyzing || Boolean(cooldownUntil)}>
                {analyzing ? (
                  <Animated.Text style={[styles.confirmButtonText, { opacity: statusOpacity }]} numberOfLines={1}>
                    {statusMessage}
                  </Animated.Text>
                ) : cooldownUntil ? (
                  <Text style={styles.confirmButtonText}>
                    {t("Available in")} {formatCooldown(cooldownUntil - Date.now())}
                  </Text>
                ) : (
                  <Text style={styles.confirmButtonText}>{t("Analyze")}</Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.body}>
                {t(
                  "Upgrade to Pro or Premium to unlock AI-powered taste analysis, genre breakdowns, and how your taste evolves over time."
                )}
              </Text>
              <Pressable
                style={styles.confirmButton}
                onPress={() => {
                  onClose();
                  router.push("/profile/settings" as any);
                }}
              >
                <Text style={styles.confirmButtonText}>{t("Upgrade Account")}</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
