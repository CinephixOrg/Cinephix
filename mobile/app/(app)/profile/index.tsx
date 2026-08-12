import { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../src/context/AuthContext";
import { getCineGraph, getProfileAnalysis, getUserProfile } from "../../../src/api/userService";
import { getFavorites } from "../../../src/api/favoriteService";
import CineGraphDonut from "../../../src/components/CineGraphDonut";
import ContentRail from "../../../src/components/ContentRail";
import ContentCard from "../../../src/components/ContentCard";
import ProfileAnalysisModal from "../../../src/components/ProfileAnalysisModal";
import { SkeletonProfileHeader } from "../../../src/components/Skeleton";
import { useToast } from "../../../src/context/ToastContext";
import type { CineGraphData, Favorites, ProfileAnalysis, UserProfile } from "../../../src/types";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

export default function ProfileScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
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
  buttonRow: { flexDirection: "row", gap: 12, marginTop: 20, alignSelf: "stretch" },
  button: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: { fontFamily: fonts.bold, color: colors.primaryContent },
  buttonSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonSecondaryText: { fontFamily: fonts.medium, color: colors.baseContent },
  analyzeButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    alignSelf: "stretch",
    marginTop: 12,
  },
  analyzeButtonText: { fontFamily: fonts.medium, color: colors.baseContent },
  error: { color: colors.error, fontSize: 16 },
}), [colors]);
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [cineGraph, setCineGraph] = useState<CineGraphData | null>(null);
  const [favorites, setFavorites] = useState<Favorites | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
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

  const handleAnalyzeProfile = async () => {
    setAnalyzing(true);
    try {
      const data = await getProfileAnalysis();
      setAnalysisData(data);
      setAnalysisModalVisible(true);
    } catch (e: any) {
      showToast(e?.response?.data?.message || t("Something went wrong. Please try again."));
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
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

  return (
    <>
    <ScrollView contentContainerStyle={styles.container}>
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

      <View style={styles.buttonRow}>
        <Pressable style={styles.button} onPress={() => router.push("/profile/edit")}>
          <Text style={styles.buttonText}>{t("Edit Profile")}</Text>
        </Pressable>
        <Pressable style={styles.buttonSecondary} onPress={() => router.push("/profile/settings")}>
          <Text style={styles.buttonSecondaryText}>{t("Settings")}</Text>
        </Pressable>
      </View>

      <Pressable style={styles.analyzeButton} onPress={handleAnalyzeProfile} disabled={analyzing}>
        {analyzing ? (
          <ActivityIndicator color={colors.baseContent} />
        ) : (
          <Text style={styles.analyzeButtonText}>{t("Analyze Profile")}</Text>
        )}
      </Pressable>

      {cineGraph && (
        <>
          <CineGraphDonut title={t("Watched Movie Genres")} stats={cineGraph.movieStats} />
          <CineGraphDonut title={t("Watched Series Genres")} stats={cineGraph.seriesStats} />
        </>
      )}

      {favorites && (
        <>
          <ContentRail
            title={t("Favorite Movies")}
            data={favorites.movies}
            keyExtractor={(m) => m._id}
            emptyText={t("No favorite movies yet.")}
            renderItem={(m) => (
              <ContentCard id={m._id} type="movie" title={m.title} posterPath={m.poster_path} basePath="/profile" />
            )}
          />
          <ContentRail
            title={t("Favorite Series")}
            data={favorites.series}
            keyExtractor={(s) => s._id}
            emptyText={t("No favorite series yet.")}
            renderItem={(s) => (
              <ContentCard id={s._id} type="series" title={s.name} posterPath={s.poster_path} basePath="/profile" />
            )}
          />
        </>
      )}
    </ScrollView>

    <ProfileAnalysisModal
      visible={analysisModalVisible}
      onClose={() => setAnalysisModalVisible(false)}
      data={analysisData}
      shareable
    />
    </>
  );
}

