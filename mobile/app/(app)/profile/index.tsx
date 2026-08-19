import { useCallback, useEffect, useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useFocusEffect, useNavigation } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Drawer } from "react-native-drawer-layout";
import { useAuth } from "../../../src/context/AuthContext";
import { getCineGraph, getUserProfile } from "../../../src/api/userService";
import { getFavorites } from "../../../src/api/favoriteService";
import { getUserShares } from "../../../src/api/shareService";
import ProfileHeaderInstagram from "../../../src/components/profile/ProfileHeaderInstagram";
import ProfileCategoryTabs from "../../../src/components/profile/ProfileCategoryTabs";
import ProfileDrawerContent from "../../../src/components/profile/ProfileDrawerContent";
import { SkeletonProfileHeader } from "../../../src/components/Skeleton";
import type { CineGraphData, Favorites, UserProfile } from "../../../src/types";
import { useTheme } from "../../../src/context/ThemeContext";

// The outer Profile/WatchedList/Lists/Watchlist tab bar and the category
// row's old Activity icon are both gone — this is a single screen now.
// Everything they used to hold (Activity, Watched List, Lists, Watchlist,
// Notifications, Settings) moved into the new slide-out drawer instead,
// opened via the hamburger icon this screen now supplies as its own
// headerRight (profile/_layout.tsx no longer sets one statically).
export default function ProfileScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.base100 },
  scrollContent: { flexGrow: 1 },
  profileArea: { padding: 20, paddingBottom: 20, alignItems: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.base100 },
  tabContent: { paddingTop: 4 },
  error: { color: colors.error, fontSize: 16 },
}), [colors]);
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigation = useNavigation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [cineGraph, setCineGraph] = useState<CineGraphData | null>(null);
  const [favorites, setFavorites] = useState<Favorites | null>(null);
  const [shareCount, setShareCount] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => setDrawerOpen(true)} hitSlop={8} style={{ marginRight: 12, padding: 4 }}>
          <Ionicons name="menu" size={24} color={colors.baseContent} />
        </Pressable>
      ),
    });
  }, [navigation, colors]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let cancelled = false;
      (async () => {
        setLoading(true);
        setError(null);
        try {
          const [profileData, cineGraphData, favoritesData, sharesData] = await Promise.all([
            getUserProfile(user._id),
            getCineGraph(user._id),
            getFavorites(user._id),
            getUserShares("me", 1, 1),
          ]);
          if (!cancelled) {
            // isAuthorizedToView always passes for viewerId === targetUser._id,
            // so these should never actually be the masked branch — defensive only.
            if (!profileData.isAuthorized) throw new Error("Own profile unexpectedly masked");
            if (!favoritesData.isAuthorized) throw new Error("Own favorites unexpectedly masked");
            setProfile(profileData);
            setCineGraph(cineGraphData);
            setFavorites(favoritesData);
            setShareCount(sharesData.total);
          }
        } catch (e: any) {
          if (!cancelled) setError(e?.response?.data?.message || t("Failed to load profile."));
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [user?._id])
  );

  if (loading) {
    return (
      <ScrollView contentContainerStyle={styles.profileArea}>
        <SkeletonProfileHeader />
      </ScrollView>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || t("Profile not found.")}</Text>
      </View>
    );
  }

  return (
    <Drawer
      open={drawerOpen}
      onOpen={() => setDrawerOpen(true)}
      onClose={() => setDrawerOpen(false)}
      drawerPosition="right"
      renderDrawerContent={() => <ProfileDrawerContent onNavigate={() => setDrawerOpen(false)} />}
    >
      <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
        <ProfileHeaderInstagram profile={profile} shareCount={shareCount} />
        <View style={styles.tabContent}>
          <ProfileCategoryTabs favorites={favorites} cineGraph={cineGraph} />
        </View>
      </ScrollView>
    </Drawer>
  );
}
