import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Pressable from "../common/TapSafePressable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import SheetModal, { SheetHeader } from "../collection/SheetModal";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

export interface SheetAction {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Red — for the actions that cost something (Block). */
  destructive?: boolean;
  onPress: () => void;
}

// A short list of actions in the app's own bottom sheet: the three-dots menu
// on reviews, posts, lists and messages, and a profile's Report / Block.
function ActionSheet({ visible, title, actions, onClose }: { visible: boolean; title: string; actions: SheetAction[]; onClose: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        body: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: insets.bottom + 16, gap: 4 },
        row: { flexDirection: "row", alignItems: "center", gap: 14, height: 56, paddingHorizontal: 12, borderRadius: 14 },
        pressed: { backgroundColor: colors.base200 },
        icon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.base200 },
        iconDanger: { backgroundColor: `${colors.error}1F` },
        label: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.baseContent },
        labelDanger: { color: colors.error },
      }),
    [colors, insets.bottom]
  );
  return (
    <SheetModal visible={visible} onClose={onClose} header={<SheetHeader title={title} onClose={onClose} />}>
      <View style={styles.body}>
        {actions.map((action) => (
          <Pressable
            key={action.key}
            onPress={action.onPress}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={[styles.icon, action.destructive && styles.iconDanger]}>
              <Ionicons name={action.icon} size={19} color={action.destructive ? colors.error : colors.baseContent} />
            </View>
            <Text style={[styles.label, action.destructive && styles.labelDanger]}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
    </SheetModal>
  );
}

export default memo(ActionSheet);
