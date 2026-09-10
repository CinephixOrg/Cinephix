import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
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
      {/* headerShown:false removes this screen's own top header, including
          the NotificationBell that used to live in its headerRight — that
          bell has no other access point on this screen now. */}
      <Stack.Screen name="index" options={{ title: t("Sync"), headerShown: false }} />
      <Stack.Screen name="subscription" options={{ title: t("Subscription Plans") }} />
    </Stack>
  );
}
