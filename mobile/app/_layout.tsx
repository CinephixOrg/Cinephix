import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { View, ActivityIndicator, Text, TextInput } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { NotificationProvider } from "../src/context/NotificationContext";
import { ChatProvider } from "../src/context/ChatContext";
import { initI18n } from "../src/i18n";
import { colors } from "../src/theme/colors";
import { fonts } from "../src/theme/typography";

// Match the web app's DM Sans body font everywhere by default, so
// individual screens don't need to set fontFamily themselves.
const defaultTextProps = (Text as any).defaultProps || {};
(Text as any).defaultProps = {
  ...defaultTextProps,
  style: [{ fontFamily: fonts.regular, color: colors.baseContent }, defaultTextProps.style],
};
const defaultInputProps = (TextInput as any).defaultProps || {};
(TextInput as any).defaultProps = {
  ...defaultInputProps,
  style: [{ fontFamily: fonts.regular }, defaultInputProps.style],
  placeholderTextColor: colors.placeholder,
};

function RootNavigator() {
  const { t } = useTranslation();
  const { loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.base100 },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
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
      </Stack>
    </>
  );
}

const styles = {
  loadingContainer: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: colors.base100,
  },
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  if (!fontsLoaded || !i18nReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <AuthProvider>
      <NotificationProvider>
        <ChatProvider>
          <RootNavigator />
        </ChatProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
