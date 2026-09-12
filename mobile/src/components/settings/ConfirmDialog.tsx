import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import { readableOn } from "../../utils/color";

// Shared by the glyph and the box it is measured into, so the two can't
// drift apart.
const ICON_SIZE = 22;

interface Props {
  visible: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  /** The action that proceeds. Styled as destructive when `danger`. */
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  /**
   * How much weight the confirm button carries. "soft" is a tinted ghost —
   * right when the cost of proceeding is losing a few edits. "solid" fills
   * it with the accent, for the irreversible ones.
   */
  emphasis?: "soft" | "solid";
  onConfirm: () => void;
  onCancel: () => void;
}

// A themed confirmation dialog.
//
// Replaces Alert.alert for in-app decisions: the platform alert can't be
// themed, so it landed in the middle of a carefully coloured page looking
// like it belonged to a different app.
//
// The safe choice is the filled button and the destructive one is a ghost —
// the opposite of the usual "primary action is the one that proceeds",
// because here proceeding is what loses work.
function ConfirmDialog({
  visible,
  icon = "alert-circle-outline",
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  emphasis = "soft",
  onConfirm,
  onCancel,
}: Props) {
  const { colors } = useTheme();
  const reveal = useRef(new Animated.Value(0)).current;
  // Kept mounted through the exit animation. Letting Modal unmount on
  // `visible` alone means the dialog vanishes instantly, and only the
  // entrance is ever seen.
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
    const animation = Animated.timing(reveal, {
      toValue: visible ? 1 : 0,
      duration: visible ? 200 : 140,
      easing: visible ? Easing.out(Easing.back(1.3)) : Easing.in(Easing.quad),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return () => animation.stop();
  }, [reveal, visible]);

  const accent = danger ? colors.error : colors.primary;
  const solid = emphasis === "solid";

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          alignItems: "center",
          justifyContent: "center",
          padding: 28,
        },
        card: {
          width: "100%",
          maxWidth: 340,
          backgroundColor: colors.base200,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 22,
          gap: 14,
        },
        plate: {
          width: 44,
          height: 44,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          // A wash of the accent rather than a solid fill, so it reads on
          // every palette without needing a per-theme contrast colour.
          backgroundColor: `${accent}1F`,
        },
        // Ionicons render as Text, and Android adds ascender/descender
        // padding to every Text by default — which is what pushed the glyph
        // below the centre of its plate. Pinning the box to the glyph size
        // and dropping that padding makes the icon sit true in both axes.
        icon: {
          width: ICON_SIZE,
          height: ICON_SIZE,
          lineHeight: ICON_SIZE,
          fontSize: ICON_SIZE,
          textAlign: "center",
          textAlignVertical: "center",
          includeFontPadding: false,
        },
        title: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.baseContent },
        message: {
          fontFamily: fonts.regular,
          fontSize: 13,
          lineHeight: 19,
          color: colors.placeholder,
        },
        actions: { flexDirection: "row", gap: 9, marginTop: 4 },
        button: {
          flex: 1,
          borderRadius: 12,
          paddingVertical: 13,
          alignItems: "center",
          justifyContent: "center",
        },
        confirm: { backgroundColor: solid ? accent : `${accent}1A` },
        confirmText: {
          fontFamily: fonts.bold,
          fontSize: 14,
          color: solid ? readableOn(accent) : accent,
        },
        cancel: { backgroundColor: colors.base300 },
        cancelText: { fontFamily: fonts.bold, fontSize: 14, color: colors.baseContent },
      }),
    [colors, accent, solid]
  );

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onCancel} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: reveal }]}>
        {/* Tapping outside is the same as cancelling — never the destructive
            branch, which must be chosen deliberately. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityRole="button" />
        <Animated.View
          style={[
            styles.card,
            {
              transform: [
                { scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
                { translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
              ],
            },
          ]}
        >
          <View style={styles.plate}>
            <Ionicons name={icon} size={ICON_SIZE} color={accent} style={styles.icon} />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable
              style={[styles.button, styles.confirm]}
              onPress={onConfirm}
              accessibilityRole="button"
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.cancel]}
              onPress={onCancel}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

export default memo(ConfirmDialog);
