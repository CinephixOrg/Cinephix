import { useMemo, useState } from "react";
import { View, Pressable, Modal, StyleSheet, type LayoutChangeEvent } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import MatchAnalysisPanel from "../match/MatchAnalysisPanel";
import type { MatchFilters } from "../../api/matchService";
import type { SyncCandidate } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import type { ColorPalette } from "../../theme/palettes";

interface Props {
  visible: boolean;
  onClose: () => void;
  candidate: SyncCandidate;
  filters: MatchFilters;
}

function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "center",
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    // Same neutral frame as the Profile Analysis modal, so the app's two
    // analysis pop-ups read as one family rather than two designs.
    sheet: { backgroundColor: colors.base100, borderRadius: 20, maxHeight: "94%" },
    // No overflow:hidden. MatchAnalysisPanel's title badge is deliberately
    // centered ON its card's top edge, so roughly half of it renders above
    // y:0 — clipping the sheet would slice it in half. borderRadius still
    // rounds the sheet's own background without it.
    panelWrap: { paddingTop: 8 },
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

// The full Sync analysis as a centered pop-up, hosting the very same
// MatchAnalysisPanel the Sync page renders inline under a tapped bubble —
// not a second, simpler write-up of the same data. Opened from the Sync
// Score card's ⓘ on a public profile.
export default function SyncAnalysisModal({ visible, onClose, candidate, filters }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const [panelWidth, setPanelWidth] = useState(0);

  const handleLayout = (e: LayoutChangeEvent) => setPanelWidth(e.nativeEvent.layout.width);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* An RN Modal is its own native window, outside the app-root
          GestureHandlerRootView — without a second one here the panel's
          horizontal poster rows (gesture-handler ScrollViews) wouldn't
          scroll at all. */}
      <GestureHandlerRootView style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.panelWrap} onLayout={handleLayout}>
            {panelWidth > 0 && (
              <MatchAnalysisPanel candidate={candidate} filters={filters} containerWidth={panelWidth} source="profile" />
            )}
          </View>

          <View style={styles.buttonRow}>
            <Pressable style={styles.closeButton} onPress={onClose} accessibilityLabel={t("Close")}>
              <Ionicons name="close" size={24} color={colors.baseContent} />
            </Pressable>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
