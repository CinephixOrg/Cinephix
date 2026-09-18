import { Redirect, Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../src/context/AuthContext";
import { useChat } from "../../src/context/ChatContext";
import { useTheme } from "../../src/context/ThemeContext";
import { fonts } from "../../src/theme/typography";
import PodiumNewsModal from "../../src/components/PodiumNewsModal";
import BadgeEarnedModal from "../../src/components/BadgeEarnedModal";

type IconName = keyof typeof Ionicons.glyphMap;

function TabIcon(focusedName: IconName, unfocusedName: IconName) {
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? focusedName : unfocusedName} size={22} color={color as string} />
  );
}

export default function AppLayout() {
  const { user } = useAuth();
  const { totalUnread } = useChat();
  const { t } = useTranslation();
  const { colors } = useTheme();

  if (!user) {
    return <Redirect href="/login" />;
  }

  // Every tab is its own nested Stack (search/_layout.tsx,
  // watchlist/_layout.tsx, lists/_layout.tsx, profile/_layout.tsx), each
  // containing its own copy of the content-detail route. This is what makes
  // back navigation (hardware, gesture, and each Stack's own header arrow)
  // correctly return to wherever a screen was opened from — bottom-tabs
  // navigators don't track cross-screen history themselves, so a flat,
  // tab-level-only screen's "back" always falls through to "go to the first
  // tab" regardless of which tab you actually came from.
  return (
    <>
      {/* Checks the current user's own podium placements once — this
          component only ever mounts once per real login (AppLayout itself
          only renders once `user` exists, and unmounts on logout), so this
          naturally reads as "once per app session" without needing any
          separate persisted "already shown" flag. See its own doc comment
          for the full "why here" reasoning. */}
      <PodiumNewsModal />
      {/* Live off BadgeEarnedContext, not a mount-time check like
          PodiumNewsModal above — a badge popup has to fire the instant the
          rating that actually crosses a threshold lands (rateContent()'s
          own callers report it), not on the next app open. */}
      <BadgeEarnedModal />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: { backgroundColor: colors.base200, borderTopColor: colors.border },
          // Typing shouldn't push the tab bar up above the keyboard (it sat
          // between a chat's composer and the keyboard).
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.placeholder,
          tabBarLabelStyle: { fontFamily: fonts.medium },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{ title: t("Medya"), tabBarIcon: TabIcon("newspaper", "newspaper-outline") }}
        />
        <Tabs.Screen
          name="search"
          options={{ title: t("Search"), tabBarIcon: TabIcon("search", "search-outline") }}
        />
        <Tabs.Screen
          name="watchlist"
          options={{
            title: t("Watched List"),
            tabBarIcon: TabIcon("bookmark", "bookmark-outline"),
            href: null,
          }}
        />
        <Tabs.Screen
          name="to-watch"
          options={{
            title: t("Watchlist"),
            tabBarIcon: TabIcon("time", "time-outline"),
            href: null,
          }}
        />
        <Tabs.Screen
          name="lists"
          options={{
            title: t("Lists"),
            tabBarIcon: TabIcon("list", "list-outline"),
            href: null,
          }}
        />
        <Tabs.Screen
          name="match"
          options={{ title: t("Sync"), tabBarIcon: TabIcon("sparkles", "sparkles-outline") }}
        />
        <Tabs.Screen
          name="socials"
          options={{
            title: t("Socials"),
            tabBarIcon: TabIcon("people", "people-outline"),
            tabBarBadge: totalUnread > 0 ? totalUnread : undefined,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: t("Profile"), tabBarIcon: TabIcon("person-circle", "person-circle-outline") }}
        />
      </Tabs>
    </>
  );
}
