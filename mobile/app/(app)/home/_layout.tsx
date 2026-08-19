import { Image, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import NotificationBell from "../../../src/components/NotificationBell";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

const styles = StyleSheet.create({
  // Just the "C" glyph now, no wordmark text next to it — the old
  // logo+"inephix" title took up real horizontal room for what the user
  // felt was a header that was too visually heavy; the icon alone in the
  // corner reads as a brand mark without competing with the notification
  // bell for space.
  logo: { width: 22, height: 25, resizeMode: "contain", marginLeft: 12 },
});

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
        options={{
          // headerTitle is overridden dynamically by index.tsx itself (the
          // Paylaşımlar/Keşfet switcher, which needs the screen's own
          // outerTab state) via navigation.setOptions() — same pattern
          // Profile's drawer hamburger button already uses. No static
          // title here.
          headerLeft: () => <Image source={require("../../../assets/cinephix_logo.png")} style={styles.logo} />,
          headerRight: () => <NotificationBell />,
        }}
      />
      <Stack.Screen name="content/[type]/[id]" options={{ title: "" }} />
      <Stack.Screen name="lists/[id]" options={{ title: t("List") }} />
    </Stack>
  );
}
