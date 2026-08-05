import { Redirect, Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/context/AuthContext";
import { colors } from "../../src/theme/colors";
import { fonts } from "../../src/theme/typography";

type IconName = keyof typeof Ionicons.glyphMap;

function TabIcon(focusedName: IconName, unfocusedName: IconName) {
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? focusedName : unfocusedName} size={22} color={color as string} />
  );
}

export default function AppLayout() {
  const { user } = useAuth();

  if (!user) {
    return <Redirect href="/login" />;
  }

  // Every tab is its own nested Stack (movies/_layout.tsx, series/_layout.tsx,
  // watchlist/_layout.tsx, lists/_layout.tsx, profile/_layout.tsx), each
  // containing its own copy of the content-detail route. This is what makes
  // back navigation (hardware, gesture, and each Stack's own header arrow)
  // correctly return to wherever a screen was opened from — bottom-tabs
  // navigators don't track cross-screen history themselves, so a flat,
  // tab-level-only screen's "back" always falls through to "go to the first
  // tab" regardless of which tab you actually came from.
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.base200, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.placeholder,
        tabBarLabelStyle: { fontFamily: fonts.medium },
      }}
    >
      <Tabs.Screen
        name="movies"
        options={{ title: "Movies", tabBarIcon: TabIcon("film", "film-outline") }}
      />
      <Tabs.Screen
        name="series"
        options={{ title: "Series", tabBarIcon: TabIcon("tv", "tv-outline") }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{ title: "Watchlist", tabBarIcon: TabIcon("bookmark", "bookmark-outline") }}
      />
      <Tabs.Screen
        name="lists"
        options={{ title: "Lists", tabBarIcon: TabIcon("list", "list-outline") }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: TabIcon("person-circle", "person-circle-outline") }}
      />
    </Tabs>
  );
}
