import { useMemo } from "react";
import { View, Text, Pressable, Modal, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSendToPeople: () => void;
  onShareToMedia: () => void;
  sharing?: boolean;
}

// Small 2-option popover shared by every "share" entry point that already
// has a real DM/community picker (Analysis, Recommendation) — "Media'da
// Paylaş" is the one genuinely new option, "Kişiye/Topluluğa Gönder" just
// opens the existing UserSharePickerModal flow unchanged. Reviews don't use
// this component — they get a simpler Save/Save+Share toggle instead,
// since there's no existing DM-sharing precedent for reviews to preserve.
export default function ShareOptionsMenu({ visible, onClose, onSendToPeople, onShareToMedia, sharing }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
        card: {
          backgroundColor: colors.base200,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingTop: 8,
          paddingBottom: 24,
        },
        row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
        rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: 20 },
        rowText: { fontFamily: fonts.medium, fontSize: 15, color: colors.baseContent },
        iconWrap: {
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: colors.base300,
          alignItems: "center",
          justifyContent: "center",
        },
      }),
    [colors]
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Pressable style={styles.row} onPress={onSendToPeople}>
            <View style={styles.iconWrap}>
              <Ionicons name="paper-plane-outline" size={18} color={colors.baseContent} />
            </View>
            <Text style={styles.rowText}>{t("Send to a Person or Community")}</Text>
          </Pressable>
          <View style={styles.rowDivider} />
          <Pressable style={styles.row} onPress={onShareToMedia} disabled={sharing}>
            <View style={styles.iconWrap}>
              {sharing ? (
                <ActivityIndicator size="small" color={colors.baseContent} />
              ) : (
                <Ionicons name="newspaper-outline" size={18} color={colors.baseContent} />
              )}
            </View>
            <Text style={styles.rowText}>{t("Share to Media")}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
