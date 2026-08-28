import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { GroupCategory } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

export type CommunityInnerTab = "all" | "mine";
export type CommunityCategory = "all" | GroupCategory;

const CATEGORIES: CommunityCategory[] = ["all", "genre", "director", "era", "style"];

export interface CommunityFilters {
  innerTab: CommunityInnerTab;
  category: CommunityCategory;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  filters: CommunityFilters;
  onApply: (filters: CommunityFilters) => void;
}

// Consolidates what used to be an always-visible inline row (a segmented
// All/Mine toggle + a horizontally-scrolling category chip strip, both
// competing for space above the group grid) into a single bottom sheet —
// same shape as MatchFiltersModal (draft state, re-seeded from the current
// filters each time it opens, applied only on the explicit button) so
// Cinematch's filter sheet and this one behave identically.
export default function CommunityFiltersModal({ visible, onClose, filters, onApply }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [innerTab, setInnerTab] = useState<CommunityInnerTab>(filters.innerTab);
  const [category, setCategory] = useState<CommunityCategory>(filters.category);

  useEffect(() => {
    if (visible) {
      setInnerTab(filters.innerTab);
      setCategory(filters.category);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleApply = () => {
    onApply({ innerTab, category });
    onClose();
  };

  const handleReset = () => {
    setInnerTab("all");
    setCategory("all");
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
        sheet: {
          backgroundColor: colors.base200,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          maxHeight: "80%",
        },
        header: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          padding: 18,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        title: { fontFamily: fonts.bold, fontSize: 17, color: colors.baseContent },
        content: { padding: 20, paddingBottom: 8 },
        sectionLabel: { fontFamily: fonts.bold, fontSize: 12, color: colors.placeholder, marginBottom: 10 },
        section: { marginBottom: 24 },
        segmentedRow: { flexDirection: "row", gap: 10 },
        segment: {
          flex: 1,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          paddingVertical: 12,
          alignItems: "center",
        },
        segmentActive: { backgroundColor: colors.primary, borderColor: colors.primary },
        segmentText: { fontFamily: fonts.medium, color: colors.baseContent, fontSize: 14 },
        segmentTextActive: { color: colors.primaryContent },
        chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
        chip: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 18,
          paddingHorizontal: 14,
          paddingVertical: 8,
        },
        chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
        chipText: { fontSize: 13, color: colors.baseContent, textTransform: "capitalize" },
        chipTextActive: { color: colors.primaryContent, fontFamily: fonts.medium },
        footer: {
          flexDirection: "row",
          gap: 10,
          padding: 20,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        resetButton: {
          flex: 1,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          paddingVertical: 15,
          alignItems: "center",
        },
        resetButtonText: { color: colors.baseContent, fontFamily: fonts.medium, fontSize: 15 },
        applyButton: { flex: 2, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
        applyButtonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 15 },
      }),
    [colors]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{t("Filters")}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.baseContent} />
            </Pressable>
          </View>

          <View style={styles.content}>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t("SHOW")}</Text>
              <View style={styles.segmentedRow}>
                <Pressable
                  style={[styles.segment, innerTab === "all" && styles.segmentActive]}
                  onPress={() => setInnerTab("all")}
                >
                  <Text style={[styles.segmentText, innerTab === "all" && styles.segmentTextActive]}>{t("All")}</Text>
                </Pressable>
                <Pressable
                  style={[styles.segment, innerTab === "mine" && styles.segmentActive]}
                  onPress={() => setInnerTab("mine")}
                >
                  <Text style={[styles.segmentText, innerTab === "mine" && styles.segmentTextActive]}>{t("Mine")}</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t("CATEGORY")}</Text>
              <View style={styles.chipWrap}>
                {CATEGORIES.map((cat) => {
                  const active = category === cat;
                  return (
                    <Pressable
                      key={cat}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(cat)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <Pressable style={styles.resetButton} onPress={handleReset}>
              <Text style={styles.resetButtonText}>{t("Reset")}</Text>
            </Pressable>
            <Pressable style={styles.applyButton} onPress={handleApply}>
              <Text style={styles.applyButtonText}>{t("Apply Filters")}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
