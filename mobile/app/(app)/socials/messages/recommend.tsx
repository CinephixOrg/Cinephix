import { useEffect, useState, useMemo } from "react";
import { View, Text, Image, FlatList, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import SearchBar from "../../../../src/components/SearchBar";
import ContentFilterPanel from "../../../../src/components/ContentFilterPanel";
import UserSharePickerModal from "../../../../src/components/UserSharePickerModal";
import { getMovies, getSeries, type ContentFilters } from "../../../../src/api/contentService";
import { MOVIE_GENRE_OPTIONS, SERIES_GENRE_OPTIONS } from "../../../../src/constants/contentGenreIds";
import { getOrCreateConversation, sendRichMessage } from "../../../../src/api/conversationService";
import { sendGroupRichMessage } from "../../../../src/api/groupService";
import { useAuth } from "../../../../src/context/AuthContext";
import { useChat } from "../../../../src/context/ChatContext";
import { useToast } from "../../../../src/context/ToastContext";
import type { ContentType, Movie, Series } from "../../../../src/types";
import { useTheme } from "../../../../src/context/ThemeContext";
import { fonts } from "../../../../src/theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w154";

type PickedContent = {
  contentType: ContentType;
  contentId: string;
  title: string;
  posterUrl?: string;
  genres: string[];
  releaseYear?: number;
  overview?: string;
  rating?: number;
};

export default function RecommendScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const { refreshConversations } = useChat();
  const { showToast } = useToast();

  const [contentType, setContentType] = useState<ContentType>("movie");
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [results, setResults] = useState<(Movie | Series)[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [picked, setPicked] = useState<PickedContent | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [sending, setSending] = useState(false);

  const changeType = (next: ContentType) => {
    setContentType(next);
    setSelectedGenres([]);
    setResults([]);
    setSearched(false);
    setPicked(null);
  };

  const toggleYear = (year: string) =>
    setSelectedYears((prev) => (prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]));
  const toggleGenre = (id: number) =>
    setSelectedGenres((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const filters: ContentFilters = { years: selectedYears, genres: selectedGenres };
    (async () => {
      try {
        const { items } =
          contentType === "movie"
            ? await getMovies(1, 15, trimmed, filters)
            : await getSeries(1, 15, trimmed, filters);
        if (!cancelled) {
          setResults(items);
          setSearched(true);
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query, contentType, selectedYears, selectedGenres]);

  const handlePick = (item: Movie | Series) => {
    const isMovie = "title" in item;
    const title = isMovie ? item.title : item.name;
    const releaseDate = isMovie ? item.release_date : item.first_air_date;
    setPicked({
      contentType,
      contentId: item._id,
      title,
      posterUrl: item.poster_path || undefined,
      genres: [],
      releaseYear: releaseDate ? Number(releaseDate.slice(0, 4)) : undefined,
      overview: item.overview,
      rating: item.vote_average,
    });
  };

  const handleConfirmRecipients = async (userIds: string[], groupIds: string[]) => {
    if (!picked || !user) return;
    setSending(true);
    try {
      const text = t("User recommends you", {
        user: user.username,
        title: picked.title,
        type: t(picked.contentType === "movie" ? "movie_acc" : "series_acc"),
      });
      const contentData = {
        title: picked.title,
        posterUrl: picked.posterUrl,
        genres: picked.genres,
        releaseYear: picked.releaseYear,
        overview: picked.overview,
        rating: picked.rating,
      };
      // allSettled, not all — see ContentDetailScreen.tsx's own
      // handleSendRecommendation for why: each recipient/group has its own
      // independent cooldown, so one already-recommended target shouldn't
      // sink the send to everyone else picked in the same batch.
      const results = await Promise.allSettled([
        ...userIds.map(async (userId) => {
          const conv = await getOrCreateConversation(userId);
          await sendRichMessage(conv._id, {
            text,
            type: "recommendation",
            contentType: picked.contentType,
            contentId: picked.contentId,
            contentData,
          });
        }),
        ...groupIds.map((groupId) =>
          sendGroupRichMessage(groupId, {
            text,
            type: "recommendation",
            contentType: picked.contentType,
            contentId: picked.contentId,
            contentData,
          })
        ),
      ]);
      const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      if (failures.length > 0 && failures.length === results.length) {
        showToast(failures[0].reason?.response?.data?.message || t("Something went wrong. Please try again."));
        return;
      }
      await refreshConversations();
      router.back();
    } catch {
      showToast(t("Something went wrong. Please try again."));
    } finally {
      setSending(false);
      setPickerVisible(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.base100 },
        tabBar: {
          flexDirection: "row",
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.base300,
        },
        tabButton: { flex: 1, alignItems: "center", paddingVertical: 12 },
        tabButtonActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
        tabText: { fontFamily: fonts.medium, fontSize: 13, color: colors.placeholder },
        tabTextActive: { color: colors.primary, fontFamily: fonts.bold },
        list: { paddingHorizontal: 16, paddingBottom: 100 },
        row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
        rowActive: { backgroundColor: colors.base200, borderRadius: 8 },
        poster: { width: 42, height: 60, borderRadius: 6, backgroundColor: colors.base200 },
        rowInfo: { flex: 1 },
        rowTitle: { fontFamily: fonts.medium, fontSize: 14, color: colors.baseContent },
        rowYear: { fontSize: 12, color: colors.placeholder, marginTop: 2 },
        empty: { textAlign: "center", color: colors.placeholder, marginTop: 40 },
        footer: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: 16,
          backgroundColor: colors.base100,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        continueButton: {
          backgroundColor: colors.primary,
          borderRadius: 8,
          paddingVertical: 14,
          alignItems: "center",
        },
        continueButtonDisabled: { opacity: 0.5 },
        continueButtonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 15 },
      }),
    [colors]
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tabButton, contentType === "movie" && styles.tabButtonActive]}
          onPress={() => changeType("movie")}
        >
          <Text style={[styles.tabText, contentType === "movie" && styles.tabTextActive]}>{t("Movies")}</Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, contentType === "series" && styles.tabButtonActive]}
          onPress={() => changeType("series")}
        >
          <Text style={[styles.tabText, contentType === "series" && styles.tabTextActive]}>{t("Series")}</Text>
        </Pressable>
      </View>

      <SearchBar
        placeholder={t("Search movies...")}
        onChangeQuery={setQuery}
        onFilterPress={() => setShowFilters((v) => !v)}
      />

      {searching ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            showFilters ? (
              <ContentFilterPanel
                genreOptions={contentType === "movie" ? MOVIE_GENRE_OPTIONS : SERIES_GENRE_OPTIONS}
                selectedYears={selectedYears}
                onToggleYear={toggleYear}
                selectedGenres={selectedGenres}
                onToggleGenre={toggleGenre}
              />
            ) : null
          }
          renderItem={({ item }) => {
            const isMovie = "title" in item;
            const title = isMovie ? item.title : item.name;
            const releaseDate = isMovie ? item.release_date : item.first_air_date;
            const isActive = picked?.contentId === item._id;
            return (
              <Pressable style={[styles.row, isActive && styles.rowActive]} onPress={() => handlePick(item)}>
                {item.poster_path ? (
                  <Image source={{ uri: `${POSTER_BASE}${item.poster_path}` }} style={styles.poster} />
                ) : (
                  <View style={styles.poster} />
                )}
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {title}
                  </Text>
                  {releaseDate ? <Text style={styles.rowYear}>{releaseDate.slice(0, 4)}</Text> : null}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            searched ? (
              <Text style={styles.empty}>
                {t(contentType === "movie" ? "No movies found." : "No series found.")}
              </Text>
            ) : null
          }
        />
      )}

      <View style={styles.footer}>
        <Pressable
          style={[styles.continueButton, !picked && styles.continueButtonDisabled]}
          onPress={() => setPickerVisible(true)}
          disabled={!picked}
        >
          <Text style={styles.continueButtonText}>{t("Continue")}</Text>
        </Pressable>
      </View>

      <UserSharePickerModal
        visible={pickerVisible}
        title={t("Recommend Movie/Series")}
        onClose={() => setPickerVisible(false)}
        sending={sending}
        onConfirm={handleConfirmRecipients}
        allowGroups
      />
    </View>
  );
}
