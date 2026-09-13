import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, Modal, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { getOrCreateConversation, sendMessageRest, sendRichMessage } from "../api/conversationService";
import { useChat } from "../context/ChatContext";
import { useToast } from "../context/ToastContext";
import type { MatchAnalysis } from "../types";
import { useTheme } from "../context/ThemeContext";
import type { ColorPalette } from "../theme/palettes";
import { fonts } from "../theme/typography";

interface Props {
  visible: boolean;
  onClose: () => void;
  data: MatchAnalysis | null;
  // Present only when this modal is showing a *fresh* compatibility result
  // for a specific matched user (match/index.tsx) — Share then sends
  // directly to that one person, no recipient picker, matching web exactly
  // (the analysis is already about them, there's no one else to choose).
  // Omitted when viewing a previously-sent/received analysis_share message
  // from ChatRoom.tsx — no Share button there, it was already shared.
  shareTargetUserId?: string;
}

const BREAKDOWN_ROWS: { key: keyof NonNullable<MatchAnalysis["breakdown"]>; label: string }[] = [
  { key: "collaborative", label: "Taste Similarity" },
  { key: "contentBased", label: "Shared Favorites" },
  { key: "social", label: "Social Overlap" },
  { key: "diversity", label: "Diversity Match" },
  { key: "bonus", label: "Activity Bonus" },
];

function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
    card: { backgroundColor: colors.base200, borderRadius: 12, overflow: "hidden", maxHeight: "85%" },
    header: { backgroundColor: colors.primary, padding: 20 },
    eyebrow: {
      color: colors.primaryContent,
      opacity: 0.75,
      fontSize: 11,
      fontFamily: fonts.bold,
      letterSpacing: 1,
    },
    score: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 30, marginTop: 4 },
    scoreLabel: { color: colors.primaryContent, opacity: 0.85, fontSize: 13, marginTop: 2 },
    title: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 22, marginTop: 4 },
    scrollContent: { padding: 20, paddingBottom: 8 },
    paragraph: { color: colors.baseContent, fontSize: 14, lineHeight: 20 },
    section: { marginBottom: 16 },
    sectionTitle: {
      fontFamily: fonts.bold,
      fontSize: 12,
      color: colors.placeholder,
      marginBottom: 8,
    },
    listRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 6 },
    listIcon: { marginTop: 1 },
    listItem: { flex: 1, color: colors.baseContent, fontSize: 13, lineHeight: 19 },
    breakdownRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 8 },
    breakdownLabel: { color: colors.baseContent, fontSize: 12, width: 110 },
    breakdownBarTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.base300, overflow: "hidden" },
    breakdownBarFill: { height: "100%", borderRadius: 4, backgroundColor: colors.primary },
    breakdownPercent: { color: colors.placeholder, fontSize: 11, width: 34, textAlign: "right" },
    buttonRow: { flexDirection: "row", gap: 8, padding: 20, paddingTop: 4 },
    closeButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: "center",
    },
    closeButtonText: { color: colors.baseContent, fontFamily: fonts.medium },
    shareButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: "center",
    },
    shareButtonDisabled: { opacity: 0.6 },
    shareButtonText: { color: colors.primaryContent, fontFamily: fonts.bold },
  });
}

