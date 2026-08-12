import { useCallback, useState, useMemo } from "react";
import { View, Text, Image, ScrollView, Pressable, Switch, ActivityIndicator, StyleSheet } from "react-native";
import { Redirect, useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../src/context/AuthContext";
import { getCineGraph, getUserProfile } from "../../../src/api/userService";
import { getFavorites } from "../../../src/api/favoriteService";
import { getMatchWithUser, analyzeMatchWithUser } from "../../../src/api/matchService";
import { MOVIE_GENRES, SERIES_GENRES } from "../../../src/constants/genreConstants";
import CineGraphDonut from "../../../src/components/CineGraphDonut";
import ContentRail from "../../../src/components/ContentRail";
import ContentCard from "../../../src/components/ContentCard";
import FollowButton from "../../../src/components/FollowButton";
import MatchPercentageRing from "../../../src/components/MatchPercentageRing";
import AnalyzeModal from "../../../src/components/AnalyzeModal";
import { SkeletonProfileHeader } from "../../../src/components/Skeleton";
import type {
  CineGraphData,
  ContentType,
  Favorites,
  FollowStatus,
  MatchAnalysis,
  MatchWithUserResult,
  PublicProfile,
} from "../../../src/types";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

export default function PublicProfileScreen() {
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
  matchButtonRow: { flexDirection: "row", gap: 10, marginTop: 16, alignSelf: "stretch" },
  matchFilterButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  matchFilterButtonText: { fontFamily: fonts.medium, color: colors.baseContent, fontSize: 13 },
  matchCinematchButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  matchCinematchButtonText: { fontFamily: fonts.bold, color: colors.primaryContent, fontSize: 13 },
  matchPanel: {
    backgroundColor: colors.base200,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    alignSelf: "stretch",
  },
  segmentedRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  segment: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  segmentActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segmentText: { fontFamily: fonts.medium, color: colors.baseContent },
  segmentTextActive: { color: colors.primaryContent },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  switchLabel: { color: colors.baseContent, fontSize: 14 },
  matchGenresLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.baseContent,
    marginTop: 8,
    marginBottom: 4,
  },
  genreWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  genreChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  genreChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  genreChipText: { fontSize: 12, color: colors.baseContent },
  genreChipTextActive: { color: colors.primaryContent, fontFamily: fonts.medium },
  matchResultBox: {
    alignItems: "center",
    marginTop: 16,
    alignSelf: "stretch",
    gap: 10,
  },
  matchResultText: { fontFamily: fonts.medium, fontSize: 14, color: colors.baseContent },
  matchAnalyzeButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  matchAnalyzeButtonText: { fontFamily: fonts.medium, color: colors.baseContent, fontSize: 13 },
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

  const [showFilters, setShowFilters] = useState(false);
  const [matchType, setMatchType] = useState<ContentType>("movie");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [useCount, setUseCount] = useState(true);
  const [useAvgRating, setUseAvgRating] = useState(true);
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

  const genreList = matchType === "movie" ? MOVIE_GENRES : SERIES_GENRES;
  const toggleGenre = (g: string) =>
    setSelectedGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));

  const handleCinematch = async () => {
    setMatchLoading(true);
    setMatchError(null);
    try {
      const result = await getMatchWithUser(id, {
        type: matchType,
        genres: selectedGenres,
        useCount,
        useAvgRating,
      });
      setMatchResult(result);
    } catch (e: any) {
      setMatchError(e?.response?.data?.message || t("Failed to calculate match."));
    } finally {
      setMatchLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const data = await analyzeMatchWithUser(id, matchType);
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

  return (
    <>
    <ScrollView contentContainerStyle={styles.container}>
      {profile.profile_pic_url ? (
        <Image source={{ uri: profile.profile_pic_url }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarFallbackText}>{profile.username.slice(0, 2).toUpperCase()}</Text>
        </View>
      )}

      <Text style={styles.username}>{profile.username}</Text>

      {!profile.isAuthorized ? (
        <>
          <View style={styles.lockRow}>
            <Ionicons name="lock-closed" size={16} color={colors.placeholder} />
            <Text style={styles.lockText}>{t("This account is private.")}</Text>
          </View>
          <FollowButton targetUserId={id} initialStatus={initialStatus} style={styles.followButton} />
        </>
      ) : (
        <>
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
            <Pressable style={styles.matchFilterButton} onPress={() => setShowFilters((v) => !v)}>
              <Text style={styles.matchFilterButtonText}>{t("⚙️ Filters")}</Text>
            </Pressable>
            <Pressable style={styles.matchCinematchButton} onPress={handleCinematch} disabled={matchLoading}>
              {matchLoading ? (
                <ActivityIndicator color={colors.primaryContent} size="small" />
              ) : (
                <Text style={styles.matchCinematchButtonText}>{t("🎬 Cinematch")}</Text>
              )}
            </Pressable>
          </View>

          {showFilters && (
            <View style={styles.matchPanel}>
              <View style={styles.segmentedRow}>
                {(["movie", "series"] as ContentType[]).map((type) => (
                  <Pressable
                    key={type}
                    style={[styles.segment, matchType === type && styles.segmentActive]}
                    onPress={() => {
                      setMatchType(type);
                      setSelectedGenres([]);
                    }}
                  >
                    <Text style={[styles.segmentText, matchType === type && styles.segmentTextActive]}>
                      {type === "movie" ? t("Movies") : t("Series")}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t("Watched Count")}</Text>
                <Switch
                  value={useCount}
                  onValueChange={setUseCount}
                  trackColor={{ true: colors.primary, false: colors.border }}
                />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t("Average Rating")}</Text>
                <Switch
                  value={useAvgRating}
                  onValueChange={setUseAvgRating}
                  trackColor={{ true: colors.primary, false: colors.border }}
                />
              </View>
              <Text style={styles.matchGenresLabel}>{t("Genres")}</Text>
              <View style={styles.genreWrap}>
                {genreList.map((genre) => {
                  const active = selectedGenres.includes(genre);
                  return (
                    <Pressable
                      key={genre}
                      style={[styles.genreChip, active && styles.genreChipActive]}
                      onPress={() => toggleGenre(genre)}
                    >
                      <Text style={[styles.genreChipText, active && styles.genreChipTextActive]}>
                        {genre}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {matchResult && (
            <View style={styles.matchResultBox}>
              <MatchPercentageRing percentage={matchResult.matchPercentage} size={72} strokeWidth={7} />
              <Text style={styles.matchResultText}>
                {t("Your match score is {{percent}}%", { percent: matchResult.matchPercentage })}
              </Text>
              <Pressable style={styles.matchAnalyzeButton} onPress={handleAnalyze} disabled={analyzing}>
                {analyzing ? (
                  <ActivityIndicator color={colors.baseContent} size="small" />
                ) : (
                  <Text style={styles.matchAnalyzeButtonText}>{t("Analyze")}</Text>
                )}
              </Pressable>
            </View>
          )}

          {matchError && <Text style={styles.error}>{matchError}</Text>}

          {cineGraph?.isAuthorized && (
            <>
              <CineGraphDonut title={t("Watched Movie Genres")} stats={cineGraph.movieStats} />
              <CineGraphDonut title={t("Watched Series Genres")} stats={cineGraph.seriesStats} />
            </>
          )}

          {favorites?.isAuthorized && (
            <>
              <ContentRail
                title={t("Favorite Movies")}
                data={favorites.movies}
                keyExtractor={(m) => m._id}
                emptyText={t("No favorite movies yet.")}
                renderItem={(m) => (
                  <ContentCard id={m._id} type="movie" title={m.title} posterPath={m.poster_path} basePath={`/user/${id}`} />
                )}
              />
              <ContentRail
                title={t("Favorite Series")}
                data={favorites.series}
                keyExtractor={(s) => s._id}
                emptyText={t("No favorite series yet.")}
                renderItem={(s) => (
                  <ContentCard id={s._id} type="series" title={s.name} posterPath={s.poster_path} basePath={`/user/${id}`} />
                )}
              />
            </>
          )}
        </>
      )}
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

