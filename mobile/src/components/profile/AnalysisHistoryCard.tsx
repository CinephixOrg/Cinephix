import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { ProfileAnalysisHistoryEntry } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

interface Props {
  entry: ProfileAnalysisHistoryEntry;
  onPress: () => void;
}

export default function AnalysisHistoryCard({ entry, onPress }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          alignSelf: "stretch",
          backgroundColor: colors.base200,
          borderRadius: 12,
          padding: 14,
          marginBottom: 10,
        },
        topRow: { flexDirection: "row", alignItems: "center", gap: 8 },
        emoji: { fontSize: 18 },
        nickname: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent },
        chevron: { marginLeft: 4 },
        tasteChip: {
          alignSelf: "flex-start",
          backgroundColor: colors.base300,
          borderRadius: 12,
          paddingHorizontal: 10,
          paddingVertical: 3,
          marginTop: 8,
        },
        tasteChipText: { color: colors.primary, fontFamily: fonts.bold, fontSize: 11 },
        summary: { color: colors.placeholder, fontSize: 13, lineHeight: 18, marginTop: 8 },
        footer: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
        date: { color: colors.placeholder, fontSize: 11 },
      }),
    [colors]
  );

  const formattedDate = new Date(entry.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.topRow}>
        <Text style={styles.emoji}>🎬</Text>
        <Text style={styles.nickname} numberOfLines={1}>
          {entry.result.nickname}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.placeholder} style={styles.chevron} />
      </View>

      {entry.result.tasteCategory && (
        <View style={styles.tasteChip}>
          <Text style={styles.tasteChipText}>{entry.result.tasteCategory}</Text>
        </View>
      )}

      <Text style={styles.summary} numberOfLines={2}>
        {entry.result.personalitySummary}
      </Text>

      <View style={styles.footer}>
        <Ionicons name="calendar-outline" size={12} color={colors.placeholder} />
        <Text style={styles.date}>{t("Generated on {{date}}", { date: formattedDate })}</Text>
      </View>
    </Pressable>
  );
}
