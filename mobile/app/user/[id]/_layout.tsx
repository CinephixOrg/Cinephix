import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

export default function UserProfileStackLayout() {
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
      <Stack.Screen name="index" options={{ title: "" }} />
      <Stack.Screen name="content/[type]/[id]" options={{ title: "" }} />
      <Stack.Screen name="content/[type]/[id]/reviews" options={{ title: t("Reviews") }} />
      <Stack.Screen name="content/[type]/[id]/lists" options={{ title: t("Lists") }} />
      <Stack.Screen name="content/[type]/[id]/watched" options={{ title: t("Watched") }} />
      <Stack.Screen name="content/[type]/[id]/favorited" options={{ title: t("Favorites") }} />
      <Stack.Screen name="content/[type]/[id]/write-review" options={{ title: "" }} />
      <Stack.Screen name="content/[type]/[id]/similar" options={{ title: t("Similar") }} />
      {/* Title is set at runtime by the screen itself (the other person's
          username), so nothing static to declare here. */}
      <Stack.Screen name="chat" />
      {/* Genre detail lives in THIS stack, not the profile tab's copy of it.
          Opened from a genre in someone else's CineGraph, it has to come
          back to their profile — and read their titles, not yours. Title is
          set at runtime to the genre name. */}
      <Stack.Screen name="genre/[type]/[genre]" />
      {/* A list from this person's Lists tab — title is the list's own name,
          set at runtime by the screen. */}
      <Stack.Screen name="lists/[listId]" options={{ title: "" }} />
    </Stack>
  );
}
