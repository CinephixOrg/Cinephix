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
        headerTitleAlign: "center",
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          // headerTitle is overridden dynamically by index.tsx itself (the
          // Messages/Community switcher, which needs the screen's own
          // mainTab state) via navigation.setOptions() — same pattern
          // Home's Paylaşımlar/Keşfet switcher uses. No static title here.
          headerRight: () => <NotificationBell />,
        }}
      />
      <Stack.Screen name="messages/new" options={{ title: t("New Message"), presentation: "modal" }} />
      <Stack.Screen
        name="messages/recommend"
        options={{ title: t("Recommend Movie/Series"), presentation: "modal" }}
      />
      <Stack.Screen name="messages/[conversationId]" options={{ title: "" }} />
      <Stack.Screen name="communities/[slug]" options={{ title: "" }} />
      <Stack.Screen name="content/[type]/[id]" options={{ title: "" }} />
      <Stack.Screen name="content/[type]/[id]/reviews" options={{ title: t("Reviews") }} />
      <Stack.Screen name="content/[type]/[id]/lists" options={{ title: t("Lists") }} />
      <Stack.Screen name="content/[type]/[id]/watched" options={{ title: t("Watched") }} />
      <Stack.Screen name="content/[type]/[id]/favorited" options={{ title: t("Favorites") }} />
      <Stack.Screen name="content/[type]/[id]/write-review" options={{ title: "" }} />
      <Stack.Screen name="content/[type]/[id]/similar" options={{ title: t("Similar") }} />
    </Stack>
  );
}
