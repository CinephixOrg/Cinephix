import "react-native-gesture-handler";
import { useEffect, useMemo, useState } from "react";
import { DarkTheme, Stack, ThemeProvider as NavigationThemeProvider } from "expo-router";
import { View, ActivityIndicator, LogBox } from "react-native";
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
import { RecentSharesProvider } from "../src/context/RecentSharesContext";
import { ComposeTutorialProvider } from "../src/context/ComposeTutorialContext";
import { ProfileProvider } from "../src/context/ProfileContext";
import { NetworkProvider } from "../src/context/NetworkContext";
import { ToastProvider } from "../src/context/ToastContext";
import { BadgeEarnedProvider } from "../src/context/BadgeEarnedContext";
import { ThemeProvider, useTheme, resolveInitialTheme } from "../src/context/ThemeContext";
import type { ThemeName } from "../src/theme/palettes";
import { PALETTES, DEFAULT_THEME } from "../src/theme/palettes";
import { initI18n } from "../src/i18n";
import { AdsConsentProvider } from "../src/context/AdsConsentContext";
import { fonts } from "../src/theme/typography";
import OfflineBanner from "../src/components/OfflineBanner";
import Toast from "../src/components/Toast";
import { PushNotificationsBridge } from "../src/hooks/usePushNotifications";
import { SafetyProvider } from "../src/context/SafetyContext";
import AppErrorBoundary from "../src/components/common/AppErrorBoundary";
import { initCrashReporting, reportRenderError } from "../src/monitoring/crashReporting";

// react-native-draggable-flatlist@4.0.3 (Favorites' own drag-to-reorder,
// ProfileCategoryTabs.tsx) calls RN's own InteractionManager internally —
// already the latest published version, so this isn't something upgrading
// the library fixes; it's an upstream deprecation warning with no app-code
// path to it. Purely cosmetic (InteractionManager itself still works, RN
// just wants it eventually replaced) — silenced here rather than left
// firing on every drag.
LogBox.ignoreLogs(["InteractionManager has been deprecated"]);

// As early as possible, so errors during boot are reported too. Does nothing
// without EXPO_PUBLIC_SENTRY_DSN.
initCrashReporting();

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

  // React Navigation paints every screen and stack container with its own
  // theme's background — and with no theme provided it falls back to the
  // light default, rgb(242, 242, 242). contentStyle only covered this root
  // stack, so every nested tab stack (Profile, Home, Search...) showed that
  // light grey for the length of each back transition: the "white flash"
  // when leaving Settings. Feeding the palette in here fixes every
  // navigator at once and follows theme changes.
  const navigationTheme = useMemo(
    () => ({
      ...DarkTheme,
      colors: {
        ...DarkTheme.colors,
        primary: colors.primary,
        background: colors.base100,
        card: colors.base200,
        text: colors.baseContent,
        border: colors.border,
        notification: colors.error,
      },
    }),
    [colors]
  );

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
    <NavigationThemeProvider value={navigationTheme}>
    <View style={{ flex: 1, backgroundColor: colors.base100 }}>
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
          name="list-editor"
          options={{
            headerShown: true,
            title: "",
            headerStyle: { backgroundColor: colors.base100 },
            headerShadowVisible: false,
            headerTitleStyle: { fontFamily: fonts.bold, color: colors.baseContent },
            headerTintColor: colors.baseContent,
          }}
        />
        {/* These four admin-creation screens had no entry here at all, so
            they rendered with no header, no back button, and no
            safe-area-aware top inset — only ever closable via their own
            save-success flow's router.back(). Same title-less header as
            list-editor's own, which gives both a native back arrow and a
            top inset for free. */}
        <Stack.Screen
          name="create-poll"
          options={{
            headerShown: true,
            title: "",
            headerStyle: { backgroundColor: colors.base100 },
            headerShadowVisible: false,
            headerTitleStyle: { fontFamily: fonts.bold, color: colors.baseContent },
            headerTintColor: colors.baseContent,
          }}
        />
        <Stack.Screen
          name="group-content-picker"
          options={{
            headerShown: true,
            title: "",
            headerStyle: { backgroundColor: colors.base100 },
            headerShadowVisible: false,
            headerTitleStyle: { fontFamily: fonts.bold, color: colors.baseContent },
            headerTintColor: colors.baseContent,
          }}
        />
        <Stack.Screen
          name="schedule-watch-party"
          options={{
            headerShown: true,
            title: "",
            headerStyle: { backgroundColor: colors.base100 },
            headerShadowVisible: false,
            headerTitleStyle: { fontFamily: fonts.bold, color: colors.baseContent },
            headerTintColor: colors.baseContent,
          }}
        />
        <Stack.Screen
          name="group-list-editor"
          options={{
            headerShown: true,
            title: "",
            headerStyle: { backgroundColor: colors.base100 },
            headerShadowVisible: false,
            headerTitleStyle: { fontFamily: fonts.bold, color: colors.baseContent },
            headerTintColor: colors.baseContent,
          }}
        />
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
      {/* Push registration, and routing a tapped push to its screen. */}
      <PushNotificationsBridge />
    </View>
    </NavigationThemeProvider>
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
        {/* Catches any render error below, providers included, instead of
            letting it close the app. */}
        <AppErrorBoundary onError={reportRenderError}>
        {/* Outermost and independent of auth/theme — consent needs to start
            resolving as early in boot as possible, not gated behind a
            signed-in user, since the Mobile Ads SDK itself must not
            initialize before it does (see AdsConsentContext's own
            comment). */}
        <AdsConsentProvider>
        <ThemeProvider initialTheme={initialTheme}>
          <ToastProvider>
            <BadgeEarnedProvider>
              <NetworkProvider>
                <AuthProvider>
                  <FollowGraphProvider>
                    <WatchlistGraphProvider>
                      <RecentSharesProvider>
                        <ComposeTutorialProvider>
                          <ProfileProvider>
                            <NotificationProvider>
                              <ChatProvider>
                                <SafetyProvider>
                                  <RootNavigator />
                                </SafetyProvider>
                              </ChatProvider>
                            </NotificationProvider>
                          </ProfileProvider>
                        </ComposeTutorialProvider>
                      </RecentSharesProvider>
                    </WatchlistGraphProvider>
                  </FollowGraphProvider>
                </AuthProvider>
              </NetworkProvider>
            </BadgeEarnedProvider>
          </ToastProvider>
        </ThemeProvider>
        </AdsConsentProvider>
        </AppErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
