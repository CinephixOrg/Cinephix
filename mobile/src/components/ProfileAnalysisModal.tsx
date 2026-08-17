import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, Modal, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import UserSharePickerModal from "./UserSharePickerModal";
import { getOrCreateConversation, sendRichMessage } from "../api/conversationService";
import { sendGroupRichMessage } from "../api/groupService";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import { useToast } from "../context/ToastContext";
import type { ProfileAnalysis } from "../types";
import { useTheme } from "../context/ThemeContext";
import type { ColorPalette } from "../theme/palettes";
import { fonts } from "../theme/typography";

interface Props {
  visible: boolean;
  onClose: () => void;
  data: ProfileAnalysis | null;
  // Present only when this is a *fresh* result the viewer just generated on
  // their own Profile screen — omitted when viewing a previously-shared one
  // in ChatRoom.tsx, matching AnalyzeModal.tsx's identical reasoning: no
  // re-sharing something that was already shared with you.
  shareable?: boolean;
}

function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
    card: { backgroundColor: colors.base200, borderRadius: 12, overflow: "hidden", maxHeight: "80%" },
    header: { backgroundColor: colors.primary, padding: 20 },
    eyebrow: {
      color: colors.primaryContent,
      opacity: 0.75,
      fontSize: 11,
      fontFamily: fonts.bold,
      letterSpacing: 1,
    },
    nickname: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 22, marginTop: 4 },
    scrollContent: { padding: 20, paddingBottom: 8 },
    paragraph: { color: colors.baseContent, fontSize: 14, lineHeight: 20 },
    section: { marginBottom: 16 },
    sectionTitle: {
      fontFamily: fonts.bold,
      fontSize: 12,
      color: colors.placeholder,
      marginBottom: 6,
    },
    funFactBox: { backgroundColor: colors.base300, borderRadius: 10, padding: 14 },
    funFactText: { color: colors.baseContent, fontSize: 13, lineHeight: 19, fontStyle: "italic" },
    tasteChip: {
      alignSelf: "flex-start",
      backgroundColor: colors.base300,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 5,
    },
    tasteChipText: { color: colors.primary, fontFamily: fonts.bold, fontSize: 12 },
    genreRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
    genreLabel: { color: colors.baseContent, fontSize: 12, width: 80 },
    genreBarTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.base300, overflow: "hidden" },
    genreBarFill: { height: "100%", borderRadius: 4, backgroundColor: colors.primary },
    genrePercent: { color: colors.placeholder, fontSize: 11, width: 34, textAlign: "right" },
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
    shareButtonText: { color: colors.primaryContent, fontFamily: fonts.bold },
  });
}

export default function ProfileAnalysisModal({ visible, onClose, data, shareable }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { refreshConversations } = useChat();
  const { showToast } = useToast();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [sending, setSending] = useState(false);

  const handleConfirmRecipients = async (userIds: string[], groupIds: string[]) => {
    if (!data || !user) return;
    setSending(true);
    try {
      const text = t("{{user}} is sharing their profile analysis with you.", { user: user.username });
      await Promise.all([
        ...userIds.map(async (userId) => {
          const conv = await getOrCreateConversation(userId);
          await sendRichMessage(conv._id, {
            text,
            type: "analysis_share",
            analysisData: { ...data, type: "profile" },
          });
        }),
        ...groupIds.map((groupId) =>
          sendGroupRichMessage(groupId, {
            text,
            type: "analysis_share",
            analysisData: { ...data, type: "profile" },
          })
        ),
      ]);
      await refreshConversations();
      setPickerVisible(false);
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
            {/* .toUpperCase() (not textTransform: "uppercase") so casing is
                JS-level and locale-invariant — RN's native uppercase
                transform honors the device's OS locale, turning "i" into
                "İ" on Turkish-locale devices regardless of app language. */}
            <Text style={styles.eyebrow}>{t("AI Cinematic Persona").toUpperCase()}</Text>
            <Text style={styles.nickname}>{data?.nickname || t("Silent Observer")}</Text>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {data ? (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{`🧠 ${t("Profile Insights")}`.toUpperCase()}</Text>
                  <Text style={styles.paragraph}>{data.personalitySummary}</Text>
                </View>

                {data.tasteCategory && (
                  <View style={styles.section}>
                    <View style={styles.tasteChip}>
                      <Text style={styles.tasteChipText}>{data.tasteCategory}</Text>
                    </View>
                  </View>
                )}

                {data.genreBreakdown && data.genreBreakdown.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{`📊 ${t("Genre Breakdown")}`.toUpperCase()}</Text>
                    {data.genreBreakdown.map((g) => (
                      <View key={g.genre} style={styles.genreRow}>
                        <Text style={styles.genreLabel} numberOfLines={1}>{g.genre}</Text>
                        <View style={styles.genreBarTrack}>
                          <View style={[styles.genreBarFill, { width: `${g.percentage}%` }]} />
                        </View>
                        <Text style={styles.genrePercent}>{g.percentage}%</Text>
                      </View>
                    ))}
                  </View>
                )}

                {data.trendVsLastAnalysis && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{`📈 ${t("Since Last Time")}`.toUpperCase()}</Text>
                    <Text style={styles.paragraph}>{data.trendVsLastAnalysis}</Text>
                  </View>
                )}

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{`💡 ${t("Recommended Vibe")}`.toUpperCase()}</Text>
                  <Text style={styles.paragraph}>{data.recommendedConcept}</Text>
                </View>

                <View style={styles.funFactBox}>
                  <Text style={styles.sectionTitle}>{`🍿 ${t("Did You Know?")}`.toUpperCase()}</Text>
                  <Text style={styles.funFactText}>"{data.funFact}"</Text>
                </View>
              </>
            ) : (
              <Text style={styles.paragraph}>{t("Aggregating statistics...")}</Text>
            )}
          </ScrollView>

          <View style={styles.buttonRow}>
            {shareable && data && (
              <Pressable style={styles.shareButton} onPress={() => setPickerVisible(true)}>
                <Text style={styles.shareButtonText}>{t("Share")}</Text>
              </Pressable>
            )}
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>{t("Close")}</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <UserSharePickerModal
        visible={pickerVisible}
        title={t("Share")}
        onClose={() => setPickerVisible(false)}
        sending={sending}
        onConfirm={handleConfirmRecipients}
        allowGroups
      />
    </Modal>
  );
}
