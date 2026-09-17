import { useEffect, useMemo, useRef } from "react";
import { Modal, View, Text, Pressable, Animated, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import type { ColorPalette } from "../theme/palettes";
import { fonts } from "../theme/typography";

interface Props {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Shown every time a viewer taps the "Currently Watching" button on
// Content Detail (was once-only at first, changed on direct ask) — the
// button press itself doesn't actually activate anything on its own tap,
// this explains what it does first, and only "Start Watching" here
// performs the real toggle-on. Same spring-scale + fade entrance
// BadgeEarnedModal.tsx's own icon already uses, reused here for the header
// icon.
export default function CurrentlyWatchingTutorialModal({ visible, onConfirm, onCancel }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.4);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [visible, scale, opacity]);

  const rows: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
    { icon: "eye-outline", text: t("Friends (or everyone, your choice) can see what you're watching right now in Discover.") },
    { icon: "checkmark-done-outline", text: t("It stops automatically once you add this to your Watched List.") },
    { icon: "hand-left-outline", text: t("Not done yet? Tap this same button anytime to stop manually.") },
  ];

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={styles.dismissZone} onPress={onCancel} />
        <View style={styles.card}>
          <Animated.View style={[styles.iconWrap, { opacity, transform: [{ scale }] }]}>
            <Ionicons name="play-circle" size={56} color={colors.primary} />
          </Animated.View>

          <Text style={styles.title}>{t("Currently Watching")}</Text>

          {rows.map((row) => (
            <View key={row.icon} style={styles.row}>
              <Ionicons name={row.icon} size={18} color={colors.primary} />
              <Text style={styles.rowText}>{row.text}</Text>
            </View>
          ))}

          <Pressable style={styles.confirmButton} onPress={onConfirm}>
            <Text style={styles.confirmButtonText}>{t("Start Watching")}</Text>
          </Pressable>
          <Pressable onPress={onCancel} hitSlop={8}>
            <Text style={styles.cancelText}>{t("Not now")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 28 },
    dismissZone: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    card: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: colors.base200,
      borderRadius: 20,
      paddingVertical: 28,
      paddingHorizontal: 24,
      alignItems: "center",
    },
    iconWrap: { marginBottom: 10 },
    title: { fontFamily: fonts.bold, fontSize: 18, color: colors.baseContent, textAlign: "center", marginBottom: 16 },
    row: { flexDirection: "row", alignItems: "flex-start", gap: 10, width: "100%", marginBottom: 12 },
    rowText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.baseContent },
    confirmButton: {
      marginTop: 8,
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 12,
      width: "100%",
      alignItems: "center",
    },
    confirmButtonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 14 },
    cancelText: { marginTop: 14, fontSize: 13, color: colors.placeholder },
  });
}
