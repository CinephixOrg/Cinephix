import { useMemo, type ReactNode } from "react";
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import type { ColorPalette } from "../../theme/palettes";
import { fonts } from "../../theme/typography";

// Exported so callers can size their own grid columns against the same box
// this sheet lays content out in.
export const SEE_ALL_OVERLAY_PADDING = 14;
export const SEE_ALL_SHEET_PADDING = 16;
export const SEE_ALL_GRID_GAP = 10;

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  // How many rows the caller is rendering, and how many exist in total.
  // They differ when the endpoint capped what it sent.
  shown: number;
  total: number;
  children: ReactNode;
}

function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "center",
      paddingHorizontal: SEE_ALL_OVERLAY_PADDING,
      paddingVertical: 12,
    },
    // Same neutral frame as the app's other pop-ups (Sync Analysis, Profile
    // Analysis) so these read as one family.
    sheet: { backgroundColor: colors.base100, borderRadius: 20, maxHeight: "88%", overflow: "hidden" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: SEE_ALL_SHEET_PADDING,
      paddingTop: 18,
    },
    title: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.baseContent },
    count: { fontSize: 12, color: colors.placeholder, fontFamily: fonts.medium },
    scroll: { paddingHorizontal: SEE_ALL_SHEET_PADDING, paddingTop: 14, paddingBottom: 4 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: SEE_ALL_GRID_GAP },
    footnote: { fontSize: 11, color: colors.placeholder, textAlign: "center", paddingTop: 8 },
    empty: { color: colors.placeholder, fontSize: 13, textAlign: "center", paddingVertical: 30 },
    buttonRow: { flexDirection: "row", justifyContent: "center", paddingVertical: 12 },
    closeButton: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.base300,
    },
  });
}

// The "See all" sheet behind each rail on the Lists tab — the rail's own
// cards, laid out as a scrollable grid instead of a strip. Content-agnostic
// so the three rails (which render two different card types) share one sheet
// rather than each needing its own.
export default function CollectionSeeAllModal({ visible, onClose, title, shown, total, children }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => buildStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.count}>{total}</Text>
          </View>

          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {shown === 0 ? <Text style={styles.empty}>{t("Nothing here yet.")}</Text> : <View style={styles.grid}>{children}</View>}
            {/* The endpoint caps how much it ships, so say when there's more
                rather than letting "See all" quietly mean "see some". */}
            {total > shown && (
              <Text style={styles.footnote}>{t("Showing {{shown}} of {{total}}.", { shown, total })}</Text>
            )}
          </ScrollView>

          <View style={styles.buttonRow}>
            <Pressable style={styles.closeButton} onPress={onClose} accessibilityLabel={t("Close")}>
              <Ionicons name="close" size={24} color={colors.baseContent} />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
