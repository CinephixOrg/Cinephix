import { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Switch,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { useTranslation } from "react-i18next";
import { findMatches, analyzeMatchWithUser } from "../../../src/api/matchService";
import { MOVIE_GENRES, SERIES_GENRES } from "../../../src/constants/genreConstants";
import MatchLeaderboard from "../../../src/components/MatchLeaderboard";
import MatchCard from "../../../src/components/MatchCard";
import AnalyzeModal from "../../../src/components/AnalyzeModal";
import { SkeletonMatchResults } from "../../../src/components/Skeleton";
import type { ContentType, MatchAnalysis, MatchResult } from "../../../src/types";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

type FilterMode = "general" | "specific";

export default function MatchScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.base100 },
  list: { padding: 16, paddingBottom: 32 },
  row: { justifyContent: "space-between" },
  title: { fontFamily: fonts.bold, fontSize: 24, color: colors.baseContent },
  subtitle: { color: colors.placeholder, fontSize: 13, marginTop: 4, marginBottom: 16 },
  panel: {
    backgroundColor: colors.base200,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  segmentedRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
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
  radioRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  radioDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
  },
  radioDotActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  radioLabel: { color: colors.baseContent, fontSize: 14 },
  genreWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8, marginBottom: 4 },
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
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    marginTop: 8,
  },
  switchLabel: { color: colors.baseContent, fontSize: 14 },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { fontFamily: fonts.bold, fontSize: 15, color: colors.primaryContent },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.baseContent, marginBottom: 12 },
  footerNote: { textAlign: "center", color: colors.placeholder, fontSize: 12, marginTop: 8 },
  emptyState: { alignItems: "center", marginTop: 24 },
  empty: { color: colors.placeholder, fontSize: 15, marginBottom: 16 },
  resetButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  resetButtonText: { color: colors.baseContent, fontFamily: fonts.medium },
  error: { color: colors.error, fontSize: 13, marginTop: 8 },
}), [colors]);
  const { t } = useTranslation();
  const [matchType, setMatchType] = useState<ContentType>("movie");
  const [filterMode, setFilterMode] = useState<FilterMode>("general");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [useCount, setUseCount] = useState(true);
  const [useAvgRating, setUseAvgRating] = useState(true);

  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [analyzeModalVisible, setAnalyzeModalVisible] = useState(false);
  const [analyzeData, setAnalyzeData] = useState<MatchAnalysis | null>(null);
  const [analyzeTargetUserId, setAnalyzeTargetUserId] = useState<string | null>(null);
  const [analyzingUserId, setAnalyzingUserId] = useState<string | null>(null);

  const genreList = matchType === "movie" ? MOVIE_GENRES : SERIES_GENRES;
  const criteriaValid = useCount || useAvgRating;
  const genresValid = filterMode === "general" || selectedGenres.length > 0;
  const canSubmit = criteriaValid && genresValid && !loading;

  const changeType = (type: ContentType) => {
    setMatchType(type);
    setSelectedGenres([]);
    setMatches([]);
    setHasSearched(false);
    setError(null);
  };

  const changeFilterMode = (mode: FilterMode) => {
    setFilterMode(mode);
    setSelectedGenres([]);
    setMatches([]);
    setHasSearched(false);
    setError(null);
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const handleFindMatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const { items, pagination } = await findMatches(
        {
          type: matchType,
          genres: filterMode === "specific" ? selectedGenres : [],
          useCount,
          useAvgRating,
        },
        1,
        15
      );
      setMatches(items);
      setTotalMatches(pagination?.total ?? items.length);
      setHasSearched(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to find matches."));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMatches([]);
    setHasSearched(false);
    setError(null);
  };

  const handleAnalyze = async (targetUserId: string) => {
    setAnalyzingUserId(targetUserId);
    try {
      const data = await analyzeMatchWithUser(targetUserId, matchType);
      setAnalyzeData(data);
      setAnalyzeTargetUserId(targetUserId);
      setAnalyzeModalVisible(true);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.message || t("Failed to analyze match."));
    } finally {
      setAnalyzingUserId(null);
    }
  };

  const header = (
    <View>
      <Text style={styles.title}>{t("Cinematch")}</Text>
      <Text style={styles.subtitle}>
        {t("Find users whose taste matches yours, based on ratings and genres.")}
      </Text>

      <View style={styles.panel}>
        <View style={styles.segmentedRow}>
          {(["movie", "series"] as ContentType[]).map((type) => (
            <Pressable
              key={type}
              style={[styles.segment, matchType === type && styles.segmentActive]}
              onPress={() => changeType(type)}
            >
              <Text
                style={[styles.segmentText, matchType === type && styles.segmentTextActive]}
              >
                {type === "movie" ? t("Movies") : t("Series")}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.radioRow} onPress={() => changeFilterMode("general")}>
          <View style={[styles.radioDot, filterMode === "general" && styles.radioDotActive]} />
          <Text style={styles.radioLabel}>{t("Match my entire CineGraph")}</Text>
        </Pressable>
        <Pressable style={styles.radioRow} onPress={() => changeFilterMode("specific")}>
          <View style={[styles.radioDot, filterMode === "specific" && styles.radioDotActive]} />
          <Text style={styles.radioLabel}>{t("Match specific genres")}</Text>
        </Pressable>

        {filterMode === "specific" && (
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
        )}

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
        {!criteriaValid && (
          <Text style={styles.error}>{t("You must select at least one criterion.")}</Text>
        )}

        <Pressable
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleFindMatches}
          disabled={!canSubmit}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryContent} />
          ) : (
            <Text style={styles.submitButtonText}>{t("🔍 Find Matches")}</Text>
          )}
        </Pressable>

        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      {loading && <SkeletonMatchResults />}

      {!loading && matches.length > 0 && (
        <>
          <MatchLeaderboard matches={matches} />
          <Text style={styles.sectionTitle}>{t("🎬 All Matches")}</Text>
        </>
      )}
    </View>
  );

  return (
    <>
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.list}
        data={loading ? [] : matches}
        keyExtractor={(item) => item.user._id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => (
          <MatchCard
            match={item}
            rank={index + 1}
            onAnalyze={handleAnalyze}
            analyzing={analyzingUserId === item.user._id}
          />
        )}
        ListFooterComponent={
          !loading && matches.length > 15 ? (
            <Text style={styles.footerNote}>
              {t("Showing top 15 matches")} {totalMatches} {t("total")}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          !loading && hasSearched ? (
            <View style={styles.emptyState}>
              <Text style={styles.empty}>{t("No matches found. Try adjusting your criteria.")}</Text>
              <Pressable style={styles.resetButton} onPress={handleReset}>
                <Text style={styles.resetButtonText}>{t("Back to Search")}</Text>
              </Pressable>
            </View>
          ) : null
        }
      />
      <AnalyzeModal
        visible={analyzeModalVisible}
        onClose={() => setAnalyzeModalVisible(false)}
        data={analyzeData}
        shareTargetUserId={analyzeTargetUserId ?? undefined}
      />
    </>
  );
}

