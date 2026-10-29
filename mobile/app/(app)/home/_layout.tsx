import { Image, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

const styles = StyleSheet.create({
  // Just the "C" glyph now, no wordmark text next to it — the old
  // logo+"inephix" title took up real horizontal room for what the user
  // felt was a header that was too visually heavy; the icon alone in the
  // corner reads as a brand mark without competing with headerRight
  // (PodiumHeaderIcon) for space.
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
          // headerTitle AND headerRight are both overridden dynamically by
          // index.tsx itself via navigation.setOptions() — the title
          // needs the screen's own outerTab state (Paylaşımlar/Keşfet
          // switcher), and headerRight now needs it too (PodiumHeaderIcon,
          // routed to whichever podium page matches the active tab) —
          // same pattern Profile's drawer hamburger button already uses.
          // No static title/right here.
          headerLeft: () => <Image source={require("../../../assets/cinephix_logo.png")} style={styles.logo} />,
        }}
      />
      <Stack.Screen name="content/[type]/[id]" options={{ title: "" }} />
      <Stack.Screen name="content/[type]/[id]/reviews" options={{ title: t("Reviews") }} />
      <Stack.Screen name="content/[type]/[id]/lists" options={{ title: t("Lists") }} />
      <Stack.Screen name="content/[type]/[id]/watched" options={{ title: t("Watched") }} />
      <Stack.Screen name="content/[type]/[id]/favorited" options={{ title: t("Favorites") }} />
      <Stack.Screen name="content/[type]/[id]/write-review" options={{ title: "" }} />
      <Stack.Screen name="content/[type]/[id]/similar" options={{ title: t("Similar") }} />
      <Stack.Screen name="analyze-story" options={{ headerShown: false }} />
      <Stack.Screen name="lists/[id]" options={{ title: t("List") }} />
      <Stack.Screen name="reviews" options={{ title: t("Reviews") }} />
      <Stack.Screen name="lists-discover" options={{ title: t("Lists") }} />
      <Stack.Screen name="activity" options={{ title: t("Friends' Activity") }} />
      {/* No static title — WatchPartyRoomScreen sets its own dynamically. */}
      <Stack.Screen name="watch-party/[id]" options={{ title: "" }} />
      {/* Community Announcements rail destinations, nested here for the
          same back-button reason as watch-party/[id] above. */}
      <Stack.Screen name="community-challenge/[slug]" options={{ title: "" }} />
      <Stack.Screen name="community-leaderboard/[slug]" options={{ title: "" }} />
    </Stack>
  );
}
