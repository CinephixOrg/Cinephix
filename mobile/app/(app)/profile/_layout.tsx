import { Stack } from "expo-router";
import { colors } from "../../../src/theme/colors";
import { fonts } from "../../../src/theme/typography";

export default function ProfileStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.base200 },
        headerTitleStyle: { fontFamily: fonts.bold, color: colors.baseContent },
        headerTintColor: colors.baseContent,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Profile" }} />
      <Stack.Screen name="edit" options={{ title: "Edit Profile" }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
      <Stack.Screen name="connections" options={{ title: "Connections" }} />
    </Stack>
  );
}
