import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";
import { useTheme } from "../../src/context/ThemeContext";

export default function AuthLayout() {
  const { user, needsProfileSetup } = useAuth();
  const { colors } = useTheme();

  if (user && needsProfileSetup) {
    return <Redirect href="/setup-profile" />;
  }
  if (user) {
    return <Redirect href="/movies" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.base100 },
      }}
    />
  );
}
