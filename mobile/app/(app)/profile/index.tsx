import { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../src/context/AuthContext";
import { getCineGraph, getUserProfile } from "../../../src/api/userService";
import { getFavorites } from "../../../src/api/favoriteService";
import MyListsView from "../../../src/components/MyListsView";
import ProfileOverviewTab from "../../../src/components/profile/ProfileOverviewTab";
import ProfileCinegraphsTab from "../../../src/components/profile/ProfileCinegraphsTab";
import ProfileAnalysesTab from "../../../src/components/profile/ProfileAnalysesTab";
import ProfileAnalysisModal from "../../../src/components/ProfileAnalysisModal";
import { SkeletonProfileHeader } from "../../../src/components/Skeleton";
import type { CineGraphData, Favorites, ProfileAnalysis, UserProfile } from "../../../src/types";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

type ProfileTab = "profile" | "cinegraphs" | "lists" | "analyses";

const TABS: { key: ProfileTab; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "cinegraphs", label: "Cinegraphs" },
  { key: "lists", label: "Lists" },
  { key: "analyses", label: "Analyses" },
];

export default function ProfileScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.base100 },
  scrollContent: { flexGrow: 1 },
  profileArea: { padding: 20, paddingBottom: 20, alignItems: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.base100 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.base200 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { fontFamily: fonts.bold, fontSize: 28, color: colors.primary },
  username: { fontFamily: fonts.bold, fontSize: 22, color: colors.baseContent, marginTop: 12 },
  joined: { color: colors.placeholder, fontSize: 13, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 32, marginTop: 16 },
  stat: { alignItems: "center" },
  statValue: { fontFamily: fonts.bold, fontSize: 18, color: colors.baseContent },
  statLabel: { color: colors.placeholder, fontSize: 12 },
  bio: {
    color: colors.baseContent,
    fontSize: 14,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 20,
  },
  tierBadge: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  tierBadgeText: { fontFamily: fonts.medium, fontSize: 11, color: colors.primary },
  // Letterboxd-style flat tabs — full width, no pill/button chrome, just an
  // underline on the active tab sitting on top of the row's shared baseline.
  tabRow: {
    flexDirection: "row",
    alignSelf: "stretch",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    marginBottom: -StyleSheet.hairlineWidth,
  },
  tabButtonActive: { borderBottomColor: colors.primary },
  tabButtonText: { fontFamily: fonts.medium, fontSize: 13, color: colors.placeholder },
  tabButtonTextActive: { color: colors.baseContent, fontFamily: fonts.bold },
  tabContent: { paddingTop: 20 },
  error: { color: colors.error, fontSize: 16 },
}), [colors]);
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [cineGraph, setCineGraph] = useState<CineGraphData | null>(null);
  const [favorites, setFavorites] = useState<Favorites | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");
  const [analysisData, setAnalysisData] = useState<ProfileAnalysis | null>(null);
  const [analysisModalVisible, setAnalysisModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let cancelled = false;
      (async () => {
        setLoading(true);
        setError(null);
        try {
          const [profileData, cineGraphData, favoritesData] = await Promise.all([
            getUserProfile(user._id),
            getCineGraph(user._id),
            getFavorites(user._id),
          ]);
          if (!cancelled) {
            // isAuthorizedToView always passes for viewerId === targetUser._id,
            // so these should never actually be the masked branch — defensive only.
            if (!profileData.isAuthorized) throw new Error("Own profile unexpectedly masked");
            if (!favoritesData.isAuthorized) throw new Error("Own favorites unexpectedly masked");
            setProfile(profileData);
            setCineGraph(cineGraphData);
            setFavorites(favoritesData);
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

  const joinedDate = new Date(profile.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  });

  const tabRow = (
    <View style={styles.tabRow}>
      {TABS.map((tabDef) => {
        const isActive = activeTab === tabDef.key;
        return (
          <Pressable
            key={tabDef.key}
            style={[styles.tabButton, isActive && styles.tabButtonActive]}
            onPress={() => setActiveTab(tabDef.key)}
          >
            <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
              {t(tabDef.label)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  // Name, network stats, and bio are Profile-subtab-only — Cinegraphs, Lists,
  // and Analyses show just the tab row plus their own content.
  const profileArea = (
    <View style={styles.profileArea}>
      {profile.profile_pic_url ? (
        <Image source={{ uri: profile.profile_pic_url }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarFallbackText}>
            {profile.username.slice(0, 2).toUpperCase()}
          </Text>
        </View>
      )}

      <Text style={styles.username}>{profile.username}</Text>
      {profile.accountTier && profile.accountTier !== "free" && (
        <View style={styles.tierBadge}>
          <Text style={styles.tierBadgeText}>{profile.accountTier.toUpperCase()}</Text>
        </View>
      )}
      <Text style={styles.joined}>{t("Joined")} {joinedDate}</Text>

      <View style={styles.statsRow}>
        <Pressable
          style={styles.stat}
          onPress={() => router.push("/network?tab=followers")}
        >
          <Text style={styles.statValue}>{profile.followers?.length ?? 0}</Text>
          <Text style={styles.statLabel}>{t("Followers")}</Text>
        </Pressable>
        <Pressable
          style={styles.stat}
          onPress={() => router.push("/network?tab=following")}
        >
          <Text style={styles.statValue}>{profile.following?.length ?? 0}</Text>
          <Text style={styles.statLabel}>{t("Following")}</Text>
        </Pressable>
      </View>

      <Text style={styles.bio}>{profile.bio || t("No bio yet.")}</Text>
    </View>
  );

  return (
    <>
      {activeTab === "lists" ? (
        <MyListsView ListHeaderComponent={tabRow} />
      ) : (
        <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
          {tabRow}
          {activeTab === "profile" && profileArea}
          <View style={styles.tabContent}>
            {activeTab === "profile" && <ProfileOverviewTab favorites={favorites} />}
            {activeTab === "cinegraphs" && <ProfileCinegraphsTab cineGraph={cineGraph} />}
            {activeTab === "analyses" && (
              <ProfileAnalysesTab
                onViewAnalysis={(data) => {
                  setAnalysisData(data);
                  setAnalysisModalVisible(true);
                }}
              />
            )}
          </View>
        </ScrollView>
      )}

      <ProfileAnalysisModal
        visible={analysisModalVisible}
        onClose={() => setAnalysisModalVisible(false)}
        data={analysisData}
        shareable
      />
    </>
  );
}
