import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import NotificationBell from "../../../src/components/NotificationBell";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

export default function SocialsStackLayout() {
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
        options={{ title: t("Socials"), headerRight: () => <NotificationBell /> }}
      />
      <Stack.Screen name="messages/new" options={{ title: t("New Message"), presentation: "modal" }} />
      <Stack.Screen
        name="messages/recommend"
        options={{ title: t("Recommend Movie/Series"), presentation: "modal" }}
      />
      <Stack.Screen name="messages/[conversationId]" options={{ title: "" }} />
      <Stack.Screen name="communities/[slug]" options={{ title: "" }} />
      <Stack.Screen name="content/[type]/[id]" options={{ title: "" }} />
    </Stack>
  );
}
