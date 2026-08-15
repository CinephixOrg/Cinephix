import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

export default function SocialStackLayout() {
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
      {/* headerRight here is a static fallback for the first paint — the
          screen itself overrides it via navigation.setOptions() once mounted,
          swapping in the message-composer icons only while the Messages
          sub-tab is active (see social/index.tsx). */}
      <Stack.Screen name="index" options={{ title: t("Social") }} />
      <Stack.Screen name="[slug]" options={{ title: "" }} />
      <Stack.Screen name="[conversationId]" options={{ title: "" }} />
      <Stack.Screen name="new" options={{ title: t("New Message"), presentation: "modal" }} />
      <Stack.Screen
        name="recommend"
        options={{ title: t("Recommend Movie/Series"), presentation: "modal" }}
      />
      <Stack.Screen name="content/[type]/[id]" options={{ title: "" }} />
    </Stack>
  );
}
