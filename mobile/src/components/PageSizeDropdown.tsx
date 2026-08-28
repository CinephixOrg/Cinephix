import { useMemo, useRef, useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const PAGE_SIZE_OPTIONS = [5, 10, 25] as const;

interface Props {
  value: number;
  onChange: (size: number) => void;
}

// Compact "N per page" control for a list's own header row — a real
// anchored dropdown (menu measured off the trigger's on-screen position via
// measureInWindow, since Modal content renders outside normal layout flow
// and needs absolute screen coordinates), not a full-screen picker, which
// would be overkill for a 3-item choice.
export default function PageSizeDropdown({ value, onChange }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const triggerRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [menuTop, setMenuTop] = useState(0);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        trigger: {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.base200,
        },
        triggerText: { fontFamily: fonts.medium, fontSize: 12, color: colors.baseContent },
        backdrop: { flex: 1 },
        menu: {
          position: "absolute",
          right: 20,
          backgroundColor: colors.base200,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
          minWidth: 140,
        },
        option: { paddingHorizontal: 14, paddingVertical: 12 },
        optionActive: { backgroundColor: colors.base300 },
        optionText: { fontFamily: fonts.medium, fontSize: 13, color: colors.baseContent },
        optionTextActive: { color: colors.primary, fontFamily: fonts.bold },
      }),
    [colors]
  );

  const openMenu = () => {
    triggerRef.current?.measureInWindow((_x, y, _width, height) => {
      setMenuTop(y + height + 4);
      setOpen(true);
    });
  };

  return (
    <>
      <Pressable ref={triggerRef} style={styles.trigger} onPress={openMenu}>
        <Text style={styles.triggerText}>{t("{{count}} per page", { count: value })}</Text>
        <Ionicons name="chevron-down" size={14} color={colors.baseContent} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { top: menuTop }]}>
            {PAGE_SIZE_OPTIONS.map((size) => {
              const active = size === value;
              return (
                <Pressable
                  key={size}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => {
                    onChange(size);
                    setOpen(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {t("{{count}} per page", { count: size })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
