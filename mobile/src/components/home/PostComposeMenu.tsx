import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Pressable from "../common/TapSafePressable";
// A Modal needs its own gesture root for the app's Pressables to work inside it.
import Modal from "../common/GestureModal";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

export interface ComposeCategory {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  categories: ComposeCategory[];
}

// The Shares page's "+" button menu. Deliberately a pure dispatcher, not a
// composer: each row is only ever a navigate-to-an-existing-screen plus a
// one-line toast hint (both owned by the category's own onPress, wired in
// SharesFeedSection.tsx) — never a form, never a direct create action here.
// Visually modeled on ShareOptionsMenu.tsx's own bottom-sheet (icon-circle +
// label rows, dividers between them), generalized from that component's
// fixed 2 options to an arbitrary list since this menu needs 5.
export default function PostComposeMenu({ visible, onClose, categories }: Props) {
  const { colors } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
        card: {
          backgroundColor: colors.base200,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingTop: 8,
          paddingBottom: 24,
        },
        row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
        rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: 20 },
        rowText: { fontFamily: fonts.medium, fontSize: 15, color: colors.baseContent },
        iconWrap: {
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: colors.base300,
          alignItems: "center",
          justifyContent: "center",
        },
      }),
    [colors]
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          {categories.map((cat, i) => (
            <View key={cat.key}>
              {i > 0 && <View style={styles.rowDivider} />}
              <Pressable style={styles.row} onPress={cat.onPress}>
                <View style={styles.iconWrap}>
                  <Ionicons name={cat.icon} size={18} color={colors.baseContent} />
                </View>
                <Text style={styles.rowText}>{cat.label}</Text>
              </Pressable>
            </View>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
