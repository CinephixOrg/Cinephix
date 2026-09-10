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
          // headerRight is set dynamically by index.tsx itself (a hamburger
          // opening the new drawer, whose open/close state lives there) —
          // no static override needed here.
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
      <Stack.Screen name="import" options={{ title: t("Import Data") }} />
      <Stack.Screen name="about" options={{ title: t("About") }} />
      <Stack.Screen name="privacy" options={{ title: t("Privacy Policy") }} />
      <Stack.Screen name="terms" options={{ title: t("Terms of Service") }} />
    </Stack>
  );
}
