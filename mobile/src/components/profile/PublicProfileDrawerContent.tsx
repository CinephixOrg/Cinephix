import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { useToast } from "../../context/ToastContext";
import { fonts } from "../../theme/typography";

interface Props {
  userId: string;
  onNavigate: () => void;
}

type MenuItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Under /user/[id]. */
  path: "watched" | "watchlist" | "lists";
};

const ITEMS: MenuItem[] = [
  { key: "watched", label: "Watched List", icon: "checkmark-done-outline", path: "watched" },
  { key: "watchlist", label: "Watchlist", icon: "bookmark-outline", path: "watchlist" },
  { key: "lists", label: "Lists", icon: "list-outline", path: "lists" },
];

// The public profile's slide-out drawer: the same drawer, rows and styling as
// the signed-in user's own (ProfileDrawerContent), holding this person's
// library. Each item opens a full, read-only page in this profile's stack.
//
// Report / Block sits apart at the bottom. It's a placeholder: there's no
// reporting or blocking backend yet, so it only says so.
export default function PublicProfileDrawerContent({ userId, onNavigate }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.base200 },
        items: { flex: 1 },
        row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 16 },
        pressed: { backgroundColor: colors.base300 },
        label: { fontFamily: fonts.medium, fontSize: 15, color: colors.baseContent, flex: 1 },
        divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: 20 },
        danger: { fontFamily: fonts.medium, fontSize: 15, color: colors.error, flex: 1 },
      }),
    [colors]
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.items}>
        {ITEMS.map((item) => (
          <Pressable
            key={item.key}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            accessibilityRole="button"
            onPress={() => {
              onNavigate();
              router.push(`/user/${userId}/${item.path}` as never);
            }}
          >
            <Ionicons name={item.icon} size={20} color={colors.baseContent} />
            <Text style={styles.label}>{t(item.label)}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.divider} />
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        accessibilityRole="button"
        onPress={() => {
          onNavigate();
          showToast(t("Reporting and blocking are coming soon."));
        }}
      >
        <Ionicons name="flag-outline" size={20} color={colors.error} />
        <Text style={styles.danger}>{t("Report / Block")}</Text>
      </Pressable>
    </SafeAreaView>
  );
}
