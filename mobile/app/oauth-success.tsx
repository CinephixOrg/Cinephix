import { useEffect, useRef } from "react";
import { View, ActivityIndicator } from "react-native";
import { useLocalSearchParams, Redirect } from "expo-router";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/context/ThemeContext";
import type { User } from "../src/types";

// Fallback landing screen for the Google OAuth redirect. In Expo Go on
// Android, WebBrowser.openAuthSessionAsync doesn't reliably intercept the
// redirect before the OS hands it to Expo Router as a plain deep link — so
// this route (matching Linking.createURL("oauth-success") in googleAuth.ts)
// completes the login itself instead of hitting the 404 "Unmatched Route"
// screen.
export default function OAuthSuccessScreen() {
  const { data } = useLocalSearchParams<{ data?: string }>();
  const { user, completeOAuthLogin } = useAuth();
  const { colors } = useTheme();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current || !data || typeof data !== "string") return;
    handled.current = true;
    try {
      completeOAuthLogin(JSON.parse(data) as User);
    } catch {
      // Malformed payload — user stays null, index.tsx redirects to /login.
    }
  }, [data]);

  if (user) {
    return <Redirect href="/home" />;
  }

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
