import { useMemo } from "react";
import { Text, StyleSheet } from "react-native";
import Pressable from "../common/TapSafePressable";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";

interface Props {
  // e.g. "Showing 5 of 12" — the card's own specific truncation, so each
  // caller states its own count rather than this component guessing one.
  label: string;
}

// Small, tappable "there's more behind a paywall" row — shared by every
// Plus-tier card that shows a partial list instead of the full one
// (Shared Genres, Variety, Activity, Social Overlap), so the paywall
// mechanic reads as one consistent pattern across the whole deck rather
// than a different trick per card.
export default function LockedUnlockNote({ label }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12, paddingVertical: 4 },
        text: { fontSize: 12, color: colors.placeholder, textDecorationLine: "underline" },
      }),
    [colors]
  );

  return (
    <Pressable style={styles.row} onPress={() => router.push("/match/subscription" as any)}>
      <Ionicons name="lock-closed" size={13} color={colors.placeholder} />
      <Text style={styles.text}>
        {label} — {t("Get Premium to unlock all")}
      </Text>
    </Pressable>
  );
}
