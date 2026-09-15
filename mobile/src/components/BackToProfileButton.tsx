import { Platform, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";

// Header back arrow for the Watched List, the Watchlist and the Lists page.
//
// Each is the root of a hidden tab, so its stack has no screen below it to
// give it a native back button — and the tab navigator's default back
// behaviour ("firstRoute") would send the user to Home. Their only way in is
// the Profile drawer, so the arrow returns there. The hardware back button
// does the same (see CollectionScreen and MyListsScreen).
export default function BackToProfileButton() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={() => router.navigate("/profile")}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={t("Back")}
      style={({ pressed }) => [{ paddingVertical: 4, paddingRight: 12 }, pressed && { opacity: 0.6 }]}
    >
      <Ionicons name={Platform.OS === "ios" ? "chevron-back" : "arrow-back"} size={24} color={colors.baseContent} />
    </Pressable>
  );
}
