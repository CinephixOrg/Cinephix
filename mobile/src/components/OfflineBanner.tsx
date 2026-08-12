import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useNetwork } from "../context/NetworkContext";
import { useTheme } from "../context/ThemeContext";
import type { ColorPalette } from "../theme/palettes";
import { fonts } from "../theme/typography";

function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    banner: {
      backgroundColor: colors.warning,
      paddingBottom: 8,
      paddingHorizontal: 16,
      alignItems: "center",
    },
    text: { color: "#000000", fontFamily: fonts.medium, fontSize: 12, textAlign: "center" },
  });
}

export default function OfflineBanner() {
  const { isOffline } = useNetwork();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => buildStyles(colors), [colors]);

  if (!isOffline) return null;

  return (
    <View style={[styles.banner, { paddingTop: insets.top > 0 ? insets.top : 8 }]}>
      <Text style={styles.text}>{t("You're offline. Some features may not work.")}</Text>
    </View>
  );
}
