import { View, Image, Text, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import NotificationBell from "../../../src/components/NotificationBell";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

const styles = StyleSheet.create({
  wordmark: { flexDirection: "row", alignItems: "center", gap: 2 },
  // Real brand mark (cinephix_logo.png — a solid "C" glyph, transparent
  // background), not assets/icon.png, which is still the unmodified Expo
  // template icon and was never actually customized for this app.
  logo: { width: 24, height: 27, resizeMode: "contain" },
});

// The logo stands in for the "C" of "Cinephix" — not translated, a brand
// wordmark like the plain-string title it replaces.
function HomeHeaderTitle() {
  const { colors } = useTheme();
  return (
    <View style={styles.wordmark}>
      <Image source={require("../../../assets/cinephix_logo.png")} style={styles.logo} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.baseContent }}>inephix</Text>
    </View>
  );
}

export default function HomeStackLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.base300 },
        headerTitleStyle: { fontFamily: fonts.bold, color: colors.baseContent },
        headerTintColor: colors.baseContent,
        headerTitleAlign: "center",
      }}
    >
      <Stack.Screen
        name="index"
        options={{ headerTitle: () => <HomeHeaderTitle />, headerRight: () => <NotificationBell /> }}
      />
      <Stack.Screen name="content/[type]/[id]" options={{ title: "" }} />
      <Stack.Screen name="lists/[id]" options={{ title: t("List") }} />
    </Stack>
  );
}
