import { useCallback, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../../src/context/AuthContext";
import { getCineGraph, getMyProfile } from "../../../src/api/userService";
import CineGraphDonut from "../../../src/components/CineGraphDonut";
import type { CineGraphData, UserProfile } from "../../../src/types";
import { colors } from "../../../src/theme/colors";
import { fonts } from "../../../src/theme/typography";

export default function ProfileScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [cineGraph, setCineGraph] = useState<CineGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let cancelled = false;
      (async () => {
        setLoading(true);
        setError(null);
        try {
          const [profileData, cineGraphData] = await Promise.all([
            getMyProfile(user._id),
            getCineGraph(user._id),
          ]);
          if (!cancelled) {
            setProfile(profileData);
            setCineGraph(cineGraphData);
          }
        } catch (e: any) {
          if (!cancelled) setError(e?.response?.data?.message || "Failed to load profile.");
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
    return <ActivityIndicator style={styles.center} size="large" color={colors.primary} />;
  }

  if (error || !profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || "Profile not found."}</Text>
      </View>
    );
  }

  const joinedDate = new Date(profile.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  });

  return (
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
      <Text style={styles.joined}>Joined {joinedDate}</Text>

      <View style={styles.statsRow}>
        <Pressable
          style={styles.stat}
          onPress={() => router.push("/profile/connections?tab=followers")}
        >
          <Text style={styles.statValue}>{profile.followers?.length ?? 0}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </Pressable>
        <Pressable
          style={styles.stat}
          onPress={() => router.push("/profile/connections?tab=following")}
        >
          <Text style={styles.statValue}>{profile.following?.length ?? 0}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </Pressable>
      </View>

      <Text style={styles.bio}>{profile.bio || "No bio yet."}</Text>

      <View style={styles.buttonRow}>
        <Pressable style={styles.button} onPress={() => router.push("/profile/edit")}>
          <Text style={styles.buttonText}>Edit Profile</Text>
        </Pressable>
        <Pressable style={styles.buttonSecondary} onPress={() => router.push("/profile/settings")}>
          <Text style={styles.buttonSecondaryText}>Settings</Text>
        </Pressable>
      </View>

      {cineGraph && (
        <>
          <CineGraphDonut title="Watchlist Movie Genres" stats={cineGraph.movieStats} />
          <CineGraphDonut title="Watchlist Series Genres" stats={cineGraph.seriesStats} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  error: { color: colors.error, fontSize: 16 },
});
