import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, Modal, Platform, ActivityIndicator, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { getOrCreateConversation, sendRichMessage } from "../api/conversationService";
import { useChat } from "../context/ChatContext";
import { useToast } from "../context/ToastContext";
import type { MatchAnalysis } from "../types";
import { useTheme } from "../context/ThemeContext";
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

export default function AnalyzeModal({ visible, onClose, data, shareTargetUserId }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
  card: { backgroundColor: colors.base200, borderRadius: 12, padding: 20, maxHeight: "80%" },
  scrollContent: { paddingBottom: 8 },
  title: { fontFamily: fonts.bold, fontSize: 18, color: colors.baseContent, marginBottom: 12 },
  paragraph: { color: colors.baseContent, fontSize: 14, lineHeight: 20 },
  section: { marginTop: 16 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.baseContent, marginBottom: 6 },
  listItem: { color: colors.baseContent, fontSize: 13, lineHeight: 19, marginBottom: 2 },
  ascii: {
    color: colors.placeholder,
    fontSize: 11,
    lineHeight: 15,
    fontFamily: Platform.select({ ios: "Courier", android: "monospace", default: "monospace" }),
  },
  buttonRow: { flexDirection: "row", gap: 8, marginTop: 16 },
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
}), [colors]);
  const { t } = useTranslation();
  const { refreshConversations } = useChat();
  const { showToast } = useToast();
  const [sending, setSending] = useState(false);
  const [shared, setShared] = useState(false);
  const parsed = data?.parsed;
  const graphAscii = Array.isArray(parsed?.graph_ascii)
    ? parsed?.graph_ascii.join("\n")
    : parsed?.graph_ascii;

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
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.title}>{t("Compatibility Analysis")}</Text>

            {parsed ? (
              <>
                <Text style={styles.paragraph}>{parsed.analysis}</Text>

                {parsed.strengths?.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t("Strengths")}</Text>
                    {parsed.strengths.map((s, i) => (
                      <Text key={i} style={styles.listItem}>
                        • {s}
                      </Text>
                    ))}
                  </View>
                )}

                {parsed.weaknesses?.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t("Weaknesses")}</Text>
                    {parsed.weaknesses.map((s, i) => (
                      <Text key={i} style={styles.listItem}>
                        • {s}
                      </Text>
                    ))}
                  </View>
                )}

                {parsed.conversation_starters?.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t("Conversation Starters")}</Text>
                    {parsed.conversation_starters.map((s, i) => (
                      <Text key={i} style={styles.listItem}>
                        • {s}
                      </Text>
                    ))}
                  </View>
                )}

                {graphAscii ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t("Score Breakdown")}</Text>
                    <Text style={styles.ascii}>{graphAscii}</Text>
                  </View>
                ) : null}
              </>
            ) : (
              <Text style={styles.paragraph}>{t("No analysis available.")}</Text>
            )}
          </ScrollView>

          <View style={styles.buttonRow}>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>{t("Close")}</Text>
            </Pressable>
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
          </View>
        </View>
      </View>
    </Modal>
  );
}

