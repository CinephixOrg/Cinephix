import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import NotificationBell from "../../../src/components/NotificationBell";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

export default function MatchStackLayout() {
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
        options={{ title: t("Cinematch"), headerRight: () => <NotificationBell /> }}
      />
    </Stack>
  );
}
