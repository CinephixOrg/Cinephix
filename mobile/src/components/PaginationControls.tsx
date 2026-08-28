import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

interface Props {
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
}

// Prev/Next + "Page X of Y" — always rendered, even at 1 of 1 (both arrows
// simply disabled), so the control reads as "here's where you are" rather
// than popping in/out as the list grows. Page-size selection lives
// separately in PageSizeDropdown, next to the list's own heading.
export default function PaginationControls({ page, pages, onPageChange }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        navRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 16 },
        navButton: {
          width: 34,
          height: 34,
          borderRadius: 17,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
        },
        navButtonDisabled: { opacity: 0.35 },
        pageText: { fontFamily: fonts.medium, fontSize: 13, color: colors.baseContent, minWidth: 90, textAlign: "center" },
      }),
    [colors]
  );

  return (
    <View style={styles.navRow}>
      <Pressable
        style={[styles.navButton, page <= 1 && styles.navButtonDisabled]}
        onPress={() => onPageChange(page - 1)}
        disabled={page <= 1}
        hitSlop={6}
      >
        <Ionicons name="chevron-back" size={18} color={colors.baseContent} />
      </Pressable>
      <Text style={styles.pageText}>{t("Page {{page}} of {{pages}}", { page, pages })}</Text>
      <Pressable
        style={[styles.navButton, page >= pages && styles.navButtonDisabled]}
        onPress={() => onPageChange(page + 1)}
        disabled={page >= pages}
        hitSlop={6}
      >
        <Ionicons name="chevron-forward" size={18} color={colors.baseContent} />
      </Pressable>
    </View>
  );
}
