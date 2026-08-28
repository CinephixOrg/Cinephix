import { useMemo } from "react";
import { View, Pressable, StyleSheet, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";

interface Props {
  style?: ViewStyle;
  onPress: () => void;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// One free favorites slot (favorites are capped at 5) — only rendered while
// a rail is in edit mode, matching FavoriteCard's own poster proportions so
// the row stays visually aligned. Tapping it opens AddFavoriteModal.
export default function EmptyFavoriteSlot({ style, onPress }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: { width: "48%", marginBottom: 16 },
        slot: {
          width: "100%",
          aspectRatio: 2 / 3,
          borderRadius: 8,
          backgroundColor: hexToRgba(colors.placeholder, 0.16),
          alignItems: "center",
          justifyContent: "center",
        },
      }),
    [colors]
  );

  return (
    <View style={[styles.card, style]}>
      <Pressable style={styles.slot} onPress={onPress} accessibilityLabel={t("Add")}>
        <Ionicons name="add" size={30} color={colors.placeholder} />
      </Pressable>
    </View>
  );
}
