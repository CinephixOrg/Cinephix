import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import NotificationBell from "../../../src/components/NotificationBell";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

export default function WatchlistStackLayout() {
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
        options={{ title: t("Watched List"), headerRight: () => <NotificationBell /> }}
      />
      <Stack.Screen name="content/[type]/[id]" options={{ title: "" }} />
      <Stack.Screen name="content/[type]/[id]/reviews" options={{ title: t("Reviews") }} />
      <Stack.Screen name="content/[type]/[id]/lists" options={{ title: t("Lists") }} />
      <Stack.Screen name="content/[type]/[id]/watched" options={{ title: t("Watched") }} />
      <Stack.Screen name="content/[type]/[id]/favorited" options={{ title: t("Favorites") }} />
    </Stack>
  );
}
