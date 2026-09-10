import { useMemo, type ReactNode } from "react";
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

interface Props {
  visible: boolean;
  onClose: () => void;
  onClear: () => void;
  hasActiveFilters: boolean;
  title: string;
  children: ReactNode;
}

// Shared bottom-sheet shell for every Search tab's own filter content
// (Movies/Series' genre+year chips, Lists' sort, Reviews' rating range+sort)
// — replaces the old always-visible inline `ContentFilterPanel` (a boxed
// column list that pushed the results down) with the standard modern
// pattern (Letterboxd/Spotify-style slide-up sheet) the rest of this app's
// own redesigned screens already use elsewhere. Each tab supplies its own
// filter controls as children; this shell only owns the open/close chrome,
// the dimmed backdrop, and the Clear-all/Done footer — filters themselves
// still apply live (unchanged interaction model, just a different chrome),
// so "Done" only closes the sheet rather than committing a separate staged
// state.
export default function FilterBottomSheet({ visible, onClose, onClear, hasActiveFilters, title, children }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
        sheet: {
          backgroundColor: colors.base100,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          maxHeight: "80%",
          paddingBottom: insets.bottom + 12,
        },
        grabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginTop: 10 },
        header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
        title: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.baseContent },
        closeButton: { padding: 4 },
        content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
        footer: {
          flexDirection: "row",
          gap: 12,
          paddingHorizontal: 20,
          paddingTop: 12,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        clearButton: {
          flex: 1,
          borderRadius: 12,
          paddingVertical: 13,
          alignItems: "center",
          borderWidth: 1.5,
          borderColor: colors.border,
        },
        clearButtonDisabled: { opacity: 0.4 },
        clearButtonText: { fontFamily: fonts.bold, fontSize: 14, color: colors.baseContent },
        doneButton: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: "center", backgroundColor: colors.primary },
        doneButtonText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primaryContent },
      }),
    [colors, insets.bottom]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.baseContent} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
          <View style={styles.footer}>
            <Pressable
              style={[styles.clearButton, !hasActiveFilters && styles.clearButtonDisabled]}
              onPress={onClear}
              disabled={!hasActiveFilters}
            >
              <Text style={styles.clearButtonText}>{t("Clear All")}</Text>
            </Pressable>
            <Pressable style={styles.doneButton} onPress={onClose}>
              <Text style={styles.doneButtonText}>{t("Done")}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