export default function AnalyzeModal({ visible, onClose, data, shareTargetUserId }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { refreshConversations } = useChat();
  const { showToast } = useToast();
  const [sending, setSending] = useState(false);
  const [shared, setShared] = useState(false);
  const parsed = data?.parsed;
  const breakdown = data?.breakdown;
  // The backend's actual weighted score (same number getMatchWithUser shows
  // on the profile) — not derived from collaborative+contentBased alone,
  // which used to produce a different percentage than what was already on
  // screen.
  const overallScore = data?.matchPercentage ?? null;

  // Reset once a new analysis comes in, so a stale "Shared" state from a
  // previous match doesn't linger onto the next one.
  useEffect(() => {
    setShared(false);
  }, [data]);

  const handleShare = async () => {
    if (!data || !shareTargetUserId) return;
    setSending(true);
    try {
      const conv = await getOrCreateConversation(shareTargetUserId);
      await sendRichMessage(conv._id, {
        text: t("📊 Shared a CineMatch analysis"),
        type: "analysis_share",
        analysisData: data,
      });
      // Sent as a second, separate plain-text message right after the card
      // — direct ask ("bu kartı önce göndericek. sonra da altında yeni bir
      // mesaj kutucuğu olarak... bir metin olsun") — rather than folded
      // into the card's own text, since the card's own caption already
      // carries the "tap to see details" instruction.
      await sendMessageRest(conv._id, t("Check out our sync analyse!"));
      await refreshConversations();
      setShared(true);
    } catch {
      showToast(t("Something went wrong. Please try again."));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            {/* .toUpperCase() here (not a textTransform style) so casing is
                JS-level and locale-invariant — RN's native textTransform:
                "uppercase" honors the device's OS locale, which turns a
                lowercase "i" into "İ" on Turkish-locale devices even when
                the app itself is set to English. */}
            <Text style={styles.eyebrow}>{t("Compatibility Analysis").toUpperCase()}</Text>
            {overallScore !== null ? (
              <>
                <Text style={styles.score}>{overallScore}%</Text>
                <Text style={styles.scoreLabel}>{t("Overall Match")}</Text>
              </>
            ) : (
              <Text style={styles.title}>{t("Cinematic Compatibility")}</Text>
            )}
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {parsed ? (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t("Analysis").toUpperCase()}</Text>
                  <Text style={styles.paragraph}>{parsed.analysis}</Text>
                </View>

                {breakdown && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t("Score Breakdown").toUpperCase()}</Text>
                    {BREAKDOWN_ROWS.map((row) => (
                      <View key={row.key} style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel} numberOfLines={1}>
                          {t(row.label)}
                        </Text>
                        <View style={styles.breakdownBarTrack}>
                          <View
                            style={[styles.breakdownBarFill, { width: `${breakdown[row.key]}%` }]}
                          />
                        </View>
                        <Text style={styles.breakdownPercent}>{breakdown[row.key]}%</Text>
                      </View>
                    ))}
                  </View>
                )}

                {parsed.strengths?.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t("Strengths").toUpperCase()}</Text>
                    {parsed.strengths.map((s, i) => (
                      <View key={i} style={styles.listRow}>
                        <Ionicons
                          name="checkmark-circle"
                          size={15}
                          color={colors.success}
                          style={styles.listIcon}
                        />
                        <Text style={styles.listItem}>{s}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {parsed.weaknesses?.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t("Weaknesses").toUpperCase()}</Text>
                    {parsed.weaknesses.map((s, i) => (
                      <View key={i} style={styles.listRow}>
                        <Ionicons
                          name="alert-circle"
                          size={15}
                          color={colors.warning}
                          style={styles.listIcon}
                        />
                        <Text style={styles.listItem}>{s}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {parsed.conversation_starters?.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t("Conversation Starters").toUpperCase()}</Text>
                    {parsed.conversation_starters.map((s, i) => (
                      <View key={i} style={styles.listRow}>
                        <Ionicons
                          name="chatbubble-ellipses"
                          size={15}
                          color={colors.primary}
                          style={styles.listIcon}
                        />
                        <Text style={styles.listItem}>{s}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.paragraph}>{t("No analysis available.")}</Text>
            )}
          </ScrollView>

          <View style={styles.buttonRow}>
            {parsed && shareTargetUserId && (
              <Pressable
                style={[styles.shareButton, (sending || shared) && styles.shareButtonDisabled]}
                onPress={handleShare}
                disabled={sending || shared}
              >
                {sending ? (
                  <ActivityIndicator color={colors.primaryContent} />
                ) : (
                  <Text style={styles.shareButtonText}>{shared ? t("Shared") : t("Share")}</Text>
                )}
              </Pressable>
            )}
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>{t("Close")}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
