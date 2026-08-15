import { useMemo } from "react";
import { Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";

export default function SettingsButton() {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  wrap: { marginRight: 12, padding: 4 },
}), [colors]);
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push("/profile/settings")}
      hitSlop={8}
      style={styles.wrap}
    >
      <Ionicons name="settings-outline" size={22} color={colors.baseContent} />
    </Pressable>
  );
}
