import { useCallback, useState, useMemo } from "react";
import { View, Text, Image, ScrollView, StyleSheet } from "react-native";
import { Redirect, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../src/context/AuthContext";
import { getCineGraph, getUserProfile } from "../../../src/api/userService";
import { getFavorites } from "../../../src/api/favoriteService";
import { getUserShares } from "../../../src/api/shareService";
import FollowButton from "../../../src/components/FollowButton";
import ProfileHeaderInstagram from "../../../src/components/profile/ProfileHeaderInstagram";
import PublicProfileCategoryTabs from "../../../src/components/profile/PublicProfileCategoryTabs";
import { SkeletonProfileHeader } from "../../../src/components/Skeleton";
import type { CineGraphData, Favorites, FollowStatus, PublicProfile } from "../../../src/types";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

export default function PublicProfileScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.base100 },
  scrollContent: { flexGrow: 1 },
  container: {
    padding: 20,
    alignItems: "center",
    backgroundColor: colors.base100,
    flexGrow: 1,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.base100 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.base200 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { fontFamily: fonts.bold, fontSize: 28, color: colors.primary },
  username: { fontFamily: fonts.bold, fontSize: 22, color: colors.baseContent, marginTop: 12 },
  lockRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  lockText: { color: colors.placeholder, fontSize: 14, textAlign: "center" },
  followButton: { marginTop: 20, alignSelf: "stretch" },
  error: { color: colors.error, fontSize: 16 },
}), [colors]);
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const navigation = useNavigation();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [cineGraph, setCineGraph] = useState<CineGraphData | null>(null);
  const [favorites, setFavorites] = useState<Favorites | null>(null);
  const [shareCount, setShareCount] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!id || id === user?._id) return;
      let cancelled = false;
      (async () => {
        setLoading(true);
        setError(null);
        try {
          const [profileData, cineGraphData, favoritesData, sharesData] = await Promise.all([
            getUserProfile(id),
            getCineGraph(id),
            getFavorites(id),
            getUserShares(id, 1, 1),
          ]);
          if (!cancelled) {
            setProfile(profileData);
            setCineGraph(cineGraphData);
            setFavorites(favoritesData);
            setShareCount(sharesData.total);
            navigation.setOptions({ title: profileData.username });
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
    }, [id, user?._id])
  );

  if (id && id === user?._id) {
    return <Redirect href="/profile" />;
  }

  if (loading) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
        <SkeletonProfileHeader statCount={3} tabCount={3} />
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

  const initialStatus: FollowStatus = profile.isAuthorized
    ? profile.followers.includes(user?._id ?? "")
      ? "following"
      : profile.isRequested
        ? "requested"
        : "not-following"
    : profile.isRequested
      ? "requested"
      : "not-following";

  // A private account you don't follow has nothing to show — this stays a
  // single simple centered view, distinct from the full Instagram-style
  // layout below (no bio/stats/categories to show either way).
  if (!profile.isAuthorized) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        {profile.profile_pic_url ? (
          <Image source={{ uri: profile.profile_pic_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarFallbackText}>{profile.username.slice(0, 2).toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.username}>{profile.username}</Text>
        <View style={styles.lockRow}>
          <Ionicons name="lock-closed" size={16} color={colors.placeholder} />
          <Text style={styles.lockText}>{t("This account is private.")}</Text>
        </View>
        <FollowButton targetUserId={id} initialStatus={initialStatus} style={styles.followButton} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
      <ProfileHeaderInstagram
        profile={profile}
        targetUserId={id}
        shareCount={shareCount}
        actionsSlot={<FollowButton targetUserId={id} initialStatus={initialStatus} style={styles.followButton} />}
      />

      <PublicProfileCategoryTabs favorites={favorites} cineGraph={cineGraph} userId={id} />
    </ScrollView>
  );
}
