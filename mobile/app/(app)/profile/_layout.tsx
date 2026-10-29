import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

export default function ProfileStackLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.base200 },
        headerTitleStyle: { fontFamily: fonts.bold, color: colors.baseContent },
        headerTintColor: colors.baseContent,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: t("Profile"),
          // headerTitle/headerRight are both overridden dynamically by
          // index.tsx itself — headerTitle adds the ringing gradient
          // Analyze icon beside the title text, headerRight is the
          // compose "+"/hamburger pair (whose open/close state lives
          // there). `title` above is just the fallback before that first
          // effect run.
        }}
      />
      <Stack.Screen name="content/[type]/[id]" options={{ title: "" }} />
      <Stack.Screen name="content/[type]/[id]/reviews" options={{ title: t("Reviews") }} />
      <Stack.Screen name="content/[type]/[id]/lists" options={{ title: t("Lists") }} />
      <Stack.Screen name="content/[type]/[id]/watched" options={{ title: t("Watched") }} />
      <Stack.Screen name="content/[type]/[id]/favorited" options={{ title: t("Favorites") }} />
      <Stack.Screen name="content/[type]/[id]/write-review" options={{ title: "" }} />
      <Stack.Screen name="content/[type]/[id]/similar" options={{ title: t("Similar") }} />
      <Stack.Screen name="lists/[id]" options={{ title: t("List") }} />
      <Stack.Screen name="genre/[type]/[genre]" options={{ title: "" }} />
      <Stack.Screen name="settings" options={{ title: t("Settings") }} />
      <Stack.Screen name="activity" options={{ title: t("Activity") }} />
      <Stack.Screen name="activity-log" options={{ title: t("Activity Log") }} />
      <Stack.Screen name="blocked" options={{ title: t("Blocked accounts") }} />
      <Stack.Screen name="support/index" options={{ title: t("Help & Feedback") }} />
      <Stack.Screen name="support/new" options={{ title: t("New ticket") }} />
      <Stack.Screen name="support/[id]" options={{ title: t("Ticket") }} />
      <Stack.Screen name="import" options={{ title: t("Import") }} />
      <Stack.Screen name="about" options={{ title: t("About") }} />
      <Stack.Screen name="privacy" options={{ title: t("Privacy Policy") }} />
      <Stack.Screen name="terms" options={{ title: t("Terms of Service") }} />
      <Stack.Screen name="credits" options={{ title: t("Credits") }} />
      <Stack.Screen name="analyses" options={{ title: t("My Analyses") }} />
      {/* No native header — a full-screen story takeover (progress bar +
          close button are its own chrome), same reasoning
          SyncIntroStory.tsx's own screen (app/(app)/match/index.tsx) has
          no header either. */}
      <Stack.Screen name="analyze-story" options={{ headerShown: false }} />
    </Stack>
  );
}
