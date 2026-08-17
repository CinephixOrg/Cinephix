import { useCallback, useState, useMemo } from "react";
import { View, Text, Image, ScrollView, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Redirect, useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../src/context/AuthContext";
import { getCineGraph, getUserProfile } from "../../../src/api/userService";
import { getFavorites } from "../../../src/api/favoriteService";
import { getMatchWithUser, analyzeMatchWithUser, type MatchFilters } from "../../../src/api/matchService";
import FollowButton from "../../../src/components/FollowButton";
import MatchPercentageRing from "../../../src/components/MatchPercentageRing";
import AnalyzeModal from "../../../src/components/AnalyzeModal";
import MatchFiltersModal from "../../../src/components/match/MatchFiltersModal";
import PublicProfileOverviewTab from "../../../src/components/profile/PublicProfileOverviewTab";
import ProfileCinegraphsTab from "../../../src/components/profile/ProfileCinegraphsTab";
import { SkeletonProfileHeader } from "../../../src/components/Skeleton";
import type {
  CineGraphData,
  Favorites,
  FollowStatus,
  MatchAnalysis,
  MatchWithUserResult,
  PublicProfile,
} from "../../../src/types";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

type PublicProfileTab = "profile" | "cinegraphs";

const TABS: { key: PublicProfileTab; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "cinegraphs", label: "Cinegraphs" },
];

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
  profileArea: { padding: 20, paddingBottom: 20, alignItems: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.base100 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.base200 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { fontFamily: fonts.bold, fontSize: 28, color: colors.primary },
  username: { fontFamily: fonts.bold, fontSize: 22, color: colors.baseContent, marginTop: 12 },
  joined: { color: colors.placeholder, fontSize: 13, marginTop: 2 },
  lockRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  lockText: { color: colors.placeholder, fontSize: 14, textAlign: "center" },
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
  followButton: { marginTop: 20, alignSelf: "stretch" },
  error: { color: colors.error, fontSize: 16 },
  // Letterboxd-style flat tabs — matches (app)/profile/index.tsx exactly, so
  // your own profile and anyone else's feel like the same component family.
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
  // The Filters button used to sit beside Cinematch as an equal-weight
  // button (plus a whole expandable inline panel below) — now it's a small
  // icon attached to the Cinematch action instead of competing with it, and
  // opens the same bottom-sheet MatchFiltersModal the swipe screen uses.
  matchButtonRow: { flexDirection: "row", gap: 8, marginTop: 16, alignSelf: "stretch" },
  matchCinematchButton: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  matchCinematchButtonText: { fontFamily: fonts.bold, color: colors.primaryContent, fontSize: 14 },
  matchFilterIconButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  matchResultCard: {
    backgroundColor: colors.base200,
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    alignSelf: "stretch",
    alignItems: "center",
  },
  matchResultScore: { fontFamily: fonts.bold, fontSize: 17, color: colors.baseContent, marginTop: 12 },
  matchResultSubtext: { fontSize: 12, color: colors.placeholder, marginTop: 2, textAlign: "center" },
  matchAnalyzeButton: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 16,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
  matchAnalyzeButtonText: { fontFamily: fonts.bold, color: colors.primaryContent, fontSize: 14 },
}), [colors]);
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [cineGraph, setCineGraph] = useState<CineGraphData | null>(null);
  const [favorites, setFavorites] = useState<Favorites | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PublicProfileTab>("profile");

  const [filters, setFilters] = useState<MatchFilters>({
    type: "movie",
    genres: [],
    useCount: true,
    useAvgRating: true,
  });
  const [filtersModalVisible, setFiltersModalVisible] = useState(false);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchWithUserResult | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeData, setAnalyzeData] = useState<MatchAnalysis | null>(null);
  const [analyzeModalVisible, setAnalyzeModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id || id === user?._id) return;
      let cancelled = false;
      (async () => {
        setLoading(true);
        setError(null);
        try {
          const [profileData, cineGraphData, favoritesData] = await Promise.all([
            getUserProfile(id),
            getCineGraph(id),
            getFavorites(id),
          ]);
          if (!cancelled) {
            setProfile(profileData);
            setCineGraph(cineGraphData);
            setFavorites(favoritesData);
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

  const handleCinematch = async () => {
    setMatchLoading(true);
    setMatchError(null);
    try {
      const result = await getMatchWithUser(id, filters);
      setMatchResult(result);
    } catch (e: any) {
      setMatchError(e?.response?.data?.message || t("Failed to calculate match."));
    } finally {
      setMatchLoading(false);
    }
  };

  // Same filters as the Cinematch call above — the backend returns the same
  // matchPercentage for both when given the same inputs, which is the whole
  // point (previously Analyze silently used its own simplified formula and
  // showed a different score than the one already on screen).
  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const data = await analyzeMatchWithUser(id, filters);
      setAnalyzeData(data);
      setAnalyzeModalVisible(true);
    } catch (e: any) {
      setMatchError(e?.response?.data?.message || t("Failed to analyze match."));
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

  const initialStatus: FollowStatus = profile.isAuthorized
    ? profile.followers.includes(user?._id ?? "")
      ? "following"
      : profile.isRequested
        ? "requested"
        : "not-following"
    : profile.isRequested
      ? "requested"
      : "not-following";

  // A private account you don't follow has nothing to show in any tab — the
  // masked branch stays a single simple view, same as before tabs existed.
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

  // Name, network stats, bio, Follow button, and the CineMatch panel are
  // Profile-subtab-only, mirroring the exact same rule already applied to
  // your own profile (name/network/bio only on its Profile subtab).
  const profileArea = (
    <View style={styles.profileArea}>
      {profile.profile_pic_url ? (
        <Image source={{ uri: profile.profile_pic_url }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarFallbackText}>{profile.username.slice(0, 2).toUpperCase()}</Text>
        </View>
      )}

      <Text style={styles.username}>{profile.username}</Text>
      <Text style={styles.joined}>
        {t("Joined")}{" "}
        {new Date(profile.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long" })}
      </Text>

      <View style={styles.statsRow}>
        <Pressable
          style={styles.stat}
          onPress={() =>
            router.push({
              pathname: "/network",
              params: { userId: id, username: profile.username, tab: "followers" },
            })
          }
        >
          <Text style={styles.statValue}>{profile.followers.length}</Text>
          <Text style={styles.statLabel}>{t("Followers")}</Text>
        </Pressable>
        <Pressable
          style={styles.stat}
          onPress={() =>
            router.push({
              pathname: "/network",
              params: { userId: id, username: profile.username, tab: "following" },
            })
          }
        >
          <Text style={styles.statValue}>{profile.following.length}</Text>
          <Text style={styles.statLabel}>{t("Following")}</Text>
        </Pressable>
      </View>

      {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

      <FollowButton targetUserId={id} initialStatus={initialStatus} style={styles.followButton} />

      <View style={styles.matchButtonRow}>
        <Pressable style={styles.matchCinematchButton} onPress={handleCinematch} disabled={matchLoading}>
          {matchLoading ? (
            <ActivityIndicator color={colors.primaryContent} size="small" />
          ) : (
            <Text style={styles.matchCinematchButtonText}>{t("🎬 Cinematch")}</Text>
          )}
        </Pressable>
        <Pressable
          style={styles.matchFilterIconButton}
          onPress={() => setFiltersModalVisible(true)}
          accessibilityLabel={t("Filters")}
        >
          <Ionicons name="options-outline" size={19} color={colors.baseContent} />
        </Pressable>
      </View>

      {matchResult && (
        <View style={styles.matchResultCard}>
          <MatchPercentageRing percentage={matchResult.matchPercentage} size={84} strokeWidth={8} />
          <Text style={styles.matchResultScore}>
            {t("{{percent}}% Match", { percent: matchResult.matchPercentage })}
          </Text>
          <Text style={styles.matchResultSubtext}>{t("Based on your CineGraphs and taste overlap")}</Text>
          <Pressable style={styles.matchAnalyzeButton} onPress={handleAnalyze} disabled={analyzing}>
            {analyzing ? (
              <ActivityIndicator color={colors.primaryContent} size="small" />
            ) : (
              <>
                <Ionicons name="sparkles" size={16} color={colors.primaryContent} />
                <Text style={styles.matchAnalyzeButtonText}>{t("Analyze Compatibility")}</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      {matchError && <Text style={styles.error}>{matchError}</Text>}

      <MatchFiltersModal
        visible={filtersModalVisible}
        onClose={() => setFiltersModalVisible(false)}
        filters={filters}
        onApply={setFilters}
      />
    </View>
  );

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
        {tabRow}
        {activeTab === "profile" && profileArea}
        <View style={styles.tabContent}>
          {activeTab === "profile" && <PublicProfileOverviewTab favorites={favorites} userId={id} />}
          {activeTab === "cinegraphs" && <ProfileCinegraphsTab cineGraph={cineGraph} />}
        </View>
      </ScrollView>

      <AnalyzeModal
        visible={analyzeModalVisible}
        onClose={() => setAnalyzeModalVisible(false)}
        data={analyzeData}
        shareTargetUserId={id}
      />
    </>
  );
}
