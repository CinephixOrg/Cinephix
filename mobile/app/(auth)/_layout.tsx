import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";
import { colors } from "../../src/theme/colors";

export default function AuthLayout() {
  const { user } = useAuth();

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
