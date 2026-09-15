import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import BackToProfileButton from "../../../src/components/BackToProfileButton";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

// My Lists is always the bottom of this stack. Without it, arriving straight
// at a list — the list editor sends a newly created list to /lists/[id] —
// built the stack with that list alone, so it had no Back button and no way
// out. With it, the list opens on top of My Lists and Back returns there.
export const unstable_settings = {
  initialRouteName: "index",
};

export default function ListsStackLayout() {
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
      {/* A sibling of the Watched List and Watchlist: reached from the
          Profile drawer, so the arrow returns there. */}
      <Stack.Screen
        name="index"
        options={{ title: t("Your Lists"), headerLeft: () => <BackToProfileButton /> }}
      />
      <Stack.Screen name="[id]" options={{ title: t("List") }} />
      <Stack.Screen name="content/[type]/[id]" options={{ title: "" }} />
      <Stack.Screen name="content/[type]/[id]/reviews" options={{ title: t("Reviews") }} />
      <Stack.Screen name="content/[type]/[id]/lists" options={{ title: t("Lists") }} />
      <Stack.Screen name="content/[type]/[id]/watched" options={{ title: t("Watched") }} />
      <Stack.Screen name="content/[type]/[id]/favorited" options={{ title: t("Favorites") }} />
      <Stack.Screen name="content/[type]/[id]/write-review" options={{ title: "" }} />
      <Stack.Screen name="content/[type]/[id]/similar" options={{ title: t("Similar") }} />
    </Stack>
  );
}
