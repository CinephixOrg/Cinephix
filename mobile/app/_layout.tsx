import "react-native-gesture-handler";
import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import {
  useFonts,
  DMSans_400Regular,
  DMSans_400Regular_Italic,
  DMSans_500Medium,
  DMSans_700Bold,
  DMSans_700Bold_Italic,
  DMSans_800ExtraBold,
} from "@expo-google-fonts/dm-sans";
import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { NotificationProvider } from "../src/context/NotificationContext";
import { ChatProvider } from "../src/context/ChatContext";
import { FollowGraphProvider } from "../src/context/FollowGraphContext";
import { WatchlistGraphProvider } from "../src/context/WatchlistGraphContext";
import { ProfileProvider } from "../src/context/ProfileContext";
import { NetworkProvider } from "../src/context/NetworkContext";
import { ToastProvider } from "../src/context/ToastContext";
import { ThemeProvider, useTheme, resolveInitialTheme } from "../src/context/ThemeContext";
import type { ThemeName } from "../src/theme/palettes";
import { PALETTES, DEFAULT_THEME } from "../src/theme/palettes";
import { initI18n } from "../src/i18n";
import { fonts } from "../src/theme/typography";
import OfflineBanner from "../src/components/OfflineBanner";
import Toast from "../src/components/Toast";

// Nothing is switchable yet at this point (fonts/i18n/theme aren't resolved),
// so the pre-boot loading screen always renders in the default palette —
// same reasoning as why it was never translated either.
const bootColors = PALETTES[DEFAULT_THEME];
const bootLoadingStyle = {
  flex: 1,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  backgroundColor: bootColors.base100,
};

function RootNavigator() {
  const { t } = useTranslation();
  const { loading } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.base100,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <OfflineBanner />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.base100 },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="setup-profile" options={{ headerShown: false }} />
        <Stack.Screen
          name="notifications"
          options={{
            presentation: "modal",
            headerShown: true,
            title: t("Notifications"),
            headerStyle: { backgroundColor: colors.base200 },
            headerTitleStyle: { fontFamily: fonts.bold, color: colors.baseContent },
            headerTintColor: colors.baseContent,
          }}
        />
        <Stack.Screen name="user/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="network"
          options={{
            headerShown: true,
            title: t("Followers"),
            headerStyle: { backgroundColor: colors.base200 },
            headerTitleStyle: { fontFamily: fonts.bold, color: colors.baseContent },
            headerTintColor: colors.baseContent,
          }}
        />
      </Stack>
      <Toast />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_400Regular_Italic,
    DMSans_500Medium,
    DMSans_700Bold,
    DMSans_700Bold_Italic,
    DMSans_800ExtraBold,
  });
  const [i18nReady, setI18nReady] = useState(false);
  const [initialTheme, setInitialTheme] = useState<ThemeName | null>(null);

  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  useEffect(() => {
    resolveInitialTheme().then(setInitialTheme);
  }, []);

  if (!fontsLoaded || !i18nReady || !initialTheme) {
    return (
      <View style={bootLoadingStyle}>
        <ActivityIndicator size="large" color={bootColors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider initialTheme={initialTheme}>
          <ToastProvider>
            <NetworkProvider>
              <AuthProvider>
                <FollowGraphProvider>
                  <WatchlistGraphProvider>
                    <ProfileProvider>
                      <NotificationProvider>
                        <ChatProvider>
                          <RootNavigator />
                        </ChatProvider>
                      </NotificationProvider>
                    </ProfileProvider>
                  </WatchlistGraphProvider>
                </FollowGraphProvider>
              </AuthProvider>
            </NetworkProvider>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
