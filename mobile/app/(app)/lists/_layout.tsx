import { Stack } from "expo-router";
import { colors } from "../../../src/theme/colors";
import { fonts } from "../../../src/theme/typography";

export default function ListsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.base200 },
        headerTitleStyle: { fontFamily: fonts.bold, color: colors.baseContent },
        headerTintColor: colors.baseContent,
      }}
    >
      <Stack.Screen name="index" options={{ title: "My Lists" }} />
      <Stack.Screen name="[id]" options={{ title: "List" }} />
      <Stack.Screen name="content/[type]/[id]" options={{ title: "" }} />
    </Stack>
  );
}
