import { View, Text, Pressable, ScrollView, Modal, Platform, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import type { MatchAnalysis } from "../types";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

interface Props {
  visible: boolean;
  onClose: () => void;
  data: MatchAnalysis | null;
}

// Close-only — web's "Share" button DMs the analysis to the matched user,
// which mobile can't do (no chat/DM feature exists here at all).
export default function AnalyzeModal({ visible, onClose, data }: Props) {
  const { t } = useTranslation();
  const parsed = data?.parsed;
  const graphAscii = Array.isArray(parsed?.graph_ascii)
    ? parsed?.graph_ascii.join("\n")
    : parsed?.graph_ascii;

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

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>{t("Close")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  closeButton: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  closeButtonText: { color: colors.baseContent, fontFamily: fonts.medium },
});
