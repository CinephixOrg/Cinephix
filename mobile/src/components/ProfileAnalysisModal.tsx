import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, Modal, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import UserSharePickerModal from "./UserSharePickerModal";
import { getOrCreateConversation, sendRichMessage } from "../api/conversationService";
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
      textTransform: "uppercase",
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
      textTransform: "uppercase",
    },
    funFactBox: { backgroundColor: colors.base300, borderRadius: 10, padding: 14 },
    funFactText: { color: colors.baseContent, fontSize: 13, lineHeight: 19, fontStyle: "italic" },
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

  const handleConfirmRecipients = async (userIds: string[]) => {
    if (!data || !user) return;
    setSending(true);
    try {
      await Promise.all(
        userIds.map(async (userId) => {
          const conv = await getOrCreateConversation(userId);
          await sendRichMessage(conv._id, {
            text: t("{{user}} is sharing their profile analysis with you.", { user: user.username }),
            type: "analysis_share",
            analysisData: { ...data, type: "profile" },
          });
        })
      );
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
            <Text style={styles.eyebrow}>{t("AI Cinematic Persona")}</Text>
            <Text style={styles.nickname}>{data?.nickname || t("Silent Observer")}</Text>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {data ? (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>🧠 {t("Profile Insights")}</Text>
                  <Text style={styles.paragraph}>{data.personalitySummary}</Text>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>💡 {t("Recommended Vibe")}</Text>
                  <Text style={styles.paragraph}>{data.recommendedConcept}</Text>
                </View>

                <View style={styles.funFactBox}>
                  <Text style={styles.sectionTitle}>🍿 {t("Did You Know?")}</Text>
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
      />
    </Modal>
  );
}
