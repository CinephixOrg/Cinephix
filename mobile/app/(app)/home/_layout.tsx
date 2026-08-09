import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import NotificationBell from "../../../src/components/NotificationBell";
import { colors } from "../../../src/theme/colors";
import { fonts } from "../../../src/theme/typography";

export default function HomeStackLayout() {
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
        options={{ title: t("Home"), headerRight: () => <NotificationBell /> }}
      />
      <Stack.Screen name="content/[type]/[id]" options={{ title: "" }} />
      <Stack.Screen name="lists/[id]" options={{ title: t("List") }} />
    </Stack>
  );
}
